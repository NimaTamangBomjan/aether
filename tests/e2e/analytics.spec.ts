import { addPerson, expect, newUserOnDashboard, quickAddGift, test, userIdFor } from "./helpers";

const FAKE_POSTHOG = "http://127.0.0.1:4012";

// PostHog ignores automated "headless" browsers (its bot filter), so present as a normal one.
test.use({
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
});
type Captured = { event: string; distinct_id?: string; properties: Record<string, unknown> };
async function events(): Promise<Captured[]> {
  return (await (await fetch(`${FAKE_POSTHOG}/events`)).json()) as Captured[];
}

test("analytics record key steps by random account id only, never emails or names", async ({ page, context }) => {
  test.setTimeout(60_000);
  // Automated browsers announce themselves (navigator.webdriver, "HeadlessChrome" brand) and PostHog
  // ignores them on purpose. Make this test browser look like an ordinary one.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  const email = await newUserOnDashboard(page, "analytics");
  const userId = await userIdFor(email);
  await addPerson(page, "Secret Name Person", "50");
  await quickAddGift(page, "Telescope", "45");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();

  await expect
    .poll(async () => (await events()).filter((e) => e.distinct_id === userId).map((e) => e.event))
    .toEqual(expect.arrayContaining(["signed_up", "person_added", "gift_added", "gift_status_changed"]));

  const mine = (await events()).filter((e) => e.distinct_id === userId);
  const everything = JSON.stringify(await events());
  expect(everything).not.toContain(email);
  expect(everything).not.toContain("Secret Name Person");
  expect(everything).not.toContain("Telescope");
  expect(mine.length).toBeGreaterThan(0);

  // Browser page views carry the path only.
  // The analytics library loads when the page is idle and sends page views in batches.
  await expect
    .poll(async () => (await events()).filter((e) => e.event === "$pageview").map((e) => String(e.properties.$current_url)), { timeout: 20_000 })
    .toEqual(expect.arrayContaining([expect.stringContaining("/app")]));
  for (const e of (await events()).filter((x) => x.event === "$pageview")) {
    expect(String(e.properties.$current_url ?? "")).not.toContain("?");
  }

  // Invite links are secrets: opening one sends nothing that contains it, in any property.
  const token = "InviteTokenForAnalyticsTestAbCdEfGhIjKlMnOp";
  await page.goto(`/join/${token}`);
  await page.waitForTimeout(2500);
  // Arrive at the next page from the invite page, so the browser reports it as the referrer.
  await page.goto("/app/settings", { referer: page.url() });
  await expect
    .poll(async () => (await events()).filter((e) => e.event === "$pageview" && String(e.properties.$current_url).endsWith("/app/settings")).length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  expect(JSON.stringify(await events())).not.toContain(token);
});

test("analytics set no cookies and store nothing in the browser", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForTimeout(3500);
  const cookies = await context.cookies();
  expect(cookies.filter((c) => /ph_|posthog/i.test(c.name))).toEqual([]);
  const stored = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
  expect(stored.filter((k) => /ph_|posthog/i.test(k))).toEqual([]);
});
