import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyA_B4s-fbAiVSuPvdZWEum8xnRscJ5IcWo",
  authDomain: "bombay-falooda-10639.firebaseapp.com",
  projectId: "bombay-falooda-10639",
  storageBucket: "bombay-falooda-10639.firebasestorage.app",
  messagingSenderId: "594662082129",
  appId: "1:594662082129:web:214a25b821a74787ea9a70",
};

const VAPID_KEY = "BA7eNzrZTdgscKcCrpjDGE8Y1c3mzAWfVnQGbOyPsMm5uD3dAOg_pWigPKUD6DBnFanS0WzLqt_AYaLR_nrMTnk";

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Notifications not supported in this browser environment");
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("Firebase Messaging is not supported in this browser");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was not granted:", permission);
      return null;
    }

    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("🟢 FCM Web Push Token registered:", token);
    return token;
  } catch (err) {
    console.error("Failed to get FCM push token:", err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === "undefined") return () => {};
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log("📩 Foreground push notification received:", payload);
      callback(payload);
    });
  } catch (err) {
    console.warn("Could not register onMessage listener:", err);
    return () => {};
  }
}
