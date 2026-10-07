import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

describe("error reports", () => {
  it("never carry cookies, headers, request bodies, query strings, invite tokens or emails", () => {
    const event = {
      type: undefined,
      request: {
        url: "https://giftledger.app/join/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde?next=/app&email=m@x.com",
        cookies: { "sb-access-token": "secret" },
        headers: { authorization: "Bearer secret", cookie: "a=b" },
        data: { email: "maria@example.com" },
        query_string: "email=maria@example.com",
      },
      user: { id: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a", email: "maria@example.com", ip_address: "1.2.3.4" },
    } as unknown as ErrorEvent;
    const out = scrubSentryEvent(event);
    expect(out.request).toEqual({ url: "https://giftledger.app/join/[token]" });
    expect(out.user).toEqual({ id: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a" });
    expect(JSON.stringify(out)).not.toMatch(/maria|secret|1\.2\.3\.4/);
  });
});
