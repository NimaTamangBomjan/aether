import "server-only";
import { after } from "next/server";

export type ServerEvent =
  | "signed_up"
  | "person_added"
  | "gift_added"
  | "gift_status_changed"
  | "ideas_requested"
  | "idea_saved"
  | "invite_created"
  | "family_joined"
  | "checkout_started"
  | "pass_activated"
  | "pass_refunded"
  | "account_deleted";

/**
 * Records a product event in PostHog after the response is sent (never slows the page).
 * Only the random account id is sent: never names, emails or what people typed.
 * Does nothing until NEXT_PUBLIC_POSTHOG_KEY is set.
 */
export function trackServer(userId: string, event: ServerEvent, properties: Record<string, string | number | boolean> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  const send = async () => {
    try {
      await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: key, event, distinct_id: userId, properties: { ...properties, $process_person_profile: false } }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Analytics must never break the app.
    }
  };
  try {
    after(send);
  } catch {
    void send(); // outside a request (e.g. a script)
  }
}
