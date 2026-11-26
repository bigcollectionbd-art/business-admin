import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { enablePushNotifications, disablePushNotifications, getPushSupport } from "./pushNotifications";

export default function PushNotificationSetup() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getPushSupport().then((state) => {
      if (!active) return;
      setSupported(state.supported);
      setEnabled(state.enabled);
    });
    return () => { active = false; };
  }, []);

  async function handleEnable() {
    setBusy(true); setMessage(""); setError("");
    try {
      await enablePushNotifications();
      setEnabled(true);
      setMessage("এই মোবাইলে নোটিফিকেশন চালু হয়েছে।");
    } catch (err) {
      setError(err?.message || "নোটিফিকেশন চালু করা যায়নি।");
    } finally { setBusy(false); }
  }

  async function handleDisable() {
    setBusy(true); setMessage(""); setError("");
    try {
      await disablePushNotifications();
      setEnabled(false);
      setMessage("এই ডিভাইসে নোটিফিকেশন বন্ধ করা হয়েছে।");
    } catch (err) {
      setError(err?.message || "নোটিফিকেশন বন্ধ করা যায়নি।");
    } finally { setBusy(false); }
  }

  return (
    <section className="settings-section push-notification-section">
      <h2>Mobile Push Notifications</h2>
      <p className="backup-description">
        Android অথবা iPhone-এর Home Screen থেকে ইনস্টল করা Management App-এ Notification চালু করুন। Desktop-এ এই সুবিধা দেখানো হবে না।
      </p>
      {!supported ? (
        <div className="login-error">এই ডিভাইস/ব্রাউজারে Web Push সমর্থিত নয়। iPhone হলে Home Screen-এ Add to Home Screen করে অ্যাপটি খুলুন।</div>
      ) : enabled ? (
        <button type="button" className="settings-save-button" onClick={handleDisable} disabled={busy}>
          <Bell size={18} /> {busy ? "Updating..." : "Disable Notifications"}
        </button>
      ) : (
        <button type="button" className="settings-save-button" onClick={handleEnable} disabled={busy}>
          {busy ? <BellRing size={18} /> : <Bell size={18} />}
          {busy ? "চালু হচ্ছে..." : "Enable Notifications"}
        </button>
      )}
      {message && <div className="settings-success">{message}</div>}
      {error && <div className="login-error">{error}</div>}
    </section>
  );
}
