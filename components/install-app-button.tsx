"use client";

import { Download, ExternalLink, Share, Smartphone } from "lucide-react";
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

type BrowserKind = "ios" | "samsung" | "android-chrome" | "other";

function getBrowserKind(): BrowserKind {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) return "ios";
  if (/Android/i.test(ua) && /SamsungBrowser/i.test(ua)) return "samsung";
  if (/Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua)) {
    return "android-chrome";
  }
  if (/Android/i.test(ua)) return "other";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton({ className = "", compactLabel }: InstallAppButtonProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [browser, setBrowser] = useState<BrowserKind>("other");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());
    setBrowser(getBrowserKind());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowInstructions(false);
      setMessage("LCHF has been installed successfully.");
    };

    const onDisplayModeChange = () => {
      if (isStandalone()) setInstalled(true);
    };

    const displayMode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  if (installed) {
    return message ? <p className={`text-sm text-[#245b35] ${className}`}>{message}</p> : null;
  }

  const openChrome = () => {
    const url = window.location.href;
    const withoutProtocol = url.replace(/^https?:\/\//i, "");
    window.location.href = `intent://${withoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const handleInstall = async () => {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        setInstallEvent(null);
        if (choice.outcome === "accepted") {
          setShowInstructions(false);
        } else {
          setMessage("Installation was not completed. You can try again from your browser menu.");
          setShowInstructions(true);
        }
        return;
      } catch {
        setMessage("Please use your browser menu to install LCHF.");
        setShowInstructions(true);
        return;
      }
    }
    setShowInstructions((value) => !value);
  };

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-semibold text-[#245b35] hover:bg-[#edf7ec]"
        aria-expanded={showInstructions}
      >
        <Download className="size-4" />
        {compactLabel ?? "Install LCHF"}
      </button>

      {showInstructions && (
        <div className="w-full max-w-sm rounded-xl border border-[#d8e2d5] bg-white p-4 text-sm leading-6 text-[#405044] shadow-sm">
          {browser === "ios" ? (
            <>
              <p className="mb-2 flex items-center gap-2 font-semibold text-[#245b35]">
                <Share className="size-4" /> Add LCHF to your iPhone or iPad
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Open this page in Safari.</li>
                <li>Tap the Share button (the square with the upward arrow).</li>
                <li>Scroll down and choose “Add to Home Screen”.</li>
                <li>Tap “Add”. LCHF will appear on your Home Screen.</li>
              </ol>
              <p className="mt-2 text-xs text-[#6a7669]">
                If you are using another iPhone browser, open this page in Safari first.
              </p>
            </>
          ) : browser === "samsung" ? (
            <>
              <p className="mb-2 flex items-center gap-2 font-semibold text-[#245b35]">
                <Smartphone className="size-4" /> Install using Google Chrome
              </p>
              <p>
                Samsung Internet may show an Android compatibility warning during installation.
                For the recommended installation route, open this same page in Google Chrome.
              </p>
              <button
                type="button"
                onClick={openChrome}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#245b35] px-3 py-2 font-semibold text-white hover:bg-[#1c482a]"
              >
                Open in Chrome <ExternalLink className="size-4" />
              </button>
              <p className="mt-2 text-xs text-[#6a7669]">
                If Chrome is not installed, install it from Google Play. Do not bypass a security warning if Chrome also displays one.
              </p>
            </>
          ) : browser === "android-chrome" ? (
            <>
              <p className="mb-2 font-semibold text-[#245b35]">Install LCHF from Chrome</p>
              <p>
                If the installation prompt did not appear, tap Chrome’s three-dot menu and choose
                “Install app” or “Add to Home screen”, then confirm.
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 font-semibold text-[#245b35]">Add LCHF to your device</p>
              <p>
                Open this website in your browser menu and look for “Install app” or “Add to Home
                screen”. On iPhone or iPad, use Safari’s Share menu and choose “Add to Home Screen”.
              </p>
            </>
          )}
          {message && <p className="mt-2 text-xs text-[#6a7669]">{message}</p>}
        </div>
      )}
    </div>
  );
}
