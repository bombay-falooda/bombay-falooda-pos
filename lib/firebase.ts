// Bombay Falooda - Firebase Web Push Notification Client Helper

const VAPID_KEY = "BA7eNzrZTdgscKcCrpjDGE8Y1c3mzAWfVnQGbOyPsMm5uD3dAOg_pWigPKUD6DBnFanS0WzLqt_AYaLR_nrMTnk";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("Push Notifications are not supported in this browser environment");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was not granted by user:", permission);
      return null;
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
    }

    const token = JSON.stringify(subscription);
    console.log("🟢 Web Push Token registered successfully:", subscription.endpoint);
    return token;
  } catch (err) {
    console.error("Failed to register Web Push notification token:", err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string; data?: Record<string, unknown> }) => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type === "FCM_FOREGROUND_NOTIFICATION") {
      console.log("📩 Foreground push notification received:", event.data);
      callback(event.data);
    }
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
