import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubSentryEvent } from "./sentry-scrub";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

describe("error reports", () => {
  it("never carry cookies, headers, request bodies, query strings, invite tokens or emails", () => {
    const event = {
      type: undefined,
      request: {
        url: `https://giftledger.app/join/${TOKEN}?next=/app&email=m@x.com`,
        cookies: { "sb-access-token": "secret" },
        headers: { authorization: "Bearer secret", cookie: "a=b" },
        data: { email: "maria@example.com" },
        query_string: "email=maria@example.com",
      },
      user: { id: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a", email: "maria@example.com", ip_address: "1.2.3.4" },
      transaction: `GET /join/${TOKEN}`,
      contexts: { nextjs: { request_path: `/join/${TOKEN}?x=1`, router_kind: "App Router" } },
      exception: { values: [{ type: "Error", value: `Failed on /join/${TOKEN}` }] },
      breadcrumbs: [
        { category: "navigation", data: { from: "/unsubscribe?u=1&s=signature", to: `/join/${TOKEN}` } },
        { category: "fetch", data: { url: `http://x/auth/v1/otp?redirect_to=%252Fjoin%252F${TOKEN}`, method: "POST" } },
        { category: "ui.click", message: "button[aria-label='Budget used for Grandma Rose']" },
      ],
    } as unknown as ErrorEvent;
    const out = scrubSentryEvent(event);
    expect(out.request).toEqual({ url: "https://giftledger.app/join/[token]" });
    expect(out.user).toEqual({ id: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a" });
    expect(out.contexts?.nextjs?.request_path).toBe("/join/[token]");
    expect(out.breadcrumbs).toHaveLength(2);
    expect(JSON.stringify(out)).not.toMatch(new RegExp(`maria|secret|1\\.2\\.3\\.4|${TOKEN}|signature|Grandma`));
  });

  it("drop clicks and typing from the trail, and keep only paths for page changes and network calls", () => {
    expect(scrubBreadcrumb({ category: "ui.click", message: "Remove hiking" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.input", message: "input#name" })).toBeNull();
    const nav = scrubBreadcrumb({ category: "navigation", data: { from: "/auth/callback?code=abc", to: "/app" } }) as Breadcrumb;
    expect(nav.data).toEqual({ from: "/auth/callback", to: "/app" });
    const xhr = scrubBreadcrumb({ category: "xhr", data: { url: "https://x/api/unsubscribe?u=1&s=sig", status_code: 200 } }) as Breadcrumb;
    expect(xhr.data).toEqual({ url: "https://x/api/unsubscribe", status_code: 200 });
  });
});
