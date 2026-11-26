import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import {
  enablePushNotifications,
  getPushSupport,
  syncExistingPushSubscription,
} from "./pushNotifications";

export default function PushNotificationPrompt({ userRole }) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkDevice() {
      const support = await getPushSupport();
      if (!active) return;
      if (!support.supported || !["owner", "admin"].includes(userRole)) {
        setVisible(false);
        setChecking(false);
        return;
      }
      if (support.enabled) {
        try {
          await syncExistingPushSubscription();
        } catch (syncError) {
          console.error("Could not sync existing push subscription:", syncError);
        }
        if (active) setVisible(false);
      } else {
        const blocked = Notification.permission === "denied";
        setPermissionBlocked(blocked);
        setVisible(true);
      }
      setChecking(false);
    }
    checkDevice();
    return () => { active = false; };
  }, [userRole]);

  async function handleEnable() {
    setBusy(true);
    setError("");
    try {
      await enablePushNotifications();
      setVisible(false);
    } catch (enableError) {
      setError(enableError?.message || "নোটিফিকেশন চালু করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  if (checking || !visible) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" style={{ position: "relative", width: "100%", maxWidth: 380, boxSizing: "border-box", padding: 26, borderRadius: 18, background: "#fff", color: "#172033", textAlign: "center", boxShadow: "0 18px 55px rgba(0,0,0,.22)" }}>
        <button type="button" onClick={() => setVisible(false)} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, border: 0, background: "transparent", color: "#64748b", padding: 6 }}>
          <X size={20} />
        </button>
        <div style={{ width: 54, height: 54, margin: "0 auto 14px", borderRadius: 16, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BellRing size={28} />
        </div>
        <h2 id="push-prompt-title" style={{ margin: "0 0 9px", fontSize: 20 }}>Notification চালু করুন</h2>
        {permissionBlocked ? (
          <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            এই ব্রাউজারে Notification বন্ধ করা আছে। ফোনের Browser Settings থেকে এই সাইটের Notification Allow করে আবার অ্যাপ খুলুন।
          </p>
        ) : (
          <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            Pathao parcel status এবং জরুরি টিম আপডেট পেতে এই ফোনে Notification চালু করুন। একবার চালু করলেই হবে।
          </p>
        )}
        {error && <p role="alert" style={{ margin: "0 0 14px", color: "#dc2626", fontSize: 13 }}>{error}</p>}
        {!permissionBlocked && (
          <button type="button" onClick={handleEnable} disabled={busy} style={{ width: "100%", minHeight: 46, border: 0, borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Bell size={18} /> {busy ? "চালু হচ্ছে..." : "Enable Notifications"}
          </button>
        )}
        <button type="button" onClick={() => setVisible(false)} style={{ marginTop: 12, border: 0, background: "transparent", color: "#64748b", padding: 8, fontSize: 13 }}>
          {permissionBlocked ? "ঠিক আছে" : "এখন নয়"}
        </button>
      </section>
    </div>
  );
}
