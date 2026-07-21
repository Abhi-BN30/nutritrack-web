"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  });
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowFallback(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isAndroidLike = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /android/i.test(navigator.userAgent);
  }, []);

  if (installed) {
    return null;
  }

  if (installEvent) {
    return (
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          if (choice.outcome !== "accepted") {
            setShowFallback(true);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-semibold text-[#245b35] hover:bg-[#edf7ec] ${className}`}
      >
        <Download className="size-4" />
        {compactLabel ?? "Install app"}
      </button>
    );
  }

  if (!isAndroidLike) {
    return null;
  }

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setShowFallback((value) => !value)}
        className="inline-flex items-center gap-2 rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-semibold text-[#245b35] hover:bg-[#edf7ec]"
      >
        <Download className="size-4" />
        {compactLabel ?? "Install app"}
      </button>
      {showFallback ? (
        <p className="max-w-xs text-xs leading-5 text-[#6a7669]">
          If install is not shown automatically, open your browser menu and choose <span className="font-semibold text-[#245b35]">Install app</span> or <span className="font-semibold text-[#245b35]">Add to Home screen</span>.
        </p>
      ) : null}
    </div>
  );
}
