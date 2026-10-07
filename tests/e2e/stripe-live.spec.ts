import { expect, newUserOnDashboard, test } from "./helpers";

// Real Stripe Checkout in TEST mode. Runs only when Stripe test keys are configured and Stripe is
// reachable, with the Stripe CLI forwarding webhooks:
//   stripe listen --forward-to localhost:3000/api/stripe/webhook   (put its whsec_ in STRIPE_WEBHOOK_SECRET)
//   STRIPE_LIVE_TEST=1 npx playwright test tests/e2e/stripe-live.spec.ts --project desktop
const enabled = process.env.STRIPE_LIVE_TEST === "1";

async function payWith(page: import("@playwright/test").Page, card: string) {
  await page.getByRole("button", { name: "Upgrade for $9.99" }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.getByLabel("Card number").fill(card);
  await page.getByLabel("Expiration").fill("12 / 34");
  await page.getByLabel("CVC").fill("123");
  await page.getByLabel("Cardholder name").fill("Test Buyer");
  const zip = page.getByLabel("ZIP");
  if (await zip.count()) await zip.fill("10001");
  await page.getByTestId("hosted-payment-submit-button").click();
}

test.describe("real Stripe Checkout (test mode)", () => {
  test.skip(!enabled, "Set STRIPE_LIVE_TEST=1 with Stripe test keys to run");

  test("a test card pays and unlocks the Season Pass", async ({ page }) => {
    test.setTimeout(120_000);
    await newUserOnDashboard(page, "stripe-ok");
    await page.goto("/app/upgrade");
    await payWith(page, "4242 4242 4242 4242");
    await page.waitForURL(/\/app\/upgrade\/success/, { timeout: 60_000 });
    await expect(page.getByText("Your Season Pass is active through Jan 31, 2027.")).toBeVisible({ timeout: 30_000 });
  });

  test("a declined card shows Stripe's message and unlocks nothing", async ({ page }) => {
    test.setTimeout(120_000);
    await newUserOnDashboard(page, "stripe-declined");
    await page.goto("/app/upgrade");
    await payWith(page, "4000 0000 0000 0002");
    await expect(page.getByText(/declined/i)).toBeVisible({ timeout: 30_000 });
    await page.goto("/app/upgrade");
    await expect(page.getByRole("button", { name: "Upgrade for $9.99" })).toBeVisible();
  });
});
