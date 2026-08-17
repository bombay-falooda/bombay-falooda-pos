"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("POS PWA ServiceWorker registered:", reg.scope))
        .catch((err) => console.log("POS PWA ServiceWorker error:", err));
    }
  }, []);

  return null;
}
