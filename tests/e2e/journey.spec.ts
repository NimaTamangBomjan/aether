import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { addDays, formatDate, todayInTimeZone } from "../../src/lib/dates";
import { expect, newBrowserContext, signInWithCode, test, uniqueEmail, userIdFor } from "./helpers";

// The launch checklist journey (CLAUDE.md §12):
// sign up → add person → AI ideas → save gift → invite family member → upgrade → reminder email sent.
// Without Stripe keys the payment step is Stripe's signed webhook (exactly what Stripe sends after
// a successful test-card payment). tests/e2e/stripe-live.spec.ts covers the real Checkout page.

const FAKE_EMAIL = "http://127.0.0.1:4011";

async function sentTo(address: string) {
  const all = (await (await fetch(`${FAKE_EMAIL}/emails`)).json()) as { to: string[]; subject: string; text: string }[];
  return all.filter((e) => e.to.includes(address));
}

test("the whole journey works end to end", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("journey");

  // 1. Sign up and onboarding: budget, first person, first AI ideas, save one.
  await signInWithCode(page, email);
  await page.getByLabel("Total budget").fill("500");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Name").fill("Grandma Rose");
  await page.getByLabel("Relationship").selectOption("Grandparent");
  await page.getByLabel("Budget for them").fill("60");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByTestId("idea")).toHaveCount(5);
  const firstIdea = (await page.getByTestId("idea").first().locator("p.font-semibold").first().textContent())!;
  await page.getByTestId("idea").first().getByRole("button", { name: "Save as gift idea" }).click();
  await expect(page.getByTestId("idea").first().getByText("Saved ✓")).toBeVisible();
  await page.getByRole("button", { name: "Done: go to Grandma Rose" }).click();
  await expect(page).toHaveURL(/\/app\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Grandma Rose", exact: true, level: 1 })).toBeVisible();
  const personUrl = page.url();

  // 2. Buy it, and record where and the return window.
  const gift = page.getByTestId("gift").filter({ hasText: firstIdea });
  await gift.getByRole("button", { name: "Mark bought" }).click();
  await expect(gift.getByText("Bought", { exact: true })).toBeVisible();
  await gift.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/app\/gifts\//);
  await page.getByLabel("Store").fill("Target");
  await page.getByLabel("Store").blur();
  const today = todayInTimeZone("America/New_York");
  await page.getByLabel("Return by").fill(addDays(today, 3));
  await page.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByText(`Return by ${formatDate(addDays(today, 3), today)} (3 days)`)).toBeVisible();

  // 3. Invite a family member, who joins from another phone.
  await page.goto("/app/family");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = new URL(await page.getByLabel("Send this link to one person").inputValue());
  const familyContext = await newBrowserContext(browser, { timezoneId: "America/New_York" });
  const alex = await familyContext.newPage();
  await signInWithCode(alex, uniqueEmail("journey-alex"), `/sign-in?next=${encodeURIComponent(invite.pathname)}`);
  await alex.getByLabel("Your name").fill("Alex");
  await alex.getByRole("button", { name: "Join the list" }).click();
  await expect(alex.getByRole("link", { name: /Grandma Rose/ })).toBeVisible();

  // 4. Upgrade: Stripe confirms the payment with a signed webhook; the waiting page unlocks.
  await page.goto("/app/upgrade");
  await expect(page.getByRole("button", { name: "Upgrade for $9.99" })).toBeVisible();
  await page.goto("/app/upgrade/success?session_id=cs_test_journey");
  const userId = await userIdFor(email);
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: `cs_test_${randomUUID()}`, object: "checkout.session", mode: "payment", payment_status: "paid",
        client_reference_id: userId, metadata: { app: "giftledger", user_id: userId },
        payment_intent: `pi_${randomUUID()}`, amount_total: 999, currency: "usd",
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_local_test_secret_not_real" });
  const webhook = await fetch(`${baseURL}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload });
  expect(webhook.status).toBe(200);
  await expect(page.getByText("Your Season Pass is active through Jan 31, 2027.")).toBeVisible({ timeout: 10_000 });

  // 5. The daily job sends the return reminder.
  const cron = await fetch(`${baseURL}/api/cron/reminders`, { headers: { authorization: "Bearer test-cron-secret-0123456789" } });
  expect(cron.status).toBe(200);
  await expect
    .poll(async () => (await sentTo(email)).map((e) => e.subject))
    .toEqual(expect.arrayContaining([`GiftLedger: return by ${formatDate(addDays(today, 3), today)} ${firstIdea}`]));
  const subjects = (await sentTo(email)).map((e) => e.subject);
  expect(subjects).toEqual(expect.arrayContaining(["Welcome to GiftLedger", "GiftLedger: your Season Pass is active"]));

  // The family member sees the purchase, so nobody buys it twice.
  await alex.goto(personUrl);
  await expect(alex.getByTestId("gift").filter({ hasText: firstIdea }).getByText("Bought", { exact: true })).toBeVisible();
  await familyContext.close();
});
