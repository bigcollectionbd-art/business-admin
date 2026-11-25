import { useCallback, useEffect, useRef, useState } from "react";

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
    return Boolean(saved && Date.now() - saved.lastActive >= IDLE_MS);
  });
  const [mode, setMode] = useState(() => (readConfig() ? "unlock" : "setup"));
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
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
      setMessage("৬ সংখ্যার PIN দিন।");
      return;
    }
    if (pin !== confirmPin) {
      setMessage("দুইবার দেওয়া PIN মিলছে না।");
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
      setMessage("এই ডিভাইসে নিরাপদ PIN সংরক্ষণ করা যাচ্ছে না।");
    } finally {
      setBusy(false);
    }
  };

  const verifyPin = async () => {
    if (!/^\d{6}$/.test(pin) || !config) {
      setMessage("সঠিক ৬ সংখ্যার PIN দিন।");
      return;
    }
    const blockedUntil = config.blockedUntil || 0;
    if (Date.now() < blockedUntil) {
      setCooldownUntil(blockedUntil);
      setMessage("অনেকবার ভুল PIN দেওয়া হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।");
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
          ? "৫ বার ভুল PIN হয়েছে। ৫ মিনিট পরে আবার চেষ্টা করুন।"
          : `ভুল PIN। আরও ${MAX_ATTEMPTS - failedAttempts} বার চেষ্টা করতে পারবেন।`);
      }
    } catch {
      setMessage("PIN যাচাই করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  };

  if (!mobile || !config && !locked) {
    if (!mobile) return children;
  }

  if (mobile && (!config || locked)) {
    const remainingCooldown = Math.max(0, cooldownUntil - Date.now());
    const submit = mode === "setup" ? saveNewPin : verifyPin;
    return (
      <div style={styles.overlay}>
        <form
          style={styles.panel}
          onSubmit={(event) => { event.preventDefault(); if (!busy && !remainingCooldown) submit(); }}
        >
          <div style={styles.logo}>B</div>
          <h1 style={styles.title}>Big Collection BD</h1>
          <p style={styles.subtitle}>Management System App Lock</p>
          <h2 style={styles.heading}>{mode === "setup" ? "৬ সংখ্যার PIN সেট করুন" : "অ্যাপ আনলক করুন"}</h2>
          <input
            style={styles.input}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(""); }}
            placeholder="৬ সংখ্যার PIN"
            aria-label="৬ সংখ্যার PIN"
            disabled={busy || remainingCooldown > 0}
            autoFocus
          />
          {mode === "setup" && (
            <input
              style={styles.input}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="off"
              value={confirmPin}
              onChange={(event) => { setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(""); }}
              placeholder="PIN আবার লিখুন"
              aria-label="PIN নিশ্চিত করুন"
              disabled={busy}
            />
          )}
          {message && <p style={styles.message} role="alert">{message}</p>}
          <button style={styles.button} type="submit" disabled={busy || remainingCooldown > 0}>
            {busy ? "অপেক্ষা করুন..." : mode === "setup" ? "PIN সংরক্ষণ করুন" : "Unlock"}
          </button>
          <p style={styles.note}>১৫ মিনিট নিষ্ক্রিয় থাকলে অ্যাপ আবার Lock হবে।</p>
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
    background: "linear-gradient(145deg, #102b43, #0b1726)",
    fontFamily: "Arial, sans-serif",
  },
  panel: {
    width: "100%", maxWidth: 360, padding: 28, borderRadius: 22,
    background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.3)",
    display: "flex", flexDirection: "column", gap: 12, textAlign: "center",
  },
  logo: {
    width: 54, height: 54, margin: "0 auto", display: "grid",
    placeItems: "center", borderRadius: 16, background: "#2563eb",
    color: "#fff", fontSize: 28, fontWeight: 800,
  },
  title: { margin: 0, color: "#172033", fontSize: 20 },
  subtitle: { margin: "-6px 0 8px", color: "#718096", fontSize: 12 },
  heading: { margin: "8px 0", color: "#172033", fontSize: 18 },
  input: {
    width: "100%", padding: "14px 12px", border: "1px solid #cbd5e1",
    borderRadius: 11, fontSize: 20, textAlign: "center", letterSpacing: 6,
    outlineColor: "#2563eb", boxSizing: "border-box",
  },
  button: {
    width: "100%", padding: 14, border: 0, borderRadius: 11,
    background: "#2563eb", color: "#fff", fontSize: 15,
    fontWeight: 700, cursor: "pointer",
  },
  message: { margin: 0, color: "#b91c1c", fontSize: 13 },
  note: { margin: "4px 0 0", color: "#64748b", fontSize: 11 },
};
