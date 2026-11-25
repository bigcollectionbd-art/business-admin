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
    if (!/^\d{6}$/.test(pin)) {
      setMessage("Please enter a 6-digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setMessage("The PINs do not match. Please try again.");
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
    const submit = mode === "setup" ? saveNewPin : mode === "forgot" ? resetForgottenPin : verifyPin;
    return (
      <div style={styles.overlay}>
        <div style={styles.glowOne} />
        <div style={styles.glowTwo} />
        <form
          style={styles.panel}
          onSubmit={(event) => { event.preventDefault(); if (!busy && !remainingCooldown) submit(); }}
        >
          <div style={styles.brandRow}>
            <div style={styles.logo}>
              <svg viewBox="0 0 24 24" width="29" height="29" fill="none" aria-hidden="true">
                <path d="M12 3 19 6v5.2c0 4.5-2.9 7.8-7 9.8-4.1-2-7-5.3-7-9.8V6l7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 style={styles.title}>Big Collection BD</h1>
              <p style={styles.subtitle}>MANAGEMENT SYSTEM</p>
            </div>
          </div>
          <div style={styles.divider} />
          <div style={styles.headingGroup}>
            <div style={styles.secureBadge}>
              <span style={styles.secureDot} />
              DEVICE SECURITY
            </div>
            <h2 style={styles.heading}>{mode === "setup" ? "Create your PIN" : mode === "forgot" ? "Reset your PIN" : "Welcome back"}</h2>
            <p style={styles.helper}>
              {mode === "setup"
                ? "Set a 6-digit PIN to keep your workspace secure on this device."
                : mode === "forgot"
                ? "Verify your account password to set a new device PIN."
                : "Enter your PIN to securely access your workspace."}
            </p>
          </div>
          {mode === "forgot" ? (
            <>
              <label style={styles.fieldLabel} htmlFor="bcb-account-password">ACCOUNT PASSWORD</label>
              <input
                id="bcb-account-password"
                style={styles.input}
                type="password"
                autoComplete="current-password"
                value={accountPassword}
                onChange={(event) => { setAccountPassword(event.target.value); setMessage(""); }}
                placeholder="Enter your login password"
                aria-label="Account password"
                disabled={busy}
                autoFocus
              />
            </>
          ) : (
            <>
              <label style={styles.fieldLabel} htmlFor="bcb-pin">{mode === "setup" ? "NEW 6-DIGIT PIN" : "YOUR 6-DIGIT PIN"}</label>
              <input
                id="bcb-pin"
                style={styles.input}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(""); }}
                placeholder="Enter 6 digits"
                aria-label={mode === "setup" ? "Create 6-digit PIN" : "Enter 6-digit PIN"}
                disabled={busy || remainingCooldown > 0}
                autoFocus
              />
              <div style={styles.pinDots} aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => <span key={index} style={{ ...styles.pinDot, ...(index < pin.length ? styles.pinDotFilled : {}) }} />)}
              </div>
            </>
          )}
          {mode === "setup" && (
            <>
              <label style={styles.fieldLabel} htmlFor="bcb-confirm-pin">CONFIRM YOUR PIN</label>
              <input
                id="bcb-confirm-pin"
                style={styles.input}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                value={confirmPin}
                onChange={(event) => { setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(""); }}
                placeholder="Re-enter 6 digits"
                aria-label="Confirm 6-digit PIN"
                disabled={busy}
              />
              <div style={styles.pinDots} aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => <span key={index} style={{ ...styles.pinDot, ...(index < confirmPin.length ? styles.pinDotFilled : {}) }} />)}
              </div>
            </>
          )}
          {message && <p style={styles.message} role="alert">{message}</p>}
          <button style={styles.button} type="submit" disabled={busy || remainingCooldown > 0}>
            {busy ? "Please wait..." : mode === "setup" ? "Create Secure PIN" : mode === "forgot" ? "Verify & Reset PIN" : "Unlock Workspace"}
            {!busy && <span aria-hidden="true"> →</span>}
          </button>
          {mode === "unlock" && (
            <button type="button" onClick={() => { setMode("forgot"); setAccountPassword(""); setMessage(""); }} disabled={busy} style={styles.linkButton}>
              Forgot PIN?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => { setMode("unlock"); setAccountPassword(""); setMessage(""); }} disabled={busy} style={styles.linkButton}>
              Back to PIN
            </button>
          )}
          <div style={styles.footer}>
            <span style={styles.footerIcon}>✓</span>
            <span>Your PIN is stored securely on this device only.</span>
          </div>
          <p style={styles.note}>For your protection, the app locks after 15 minutes of inactivity.</p>
        </form>
      </div>
  }

  return children;
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 99999, display: "flex",
    alignItems: "center", justifyContent: "center", padding: "20px 16px",
    overflowY: "auto",
    background: "radial-gradient(circle at 15% 15%, rgba(55,111,190,.34), transparent 34%), radial-gradient(circle at 90% 85%, rgba(35,79,139,.3), transparent 32%), linear-gradient(145deg, #08172d 0%, #102b4d 52%, #071426 100%)",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  },
  glowOne: { position: "fixed", width: 220, height: 220, borderRadius: "50%", background: "rgba(75,139,232,.10)", filter: "blur(55px)", top: "-80px", left: "-70px", pointerEvents: "none" },
  glowTwo: { position: "fixed", width: 240, height: 240, borderRadius: "50%", background: "rgba(42,91,157,.12)", filter: "blur(60px)", bottom: "-100px", right: "-90px", pointerEvents: "none" },
  panel: {
    position: "relative", zIndex: 1, width: "100%", maxWidth: 410,
    maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
    padding: "30px 26px 23px", borderRadius: 25,
    background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
    border: "1px solid rgba(255,255,255,.72)",
    boxShadow: "0 28px 90px rgba(0,0,0,.38), 0 3px 12px rgba(10,35,70,.12)",
    display: "flex", flexDirection: "column", gap: 12, textAlign: "left",
  },
  brandRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 2 },
  logo: {
    width: 52, height: 52, flexShrink: 0, display: "grid", placeItems: "center",
    borderRadius: 17, background: "linear-gradient(145deg, #347df0, #1746a5)",
    color: "#fff", boxShadow: "0 8px 20px rgba(37,99,235,.25)",
  },
  title: { margin: 0, color: "#14243b", fontSize: 19, fontWeight: 800, letterSpacing: "-.45px" },
  subtitle: { margin: "4px 0 0", color: "#71839b", fontSize: 9, letterSpacing: 1.8, fontWeight: 800 },
  divider: { height: 1, background: "linear-gradient(90deg, transparent, #dce5f1, transparent)", margin: "5px 0 4px" },
  headingGroup: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 3 },
  secureBadge: { display: "inline-flex", alignItems: "center", gap: 7, color: "#3265aa", fontSize: 9, letterSpacing: 1.35, fontWeight: 800 },
  secureDot: { width: 7, height: 7, borderRadius: "50%", background: "#2f80ed", boxShadow: "0 0 0 3px rgba(47,128,237,.12)" },
  heading: { margin: 0, color: "#14243b", fontSize: 25, fontWeight: 800, letterSpacing: "-.7px" },
  helper: { margin: 0, color: "#66778e", fontSize: 13, lineHeight: 1.55 },
  fieldLabel: { marginTop: 4, marginBottom: -5, color: "#40536d", fontSize: 9, fontWeight: 800, letterSpacing: 1.15 },
  input: {
    width: "100%", padding: "14px 15px", border: "1.5px solid #d8e2ef",
    borderRadius: 12, fontSize: 15, textAlign: "center", letterSpacing: 2,
    outlineColor: "#3478e5", boxSizing: "border-box", background: "#f7faff", color: "#172b47",
    transition: "border-color .2s, box-shadow .2s",
  },
  pinDots: { display: "flex", justifyContent: "center", gap: 10, margin: "-2px 0 2px },
  pinDot: { width: 8, height: 8, borderRadius: "50%", background: "#d7e0ec", transition: "background .15s, transform .15s" },
  pinDotFilled: { background: "#3478e5", transform: "scale(1.18)" },
  button: {
    width: "100%", padding: "15px 16px", marginTop: 5, border: 0, borderRadius: 12,
    background: "linear-gradient(100deg, #347cf0 0%, #1c50b5 100%)",
    color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: ".15px",
    cursor: "pointer", boxShadow: "0 9px 20px rgba(37,99,235,.22)",
  },
  message: { margin: 0, padding: "10px 12px", borderRadius: 10, background: "#fff1f1", color: "#b42318", fontSize: 12, lineHeight: 1.45 },
  linkButton: { border: 0, background: "transparent", color: "#2866c1", fontSize: 12, fontWeight: 800, padding: "5px 4px", cursor: "pointer" },
  footer: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 5, color: "#62748c", fontSize: 10 },
  footerIcon: { width: 16, height: 16, display: "grid", placeItems: "center", borderRadius: "50%", background: "#e7f5ed", color: "#21834a", fontSize: 10, fontWeight: 900 },
  note: { margin: "-5px 0 0", color: "#8a98aa", fontSize: 10, lineHeight: 1.45, textAlign: "center" },
};
