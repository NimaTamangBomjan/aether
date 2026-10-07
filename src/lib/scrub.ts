// Removes secrets that can appear in web addresses before anything leaves the app for
// analytics or error reports: invite tokens (/join/<token>, also when URL-encoded inside
// another address) and query strings or fragments (unsubscribe signatures, sign-in codes).

const JOIN_TOKEN = /\/join\/[^/?#\s"'&]+/g;
const JOIN_TOKEN_ENCODED = /%(?:25)*2Fjoin%(?:25)*2F[^%&\s"'/?#]+/gi;
const URL_QUERY = /(https?:\/\/[^\s?#"']*)[?#][^\s"']*/g;

/** Replaces invite tokens anywhere in a piece of text. */
export function scrubSecrets(text: string): string {
  return text.replace(JOIN_TOKEN, "/join/[token]").replace(JOIN_TOKEN_ENCODED, "%2Fjoin%2F[token]");
}

/** A web address or path without its query string, fragment or invite token. */
export function scrubUrl(url: string): string {
  return scrubSecrets(url.split(/[?#]/)[0]);
}

/** Free text (like an error message) with invite tokens and the query strings of any web addresses removed. */
export function scrubText(text: string): string {
  return scrubSecrets(text.replace(URL_QUERY, "$1"));
}

/** Analytics properties: every text value is cleaned, and anything that looks like an address loses its query string. */
export function scrubProperties<T extends Record<string, unknown>>(props: T): T {
  const out: Record<string, unknown> = { ...props };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== "string") continue;
    out[key] = /^(https?:\/\/|\/)/.test(value) ? scrubUrl(value) : scrubText(value);
  }
  return out as T;
}

/** Pages whose address itself is a secret, or that belong to someone else's email: never tracked. */
export function isPrivatePath(path: string): boolean {
  return /^\/(join|unsubscribe|auth)(\/|$)/.test(path);
}
