"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EVERY_MS = 30_000;

/**
 * Keeps a shared list current: when a family member marks something bought, it shows up here
 * within half a minute, and right away when you come back to the app. Pauses while the app is
 * in the background.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return null;
}
