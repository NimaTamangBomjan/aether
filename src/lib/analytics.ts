"use client";

// Page-view analytics with PostHog, set up to be privacy-friendly:
// - only when NEXT_PUBLIC_POSTHOG_KEY is set;
// - PostHog's cookieless mode: no cookies, local or session storage, so no cookie banner is needed
//   (turn "cookieless" on in the PostHog project settings, or these events are dropped);
// - no autocapture (clicks could contain people's names), no session recordings, no extra scripts;
// - the browser never identifies anyone. Product events (sign-up, ideas, upgrades) are sent from
//   the server by random account id only: see analytics-server.ts.
// The library loads after the page is idle, so it never slows the first view.

type PostHog = typeof import("posthog-js").default;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let client: Promise<PostHog | null> | null = null;

function load(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      cookieless_mode: "always",
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      ip: false,
      sanitize_properties: (props) => {
        // Keep URLs without query strings (they can hold invite tokens or emails).
        for (const key of ["$current_url", "$referrer", "$initial_referrer"]) {
          if (typeof props[key] === "string") props[key] = String(props[key]).split("?")[0].replace(/\/join\/[^/]+/, "/join/[token]");
        }
        return props;
      },
    });
    return posthog;
  });
  return client;
}

export function trackPageview(path: string) {
  void load().then((ph) => ph?.capture("$pageview", { $current_url: window.location.origin + path }));
}
