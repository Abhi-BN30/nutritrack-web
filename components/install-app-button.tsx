"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

type InstallAppButtonProps = {
  className?: string;
  compactLabel?: string;
};

export function InstallAppButton({ className = "", compactLabel }: InstallAppButtonProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-medium text-[#4d5b4c] ${className}`}
      >
        App installed
      </span>
    );
  }

  if (!installEvent) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-dashed border-[#d8e2d5] px-3 py-2 text-sm text-[#6a7669] ${className}`}
      >
        Use browser menu to install the web app
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
      }}
      className={`inline-flex items-center gap-2 rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-semibold text-[#245b35] hover:bg-[#edf7ec] ${className}`}
    >
      <Download className="size-4" />
      {compactLabel ?? "Install app"}
    </button>
  );
}
