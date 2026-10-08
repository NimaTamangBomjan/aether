"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

// Helps people keep GiftLedger one tap away. iPhones never offer to install a web app, so we show
// how; Android phones get a button that opens the phone's own "Install" prompt.

const DISMISSED_KEY = "gl_home_tip_dismissed";

type InstallPrompt = Event & { prompt: () => Promise<void> };

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function isIphoneBrowser(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function HomeScreenTip() {
  const [dismissed, setDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  // Only known in the browser; reading it this way avoids a server/browser mismatch.
  const iphone = useSyncExternalStore(
    () => () => {},
    () => isIphoneBrowser() && !readDismissed(),
    () => false,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!readDismissed()) setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || (!iphone && !installPrompt)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing: the tip just comes back next time.
    }
  };

  return (
    <aside aria-label="Add to home screen" className="relative rounded-xl border bg-secondary/50 p-4 pr-12">
      <p className="font-semibold">Keep GiftLedger one tap away</p>
      {installPrompt ? (
        <Button
          size="sm"
          className="mt-2"
          onClick={async () => {
            await installPrompt.prompt().catch(() => {});
            dismiss();
          }}
        >
          Add to home screen
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tap <Share aria-label="Share" className="inline size-4 align-text-bottom" /> at the bottom of Safari, then
          &ldquo;Add to Home Screen&rdquo;. It opens like an app.
        </p>
      )}
      <Button variant="ghost" size="icon" className="absolute top-1 right-1" aria-label="Hide this tip" onClick={dismiss}>
        <X aria-hidden />
      </Button>
    </aside>
  );
}
