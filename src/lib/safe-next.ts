const FALLBACK = "/app";

/** Only allow redirects to paths on our own site (blocks "//evil.com" and full URLs). */
export function safeNextPath(raw: string | null | undefined, fallback = FALLBACK): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const base = "http://local.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
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
