import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { addDays, todayInTimeZone } from "../../src/lib/dates";
import { addPerson, adminClient, expect, newUserOnDashboard, quickAddGift, test, userIdFor } from "./helpers";

const FAKE_EMAIL = "http://127.0.0.1:4011";
const CRON = "test-cron-secret-0123456789";

type SentEmail = { to: string[]; subject: string; text: string; html: string; headers: Record<string, string> };
async function emailsTo(address: string): Promise<SentEmail[]> {
  const all = (await (await fetch(`${FAKE_EMAIL}/emails`)).json()) as SentEmail[];
  return all.filter((e) => e.to.includes(address));
}
async function waitForEmail(address: string, subject: RegExp) {
  for (let i = 0; i < 40; i++) {
    const found = (await emailsTo(address)).find((e) => subject.test(e.subject));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email "${subject}" to ${address}`);
}

async function grantPass(baseURL: string, email: string) {
  const userId = await userIdFor(email);
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${randomUUID()}`, object: "checkout.session", mode: "payment", payment_status: "paid",
        client_reference_id: userId, metadata: { app: "giftledger", user_id: userId },
        payment_intent: `pi_${randomUUID()}`, amount_total: 999, currency: "usd",
      },
    },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_local_test_secret_not_real" });
  const res = await fetch(`${baseURL}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": header }, body: payload });
  expect(res.status).toBe(200);
}

async function runCron(baseURL: string, secret = CRON) {
  return fetch(`${baseURL}/api/cron/reminders`, { headers: { authorization: `Bearer ${secret}` } });
}

test("welcome and Season Pass thank-you emails", async ({ page, baseURL }) => {
  const email = await newUserOnDashboard(page, "welcome");
  const welcome = await waitForEmail(email, /^Welcome to GiftLedger$/);
  expect(welcome.text).toContain("/app");

  await grantPass(baseURL!, email);
  const receipt = await waitForEmail(email, /Season Pass is active/);
  expect(receipt.text).toContain("$9.99");
  expect(receipt.text).toContain("Jan 31, 2027");
});

test("the daily job emails a bundled return reminder once, with a working unsubscribe link", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const email = await newUserOnDashboard(page, "reminder");
  await grantPass(baseURL!, email);
  await addPerson(page, "Grandpa");
  await quickAddGift(page, "Fleece vest", "45");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).last().click();
  const today = todayInTimeZone("America/New_York");
  await page.getByLabel("Return by").fill(addDays(today, 3));
  await page.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByRole("heading", { name: "Grandpa", level: 1 })).toBeVisible();

  expect((await runCron(baseURL!, "wrong-secret")).status).toBe(401);
  expect((await fetch(`${baseURL}/api/cron/reminders`)).status).toBe(401);

  expect((await runCron(baseURL!)).status).toBe(200);
  const reminder = await waitForEmail(email, /^GiftLedger: return by .* Fleece vest$/);
  expect(reminder.text).toContain("Fleece vest for Grandpa");
  // Email apps show their own "Unsubscribe" button, which posts to this address (one-click, RFC 8058).
  expect(reminder.headers["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost:\d+\/api\/unsubscribe\?u=[^>]+>$/);
  expect(reminder.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

  // Running it again the same day sends nothing extra.
  expect((await runCron(baseURL!)).status).toBe(200);
  await page.waitForTimeout(500);
  expect((await emailsTo(email)).filter((e) => /Fleece vest/.test(e.subject))).toHaveLength(1);

  const userId = await userIdFor(email);
  const remindersOn = async () =>
    (await adminClient().from("profiles").select("email_reminders").eq("id", userId).single()).data?.email_reminders;

  // The email app's one-click button really unsubscribes.
  const oneClick = await fetch(reminder.headers["List-Unsubscribe"].slice(1, -1), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  expect(oneClick.status).toBe(200);
  expect(await remindersOn()).toBe(false);

  // So does the link in the email body.
  await adminClient().from("profiles").update({ email_reminders: true }).eq("id", userId);
  const link = reminder.text.match(/Unsubscribe from reminders: (\S+)/)![1];
  await page.goto(link);
  await page.getByRole("button", { name: "Unsubscribe from reminders" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
  expect(await remindersOn()).toBe(false);
});

test("a tampered unsubscribe link does nothing", async ({ page }) => {
  await page.goto(`/unsubscribe?u=${randomUUID()}&s=forged`);
  await page.getByRole("button", { name: "Unsubscribe from reminders" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This unsubscribe link didn't work." })).toBeVisible();
});

test("the owner can email an invite link, but not spam people with it", async ({ page }) => {
  await newUserOnDashboard(page, "inviter");
  await page.goto("/app/settings");
  await page.getByLabel("Your name").fill("Maria");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.goto("/app/family");
  const invitee = () => `invitee-${randomUUID().slice(0, 8)}@test.giftledger.local`;
  const send = async (address: string) => {
    await page.getByLabel("Or email an invite").fill(address);
    await page.getByRole("button", { name: "Send" }).click();
  };

  const first = invitee();
  await send(first);
  await expect(page.getByText(`Invite sent to ${first}.`)).toBeVisible();
  const mail = await waitForEmail(first, /^You're invited to a family gift list on GiftLedger$/);
  expect(mail.text).toMatch(/\/join\/[A-Za-z0-9_-]{43}/);
  expect(mail.text).toContain("Maria invited you to their family gift list");
  expect(mail.text).not.toContain("Holidays 2026");

  // The same address can't be emailed twice.
  await send(first);
  await expect(page.getByRole("alert").filter({ hasText: "An invite was already emailed to this address." })).toBeVisible();
  expect(await emailsTo(first)).toHaveLength(1);

  // 3 invite emails a day on the free plan.
  for (const address of [invitee(), invitee()]) {
    await send(address);
    await expect(page.getByText(`Invite sent to ${address}.`)).toBeVisible();
  }
  const fourth = invitee();
  await send(fourth);
  await expect(page.getByRole("alert").filter({ hasText: "You've emailed all the invites you can today." })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await emailsTo(fourth)).toHaveLength(0);

  await send("not-an-email");
  await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid email address." })).toBeVisible();
});
