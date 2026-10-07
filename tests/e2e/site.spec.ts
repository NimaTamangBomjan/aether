import { expect, test } from "./helpers";

test("the landing page has every section and leads to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stop overspending on holiday gifts.");
  for (const heading of ["Sound familiar?", "See every budget at a glance", "Ideas when you're stuck", "One list for the whole family", "How it works", "Simple pricing", "Questions"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByText("one time, through Jan 31, 2027")).toBeVisible();
  await page.getByText("Is the Season Pass a subscription?").click();
  await expect(page.getByText("It never renews.").first()).toBeVisible();
  await expect(page.getByText("Not designed for children under 13.")).toBeVisible();
  for (const img of await page.locator("main img").all()) {
    expect(await img.getAttribute("alt")).toBeTruthy();
  }
  await page.getByRole("link", { name: "Start free" }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("privacy policy and terms are linked from the footer and sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
  await expect(page.getByText("not designed for children under 13")).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI gift ideas" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();
  await expect(page.getByText("You must be 13 or older to create an account")).toBeVisible();
});

test("installable app and search engine files", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "GiftLedger", display: "standalone", start_url: "/app" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/apple-icon.png")).status()).toBe(200);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect(robots).toContain("Sitemap:");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/privacy");

  const og = await request.get("/opengraph-image");
  expect(og.headers()["content-type"]).toBe("image/png");
});

test("pages are sent with security headers", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});
