import { describe, expect, it } from "vitest";
import { oneLine } from "../validation";
import { escapeHtml, inviteEmail, passReceiptEmail, plainName, reminderEmail, welcomeEmail } from "./templates";
import { oneClickUnsubscribeUrl, unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe";

describe("emails", () => {
  it("escape anything people typed", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    const mail = welcomeEmail({ name: "<b>Eve</b>", appUrl: "https://g.app" });
    expect(mail.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Eve</b>");
  });

  it("invites carry no text a stranger chose, apart from a plain first name", () => {
    const phishing = inviteEmail({ inviterName: "PayPal: verify at evil.example", inviteUrl: "https://g.app/join/abc" });
    expect(phishing.subject).toBe("You're invited to a family gift list on GiftLedger");
    expect(phishing.html + phishing.text).not.toMatch(/PayPal|evil/);
    expect(phishing.text).toContain("A family member invited you");
    const real = inviteEmail({ inviterName: "Mary-Jane O'Neil", inviteUrl: "https://g.app/join/abc" });
    expect(real.subject).toBe(phishing.subject);
    expect(real.text).toContain("Mary-Jane O'Neil invited you");
    expect(plainName("José")).toBe("José");
    for (const bad of ["Claim $500 gift card", "evil.example", "a\r\nBcc: x", "Visit http://x", "", "x".repeat(41)]) {
      expect(plainName(bad), bad).toBeNull();
    }
  });

  it("subjects are always one line", () => {
    expect(oneLine("GiftLedger: last day to return Scarf\r\nBcc: victim@evil.test\u2028x")).toBe(
      "GiftLedger: last day to return Scarf Bcc: victim@evil.test x",
    );
  });

  it("every email names the app in the subject", () => {
    for (const mail of [
      welcomeEmail({ name: "Maria", appUrl: "https://g.app" }),
      inviteEmail({ inviterName: "Maria", inviteUrl: "https://g.app/join/x" }),
      passReceiptEmail({ name: "Maria", amountCents: 999, appUrl: "https://g.app" }),
    ]) {
      expect(mail.subject).toContain("GiftLedger");
      expect(mail.text.length).toBeGreaterThan(20);
    }
  });

  it("the receipt shows the amount and the end date", () => {
    const mail = passReceiptEmail({ name: "", amountCents: 999, appUrl: "https://g.app" });
    expect(mail.text).toContain("$9.99");
    expect(mail.text).toContain("Jan 31, 2027");
  });

  it("the reminder bundles last-day and 3-day items with an unsubscribe link", () => {
    const mail = reminderEmail({
      name: "Maria",
      today: "2026-12-20",
      appUrl: "https://g.app",
      unsubscribeUrl: "https://g.app/unsubscribe?u=1&s=2",
      items: [
        { giftTitle: "Scarf", recipientName: "Grandma", store: "Target", returnBy: "2026-12-20", daysLeft: 0 },
        { giftTitle: "Lego set", recipientName: "Mateo", store: null, returnBy: "2026-12-23", daysLeft: 3 },
      ],
    });
    expect(mail.subject).toBe("GiftLedger: 2 gifts to return soon");
    expect(mail.text).toContain("Last day to return:\n- Scarf for Grandma (Target): return by Dec 20");
    expect(mail.text).toContain("Return window closes in 3 days:\n- Lego set for Mateo: return by Dec 23");
    expect(mail.html).toContain("Unsubscribe from reminders");
    const single = reminderEmail({ ...{ name: "", today: "2026-12-20", appUrl: "x", unsubscribeUrl: "y" }, items: [{ giftTitle: "Scarf", recipientName: "G", store: null, returnBy: "2026-12-20", daysLeft: 0 }] });
    expect(single.subject).toBe("GiftLedger: last day to return Scarf");
  });
});

describe("unsubscribe links", () => {
  const id = "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a";
  it("verify only with the right signature", () => {
    const url = new URL(unsubscribeUrl("https://g.app", id, "secret-one-1234567"));
    const sig = url.searchParams.get("s")!;
    expect(verifyUnsubscribe(id, sig, "secret-one-1234567")).toBe(true);
    expect(verifyUnsubscribe(id, sig, "another-secret-123")).toBe(false);
    expect(verifyUnsubscribe("6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5b", sig, "secret-one-1234567")).toBe(false);
    expect(verifyUnsubscribe(id, "", "secret-one-1234567")).toBe(false);
  });

  it("email apps' own unsubscribe button posts to the endpoint that does the work", () => {
    const page = new URL(unsubscribeUrl("https://g.app", id, "secret-one-1234567"));
    const oneClick = new URL(oneClickUnsubscribeUrl("https://g.app", id, "secret-one-1234567"));
    expect(page.pathname).toBe("/unsubscribe");
    expect(oneClick.pathname).toBe("/api/unsubscribe");
    expect(oneClick.search).toBe(page.search);
  });
});
