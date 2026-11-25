import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

const STORAGE_KEY = "bcb_mobile_app_lock_v1";
const IDLE_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 5 * 60 * 1000;

function isMobileViewport() {
  return window.matchMedia("(max-width: 700px) and (pointer: coarse)").matches;
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

function fromHex(value) {
  const pairs = value.match(/.{1,2}/g) || [];
  return new Uint8Array(pairs.map((pair) => parseInt(pair, 16)));
}

async function derivePinHash(pin, saltHex) {
  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations: 310000,
      hash: "SHA-256",
    },
    key,
    256
  );
  return toHex(bits);
}

function createSalt() {
  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);
  return toHex(salt);
}

function readConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      typeof value?.salt !== "string" ||
      typeof value?.hash !== "string" ||
      typeof value?.lastActive !== "number"
    ) return null;
    return value;
  } catch {
    return null;
  }
}

function writeConfig(value) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export default function MobileAppLock({ children }) {
  const [mobile, setMobile] = useState(isMobileViewport);
  const [config, setConfig] = useState(readConfig);
  const [locked, setLocked] = useState(() => {
    const saved = readConfig();
    return Boolean(saved);
  });
  const [mode, setMode] = useState(() => (readConfig() ? "unlock" : "setup"));
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px) and (pointer: coarse)");
    const update = () => setMobile(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const lockNow = useCallback(() => {
    if (!isMobileViewport()) return;
    setLocked(true);
    setMode(configRef.current ? "unlock" : "setup");
    setPin("");
    setConfirmPin("");
    setMessage("");
  }, []);

  const recordActivity = useCallback(() => {
    if (!isMobileViewport() || locked || !configRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    const next = { ...configRef.current, lastActive: now };
    configRef.current = next;
    setConfig(next);
    try { writeConfig(next); } catch { /* Storage may be unavailable. */ }
  }, [locked]);

  useEffect(() => {
    if (!mobile || !config) return undefined;

    const checkIdle = () => {
      const lastActive = Math.max(
        lastActivityRef.current || 0,
        configRef.current?.lastActive || 0
      );
      if (Date.now() - lastActive >= IDLE_MS) lockNow();
    };

    const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true })
    );
    const onVisibility = () => {
      if (document.visibilityState === "hidden") return;
      checkIdle();
    };
    document.addEventListener("visibilitychange", onVisibility);
    timerRef.current = window.setInterval(checkIdle, 1000);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity)
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timerRef.current);
    };
  }, [mobile, config, recordActivity, lockNow]);

  useEffect(() => {
    if (!mobile || !config) return;
    const remaining = IDLE_MS - (Date.now() - config.lastActive);
    if (remaining <= 0) lockNow();
    else lastActivityRef.current = config.lastActive;
  }, [mobile, config, lockNow]);

  const saveNewPin = async () => {
    if (mode === "setup") {
      if (!/^\d{6}$/.test(pin)) {
        setMessage("Please enter a 6-digit PIN.");
        return;
      }
      setConfirmPin("");
      setMode("confirm");
      setMessage("");
      return;
    }
    if (mode === "confirm" && pin !== confirmPin) {
      setMessage("The PINs do not match. Please try again.");
      setConfirmPin("");
      return;
    }
    setBusy(true);
    try {
      const salt = createSalt();
      const hash = await derivePinHash(pin, salt);
      const next = { salt, hash, lastActive: Date.now(), failedAttempts: 0, blockedUntil: 0 };
      writeConfig(next);
      configRef.current = next;
      setConfig(next);
      lastActivityRef.current = next.lastActive;
      setLocked(false);
      setPin("");
      setConfirmPin("");
      setMessage("");
    } catch {
      setMessage("Unable to securely save the PIN on this device.");
    } finally {
      setBusy(false);
    }
  };

  const resetForgottenPin = async () => {
    if (!accountPassword) {
      setMessage("Please enter your account password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data: currentData, error: currentError } = await supabase.auth.getUser();
      if (currentError || !currentData?.user?.id || !currentData.user.email) {
        throw new Error("Your login session could not be verified. Please sign in again.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: currentData.user.email,
        password: accountPassword,
      });
      if (error || data?.user?.id !== currentData.user.id) {
        throw new Error("The account password is incorrect. Please try again.");
      }
      window.localStorage.removeItem(STORAGE_KEY);
      configRef.current = null;
      setConfig(null);
      setMode("setup");
      setPin("");
      setConfirmPin("");
      setAccountPassword("");
      setCooldownUntil(0);
      setMessage("");
      setLocked(true);
    } catch (error) {
      setMessage(error?.message || "Unable to verify your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPin = async () => {
    if (!/^\d{6}$/.test(pin) || !config) {
      setMessage("Please enter a valid 6-digit PIN.");
      return;
    }
    const blockedUntil = config.blockedUntil || 0;
    if (Date.now() < blockedUntil) {
      setCooldownUntil(blockedUntil);
      setMessage("Too many incorrect attempts. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      const candidate = await derivePinHash(pin, config.salt);
      if (candidate === config.hash) {
        const next = { ...config, lastActive: Date.now(), failedAttempts: 0, blockedUntil: 0 };
        writeConfig(next);
        configRef.current = next;
        setConfig(next);
        lastActivityRef.current = next.lastActive;
        setLocked(false);
        setPin("");
        setMessage("");
        setCooldownUntil(0);
      } else {
        const failedAttempts = (config.failedAttempts || 0) + 1;
        const blockedUntil = failedAttempts >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : 0;
        const next = { ...config, failedAttempts: blockedUntil ? 0 : failedAttempts, blockedUntil };
        writeConfig(next);
        configRef.current = next;
        setConfig(next);
        setPin("");
        setCooldownUntil(blockedUntil);
        setMessage(blockedUntil
          ? "5 incorrect attempts. Try again in 5 minutes."
          : `Incorrect PIN. ${MAX_ATTEMPTS - failedAttempts} attempts remaining.`);
      }
    } catch {
      setMessage("Could not verify the PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!mobile || !config && !locked) {
    if (!mobile) return children;
  }

  if (mobile && (!config || locked)) {
    const remainingCooldown = Math.max(0, cooldownUntil - Date.now());
    const submit = (mode === "setup" || mode === "confirm") ? saveNewPin : mode === "forgot" ? resetForgottenPin : verifyPin;
    const activePin = mode === "confirm" ? confirmPin : pin;
    const addDigit = (digit) => {
      if (busy || remainingCooldown > 0) return;
      if (mode === "confirm") setConfirmPin((value) => (value + digit).slice(0, 6));
      else setPin((value) => (value + digit).slice(0, 6));
      setMessage("");
    };
    const removeDigit = () => {
      if (mode === "confirm") setConfirmPin((value) => value.slice(0, -1));
      else setPin((value) => value.slice(0, -1));
      setMessage("");
    };
    return (
      <div style={styles.overlay}>
        <div style={styles.blueWave} />
        <form style={styles.screen} onSubmit={(event) => { event.preventDefault(); if (!busy && !remainingCooldown) submit(); }}>
          <div style={styles.brand}>
            <div style={styles.brandShield}>
              <svg viewBox="0 0 24 24" width="54" height="54" fill="none" aria-hidden="true">
                <path d="M12 2.5 20 6v5.6c0 5-3.3 8.4-8 10.3-4.7-1.9-8-5.3-8-10.3V6l8-3.5Z" stroke="currentColor" strokeWidth="1.7" />
                <rect x="8" y="10" width="8" height="7" rx="1.5" fill="currentColor"/>
                <path d="M10 10V8.5a2 2 0 0 1 4 0V10" stroke="#073477" strokeWidth="1.6"/>
              </svg>
            </div>
            <h1 style={styles.brandTitle}>Big Collection BD</h1>
            <p style={styles.brandSubtitle}>MANAGEMENT SYSTEM</p>
            <div style={styles.goldRule} />
          </div>
          <section style={styles.card}>
            <h2 style={styles.heading}>{mode === "setup" ? "Create Your PIN" : mode === "confirm" ? "Confirm Your PIN" : mode === "forgot" ? "Reset Your PIN" : "Enter Your PIN"}</h2>
            <p style={styles.helper}>
              {mode === "setup" ? "Secure your account on this device" : mode === "confirm" ? "Re-enter your 6-digit PIN" : mode === "forgot" ? "Verify your account password to set a new PIN" : "Unlock your account"}
            </p>
            {mode === "forgot" ? (
              <>
                <label style={styles.fieldLabel} htmlFor="bcb-account-password">ACCOUNT PASSWORD</label>
                <input id="bcb-account-password" style={styles.input} type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => { setAccountPassword(event.target.value); setMessage(""); }} placeholder="Enter your login password" aria-label="Account password" disabled={busy} autoFocus />
              </>
            ) : (
              <>
                <div style={styles.pinDots} aria-label={activePin.length + " of 6 digits entered"}>
                  {Array.from({ length: 6 }, (_, index) => <span key={index} style={{ ...styles.pinDot, ...(index < activePin.length ? styles.pinDotFilled : {}) }} />)}
                </div>
                <div style={styles.keypad}>
                  {["1","2","3","4","5","6","7","8","9","back","0","done"].map((key) => (
                    <button key={key} type={key === "done" ? "submit" : "button"} style={key === "done" ? styles.keyDone : key === "back" ? styles.keySpecial : styles.key} onClick={key === "back" ? removeDigit : key === "done" ? undefined : () => addDigit(key)} disabled={busy || remainingCooldown > 0 || (key === "done" && activePin.length !== 6)} aria-label={key === "back" ? "Delete last digit" : key === "done" ? "Submit PIN" : "Digit " + key}>
                      {key === "back" ? "⌫" : key === "done" ? "✓" : key}
                    </button>
                  ))}
                </div>
              </>
            )}
            {message && <p style={styles.message} role="alert">{message}</p>}
            {mode === "forgot" && <button style={styles.button} type="submit" disabled={busy}>{busy ? "Please wait..." : "Verify & Reset PIN"}</button>}
            {mode === "unlock" && <button type="button" onClick={() => { setMode("forgot"); setAccountPassword(""); setMessage(""); }} disabled={busy} style={styles.linkButton}>Forgot PIN?</button>}
            {mode === "forgot" && <button type="button" onClick={() => { setMode("unlock"); setAccountPassword(""); setMessage(""); }} disabled={busy} style={styles.linkButton}>Back to PIN</button>}
            {mode === "confirm" && <button type="button" onClick={() => { setMode("setup"); setConfirmPin(""); setMessage(""); }} style={styles.linkButton}>Back</button>}
            <div style={styles.footer}><span style={styles.footerIcon}>✓</span><span>Your data stays protected on this device</span></div>
          </section>
          <p style={styles.bottomTagline}>— Buy More Save More —</p>
        </form>
      </div>
    );
  }

  return children;
}

const styles = {
  overlay: { position: "fixed", inset: 0, zIndex: 99999, overflowY: "auto", background: "linear-gradient(155deg, #06265f 0%, #073d91 52%, #041d4c 100%)", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: "#fff" },
  blueWave: { position: "fixed", inset: 0, pointerEvents: "none", opacity: .45, background: "radial-gradient(ellipse at 85% 16%, rgba(35,115,229,.65), transparent 36%), radial-gradient(ellipse at 5% 88%, rgba(26,92,187,.55), transparent 38%)" },
  screen: { position: "relative", zIndex: 1, width: "100%", maxWidth: 440, minHeight: "100dvh", margin: "0 auto", padding: "max(28px, env(safe-area-inset-top)) 20px max(18px, env(safe-area-inset-bottom))", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 },
  brand: { textAlign: "center", padding: "4px 0 0", color: "#fff" },
  brandShield: { color: "#f5d27a", display: "flex", justifyContent: "center", marginBottom: 4, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.2))" },
  brandTitle: { margin: 0, color: "#fff", fontSize: 25, fontWeight: 800, letterSpacing: "-.7px" },
  brandSubtitle: { margin: "6px 0 0", color: "rgba(255,255,255,.9)", fontSize: 11, letterSpacing: 3, fontWeight: 600 },
  goldRule: { width: 76, height: 3, borderRadius: 5, margin: "14px auto 0", background: "linear-gradient(90deg, #d8a943, #ffe5a0, #d8a943)" },
  card: { width: "100%", boxSizing: "border-box", padding: "27px 22px 22px", borderRadius: 25, background: "linear-gradient(180deg, #fff 0%, #f7faff 100%)", color: "#09275e", boxShadow: "0 20px 55px rgba(0,12,40,.3)", display: "flex", flexDirection: "column", gap: 14, textAlign: "center" },
  heading: { margin: 0, color: "#09275e", fontSize: 25, fontWeight: 800, letterSpacing: "-.6px" },
  helper: { margin: "-8px 0 5px", color: "#182f5c", fontSize: 14, fontWeight: 500 },
  pinDots: { display: "flex", justifyContent: "center", gap: 13, padding: "9px 0 13px" },
  pinDot: { width: 18, height: 18, borderRadius: "50%", border: "2px solid #b9cce7", background: "#fff", boxSizing: "border-box" },
  pinDotFilled: { borderColor: "#075bd8", background: "#075bd8", boxShadow: "0 0 0 3px rgba(7,91,216,.1)" },
  keypad: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 300, width: "100%", margin: "0 auto" },
  key: { height: 62, borderRadius: 50, border: "1.5px solid #dce7f7", background: "linear-gradient(145deg, #fff, #edf3fc)", color: "#09275e", fontSize: 27, fontWeight: 600, boxShadow: "0 2px 5px rgba(16,55,112,.04)" },
  keySpecial: { height: 62, borderRadius: 50, border: 0, background: "#e1ebfa", color: "#09275e", fontSize: 25, fontWeight: 700 },
  keyDone: { height: 62, borderRadius: 50, border: 0, background: "linear-gradient(145deg, #0871f7, #0649c5)", color: "#fff", fontSize: 27, fontWeight: 800, boxShadow: "0 5px 14px rgba(0,79,201,.2)" },
  fieldLabel: { color: "#405b86", fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textAlign: "left" },
  input: { width: "100%", padding: "15px", border: "1.5px solid #d8e2ef", borderRadius: 12, fontSize: 15, textAlign: "center", boxSizing: "border-box", background: "#f7faff", color: "#172b47" },
  button: { width: "100%", padding: 15, border: 0, borderRadius: 12, background: "linear-gradient(100deg, #0871f7, #0649c5)", color: "#fff", fontSize: 14, fontWeight: 800 },
  message: { margin: 0, padding: "10px 12px", borderRadius: 10, background: "#fff1f1", color: "#b42318", fontSize: 12 },
  linkButton: { border: 0, background: "transparent", color: "#1459b5", fontSize: 13, fontWeight: 800, padding: "5px", cursor: "pointer" },
  footer: { display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 2, padding: "13px 8px", borderRadius: 40, background: "#e4efff", color: "#0846a2", fontSize: 12, fontWeight: 700 },
  footerIcon: { width: 21, height: 21, borderRadius: "50%", background: "#0871e8", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900 },
  bottomTagline: { margin: "auto 0 0", paddingTop: 2, color: "#f6d47e", textAlign: "center", fontFamily: "Georgia, serif", fontSize: 15, fontStyle: "italic", letterSpacing: ".3px" },
};
