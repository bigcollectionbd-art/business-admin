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
        <form
          style={styles.panel}
          onSubmit={(event) => { event.preventDefault(); if (!busy && !remainingCooldown) submit(); }}
        >
          <div style={styles.logo}>B</div>
          <h1 style={styles.title}>Big Collection BD</h1>
          <p style={styles.subtitle}>SECURE WORKSPACE ACCESS</p>
          <h2 style={styles.heading}>{mode === "setup" ? "Create Your 6-Digit PIN" : mode === "forgot" ? "Reset Your PIN" : "Welcome Back"}</h2>
          <p style={styles.helper}>
            {mode === "setup"
              ? "Create a 6-digit PIN to secure your workspace on this device."
              : mode === "forgot"\n              ? "Verify your account with your login password to create a new PIN."\n              : "Enter your 6-digit PIN to unlock your workspace."}
          </p>
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
              <label style={styles.fieldLabel} htmlFor="bcb-pin">
                {mode === "setup" ? "NEW PIN" : "ENTER PIN"}
              </label>
              <input
                id="bcb-pin"
                style={styles.input}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(event) => { setPin(event.target.value.replace(/\\D/g, "").slice(0, 6)); setMessage(""); }}
                placeholder="••••••"
                aria-label={mode === "setup" ? "Create 6-digit PIN" : "Enter 6-digit PIN"}
                disabled={busy || remainingCooldown > 0}
                autoFocus
              />
            </>
          )}
          {mode === "setup" && (
            <>
              <label style={styles.fieldLabel} htmlFor="bcb-confirm-pin">CONFIRM PIN</label>
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
                placeholder="••••••"
                aria-label="Confirm 6-digit PIN"
                disabled={busy}
              />
            </>
          )}
          {message && <p style={styles.message} role="alert">{message}</p>}
          <button style={styles.button} type="submit" disabled={busy || remainingCooldown > 0}>
            {busy ? "Please wait..." : mode === "setup" ? "Save PIN" : mode === "forgot" ? "Verify & Reset PIN" : "Unlock"}
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
          <p style={styles.note}>Your app also locks automatically after 15 minutes of inactivity.</p>
        </form>
      </div>
    );
  }

  return children;
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 99999, display: "flex",
    alignItems: "center", justifyContent: "center", padding: 24,
    background: "linear-gradient(145deg, #0f2742 0%, #153b60 55%, #0b1726 100%)",
    fontFamily: "Arial, sans-serif",
  },
  panel: {
    width: "100%", maxWidth: 390, maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
    padding: "34px 28px 28px", borderRadius: 24, background: "#fff",
    boxShadow: "0 24px 70px rgba(0,0,0,.32)", display: "flex",
    flexDirection: "column", gap: 13, textAlign: "left",
  },
  logo: {
    width: 58, height: 58, margin: "0 auto 5px", display: "grid",
    placeItems: "center", borderRadius: 18, background: "linear-gradient(145deg, #3478f6, #1746b8)",
    color: "#fff", fontSize: 29, fontWeight: 800, boxShadow: "0 8px 20px rgba(37,99,235,.25)",
  },
  title: { margin: 0, color: "#172033", fontSize: 21, textAlign: "center", fontWeight: 800 },
  subtitle: { margin: "-6px 0 8px", color: "#718096", fontSize: 11, textAlign: "center", letterSpacing: 1.5, fontWeight: 700 },
  heading: { margin: "10px 0 0", color: "#172033", fontSize: 22, fontWeight: 800, letterSpacing: "-.3px" },
  helper: { margin: "0 0 8px", color: "#64748b", fontSize: 13, lineHeight: 1.5 },
  fieldLabel: { marginBottom: -6, color: "#475569", fontSize: 10, fontWeight: 800, letterSpacing: 1.1 },
  input: {
    width: "100%", padding: "15px 12px", border: "1.5px solid #cbd5e1",
    borderRadius: 12, fontSize: 22, textAlign: "center", letterSpacing: 8,
    outlineColor: "#2563eb", boxSizing: "border-box", background: "#f8fafc", color: "#172033",
  },
  button: {
    width: "100%", padding: 14, border: 0, borderRadius: 11,
    background: "linear-gradient(90deg, #2563eb, #1d4ed8)", color: "#fff", fontSize: 15,
    fontWeight: 700, cursor: "pointer",
  },
  message: { margin: 0, color: "#b91c1c", fontSize: 13 },
  linkButton: { border: 0, background: "transparent", color: "#2563eb", fontSize: 13, fontWeight: 700, padding: "8px 4px", cursor: "pointer" },
  note: { margin: "8px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.5, textAlign: "center" },
};
