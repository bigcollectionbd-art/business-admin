import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "";

function decodeBase64Url(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function getPushSupport() {
  if (!isMobileDevice() || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { supported: false, enabled: false };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return { supported: true, enabled: Boolean(subscription) };
  } catch {
    return { supported: false, enabled: false };
  }
}

export async function enablePushNotifications() {
  if (!isMobileDevice()) throw new Error("Notification শুধু Android ও iPhone মোবাইলে চালু করা যাবে।");
  if (!( "serviceWorker" in navigator) || !( "PushManager" in window)) {
    throw new Error("এই ব্রাউজারে Push Notification সমর্থিত নয়।");
  }
  if (!VAPID_PUBLIC_KEY) throw new Error("Preview-এর VAPID public key এখনো সেট করা হয়নি।");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission Allow করুন।");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY),
    });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("লগইন সেশন পাওয়া যায়নি।");

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Device subscription অসম্পূর্ণ।");
  }

  const { error } = await supabase.from("notification_push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device_label: navigator.userAgent.slice(0, 180),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from("notification_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
