import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { enablePushNotifications } from "./pushNotifications";

export default function PushNotificationSetup() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleEnable() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await enablePushNotifications();
      setMessage("এই ডিভাইসে নোটিফিকেশন চালু হয়েছে।");
    } catch (err) {
      setError(err?.message || "নোটিফিকেশন চালু করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section push-notification-section">
      <h2>Push Notifications</h2>
      <p className="backup-description">
        এই ডিভাইসে অর্ডার ও জরুরি আপডেট পেতে Notification চালু করুন।
      </p>
      <button type="button" className="settings-save-button" onClick={handleEnable} disabled={busy}>
        {busy ? <BellRing size={18} /> : <Bell size={18} />}
        {busy ? "চালু হচ্ছে..." : "Enable Notifications"}
      </button>
      {message && <div className="settings-success">{message}</div>}
      {error && <div className="login-error">{error}</div>}
    </section>
  );
}
