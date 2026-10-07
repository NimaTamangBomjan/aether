import { describe, expect, it } from "vitest";
import { escapeHtml, inviteEmail, passReceiptEmail, reminderEmail, welcomeEmail } from "./templates";
import { unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe";

describe("emails", () => {
  it("escape anything people typed", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    const mail = inviteEmail({ inviterName: "<b>Eve</b>", listName: "Holidays & more", inviteUrl: "https://g.app/join/abc" });
    expect(mail.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Eve</b>");
    expect(mail.subject).toContain("GiftLedger");
  });

  it("every email names the app in the subject", () => {
    for (const mail of [
      welcomeEmail({ name: "Maria", appUrl: "https://g.app" }),
      inviteEmail({ inviterName: "Maria", listName: "Holidays 2026", inviteUrl: "https://g.app/join/x" }),
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
});
