"use client";

import { useEffect, useState } from "react";

// Registers the service worker and shows a banner while offline (PWA-2).
export function PwaRegister() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker registration failed", err));
    }
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="offline-banner">
      You are offline. Saved screens still open; actions that need the server are switched off.
    </div>
  );
}
