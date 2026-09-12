"use client";

import { useEffect, useState } from "react";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase";

export function PwaRegister() {
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermissionState("unsupported");
      return;
    }

    // Register offline SW
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("POS PWA SW registered:", reg.scope))
      .catch((err) => console.warn("POS PWA SW error:", err));

    setPermissionState(Notification.permission);

    if (Notification.permission === "default") {
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    } else if (Notification.permission === "granted") {
      void requestNotificationPermission();
    }

    const unsubscribe = onForegroundMessage((payload) => {
      console.log("🔔 Foreground notification in POS Terminal:", payload);
    });

    return () => unsubscribe();
  }, []);

  async function handleEnableNotifications() {
    setIsSubscribing(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setPermissionState("granted");
        setShowPrompt(false);
      } else {
        setPermissionState(Notification.permission);
        if (Notification.permission === "denied") {
          setShowPrompt(false);
        }
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    } finally {
      setIsSubscribing(false);
    }
  }

  if (!showPrompt || permissionState !== "default") {
    return null;
  }

  return (
    <aside
      aria-label="Notification permissions prompt"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-slate-900/95 text-white p-4 shadow-2xl border border-rose-500/30 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <span className="text-xl">🔔</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white leading-tight">Enable Live POS Order Alerts</h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Receive instant loud ringing and visual alerts whenever a new Zomato or online order is placed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              disabled={isSubscribing}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer disabled:opacity-50"
            >
              {isSubscribing ? "Enabling..." : "Allow Notifications"}
            </button>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
