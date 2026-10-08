import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { addPerson, expect, newUserOnDashboard, test, userIdFor } from "./helpers";

const SECRET = "whsec_local_test_secret_not_real";

/** Sends an event to our webhook exactly as Stripe would, signed with the webhook secret. */
async function sendStripeEvent(baseURL: string, event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${baseURL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

function checkoutCompleted(userId: string, ids = { event: `evt_${randomUUID()}`, intent: `pi_${randomUUID()}` }) {
  return {
    id: ids.event,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${randomUUID()}`,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        client_reference_id: userId,
        metadata: { app: "giftledger", user_id: userId },
        payment_intent: ids.intent,
        amount_total: 999,
        currency: "usd",
      },
    },
  };
}

function chargeRefunded(intent: string, amountRefunded = 999) {
  return {
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "charge.refunded",
    data: { object: { id: `ch_${randomUUID()}`, object: "charge", payment_intent: intent, amount: 999, amount_refunded: amountRefunded } },
  };
}

test("the webhook rejects anything not signed by Stripe", async ({ baseURL }) => {
  const unsigned = await fetch(`${baseURL}/api/stripe/webhook`, { method: "POST", body: "{}" });
  expect(unsigned.status).toBe(400);
  const wrongSecret = await sendStripeEvent(baseURL!, checkoutCompleted(randomUUID()), "whsec_wrong");
  expect(wrongSecret.status).toBe(400);
});

test("paying unlocks the pass within seconds; a refund takes it away without hiding anything", async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const email = await newUserOnDashboard(page, "payer");
  const userId = await userIdFor(email);
  for (const name of ["A", "B", "C", "D", "E"]) await addPerson(page, name);
  await page.goto("/app");
  await expect(page.getByText("You've added 5 people.")).toBeVisible();

  // The success page alone unlocks nothing.
  await page.goto("/app/upgrade/success?session_id=cs_test_fake");
  await expect(page.getByText("Unlocking your Season Pass…")).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByText("Unlocking your Season Pass…")).toBeVisible();

  // Then Stripe's webhook arrives, and the waiting page notices on its own.
  const ids = { event: `evt_${randomUUID()}`, intent: `pi_${randomUUID()}` };
  const res = await sendStripeEvent(baseURL!, checkoutCompleted(userId, ids));
  expect(res.status).toBe(200);
  await expect(page.getByText("Your Season Pass is active through Jan 31, 2027.")).toBeVisible({ timeout: 10_000 });

  // The same event again is harmless.
  expect((await sendStripeEvent(baseURL!, checkoutCompleted(userId, ids))).status).toBe(200);

  await page.goto("/app");
  await expect(page.getByText("You've added 5 people.")).toHaveCount(0);
  await addPerson(page, "Sixth person");
  await page.goto("/app/upgrade");
  await expect(page.getByText("You have the Season Pass through Jan 31, 2027.")).toBeVisible();

  // Refunded through the Stripe dashboard: the pass goes, but all 6 people stay visible.
  expect((await sendStripeEvent(baseURL!, chargeRefunded(ids.intent))).status).toBe(200);
  await page.goto("/app");
  await expect(page.getByText("You've added 5 people.")).toBeVisible();
  for (const name of ["A", "B", "C", "D", "E", "Sixth person"]) {
    await expect(page.getByRole("main").getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
});

test("upgrading without Stripe keys explains that checkout isn't on yet", async ({ page }) => {
  await newUserOnDashboard(page, "nokeys");
  await page.goto("/app/upgrade");
  await expect(page.getByText("one time, good through Jan 31, 2027")).toBeVisible();
  await page.getByRole("button", { name: "Upgrade for $9.99" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Checkout isn't switched on yet." })).toBeVisible();
});

test("canceling checkout says you weren't charged", async ({ page }) => {
  await newUserOnDashboard(page, "cancel");
  await page.goto("/app/upgrade?canceled=1");
  await expect(page.getByText("Checkout canceled. You weren't charged.")).toBeVisible();
});

test("a family member's paid owner unlocks limits for the whole list", async ({ page, baseURL }) => {
  const email = await newUserOnDashboard(page, "family-pass");
  await sendStripeEvent(baseURL!, checkoutCompleted(await userIdFor(email)));
  await page.goto("/app/family");
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Send this link to one person")).toBeVisible();
  await page.getByRole("button", { name: "Make another link" }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Send this link to one person")).toBeVisible();
  await expect(page.getByText("Your free plan includes 1 family member.")).toHaveCount(0);
});
