"use client";

import { useCallback, useRef, useState } from "react";

// Cloudflare Turnstile: a privacy-friendly "are you a person?" check, so nobody can use the
// sign-in form to send floods of emails. Off until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; switch
// it on in Supabase too (Authentication → Attack Protection → CAPTCHA, provider Turnstile).
// Usually invisible: a checkbox only appears when Cloudflare isn't sure.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};
type Turnstile = {
  render: (element: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptLoad: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = null;
      reject(new Error("turnstile_unavailable"));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/**
 * Holds the check's one-time token. Put `<div ref={captcha.mount} />` where the check may appear
 * (it's usually invisible), and call `reset()` after each use: a token works once.
 */
export function useCaptcha() {
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const mount = useCallback((element: HTMLDivElement | null) => {
    if (!element || !SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widget.current = window.turnstile.render(element, {
          sitekey: SITE_KEY,
          action: "sign-in",
          appearance: "interaction-only",
          callback: (t) => {
            setToken(t);
            setFailed(false);
          },
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  return { enabled: Boolean(SITE_KEY), mount, token, failed, reset };
}
