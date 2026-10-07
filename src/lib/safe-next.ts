const FALLBACK = "/app";

// After signing in, people only ever need to land somewhere in the app or on an invite.
const ALLOWED = /^\/(app|join)(\/|\?|#|$)/;

/**
 * Only allow redirects to our own app pages. The check runs on the normalized result, so tricks
 * like "/.//evil.com" (which normalizes to "//evil.com") are rejected.
 */
export function safeNextPath(raw: string | null | undefined, fallback = FALLBACK): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const base = "http://local.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    const result = url.pathname + url.search + url.hash;
    if (result.startsWith("//") || result.startsWith("/\\") || !ALLOWED.test(result)) return fallback;
    return result;
  } catch {
    return fallback;
  }
}

/**
 * The sign-in email link carries where to go next either as `next` or inside `redirect_to`
 * (the address we asked Supabase to send people back to).
 */
export function nextFromConfirmParams(params: URLSearchParams, appUrl: string): string {
  const direct = params.get("next");
  if (direct) return safeNextPath(direct);
  const redirectTo = params.get("redirect_to");
  if (redirectTo) {
    try {
      const target = new URL(redirectTo);
      if (target.origin === new URL(appUrl).origin) return safeNextPath(target.searchParams.get("next"));
    } catch {
      // fall through
    }
  }
  return FALLBACK;
}
