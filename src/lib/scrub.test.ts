import { describe, expect, it } from "vitest";
import { isPrivatePath, scrubProperties, scrubText, scrubUrl } from "./scrub";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

describe("scrubbing secrets from addresses", () => {
  it("removes invite tokens, query strings and fragments", () => {
    expect(scrubUrl(`https://giftledger.app/join/${TOKEN}?next=/app#x`)).toBe("https://giftledger.app/join/[token]");
    expect(scrubUrl(`/join/${TOKEN}`)).toBe("/join/[token]");
    expect(scrubUrl("/unsubscribe?u=1&s=signature")).toBe("/unsubscribe");
    expect(scrubUrl("/auth/callback?code=secret-code")).toBe("/auth/callback");
    expect(scrubUrl("/app/people")).toBe("/app/people");
  });

  it("finds invite tokens inside other addresses, even when encoded twice", () => {
    const once = `https://x.supabase.co/auth/v1/otp?redirect_to=http%3A%2F%2Fapp%2Fjoin%2F${TOKEN}`;
    const twice = `redirect_to=http%253A%252F%252Fapp%252Fauth%252Fconfirm%253Fnext%253D%252Fjoin%252F${TOKEN}`;
    expect(scrubText(once)).not.toContain(TOKEN);
    expect(scrubText(twice)).not.toContain(TOKEN);
    expect(scrubText(`Error loading /join/${TOKEN} for user`)).toBe("Error loading /join/[token] for user");
  });

  it("cleans every text property sent to analytics", () => {
    const out = scrubProperties({
      $current_url: `https://giftledger.app/join/${TOKEN}`,
      $pathname: `/join/${TOKEN}`,
      $referrer: "https://giftledger.app/unsubscribe?u=1&s=sig",
      $initial_current_url: "https://giftledger.app/auth/confirm?token_hash=abc",
      $browser: "Chrome",
      count: 3,
    });
    expect(JSON.stringify(out)).not.toMatch(new RegExp(`${TOKEN}|sig|token_hash`));
    expect(out).toMatchObject({ $pathname: "/join/[token]", $browser: "Chrome", count: 3 });
  });

  it("knows which pages are never tracked", () => {
    expect(isPrivatePath(`/join/${TOKEN}`)).toBe(true);
    expect(isPrivatePath("/unsubscribe")).toBe(true);
    expect(isPrivatePath("/auth/confirm")).toBe(true);
    expect(isPrivatePath("/app")).toBe(false);
    expect(isPrivatePath("/joint-gifts")).toBe(false);
  });
});
