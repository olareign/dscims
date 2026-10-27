"use client";

import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** Shows an install button only when the browser says the app can be installed (PWA-1). */
export function InstallApp({ className = "btn g", label = "Install d-scims" }: { className?: string; label?: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (!event) return null;
  return (
    <button type="button" className={className} onClick={async () => { await event.prompt(); setEvent(null); }}>
      <DownloadSimple className="i s" aria-hidden /> {label}
    </button>
  );
}
