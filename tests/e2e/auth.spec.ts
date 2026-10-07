import { codeFrom, emailCount, expect, latestEmail, linkFrom, signInWithCode, test, uniqueEmail } from "./helpers";

test("a signed-out visitor opening a private page is sent to sign in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp/);
  await expect(page.getByRole("heading", { name: "Sign in or create your account" })).toBeVisible();
});

test("new user signs up with the emailed code and lands in the app", async ({ page }) => {
  const email = uniqueEmail("code");
  await signInWithCode(page, email);
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expect(page.getByRole("heading", { name: /^Welcome, code-/ })).toBeVisible();
});

test("the email link works even in a different browser", async ({ page, browser }) => {
  const email = uniqueEmail("link");
  const before = await emailCount(email);
  await page.goto("/sign-in?next=/app");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  const link = linkFrom(await latestEmail(email, before));

  const otherBrowser = await browser.newContext();
  const other = await otherBrowser.newPage();
  await other.goto(link);
  await expect(other).toHaveURL(/\/app\/welcome$/);
  await expect(other.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  await otherBrowser.close();
});

test("a used or broken link explains what to do", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nope&type=email");
  await expect(page).toHaveURL(/\/sign-in\?error=link/);
  await expect(page.getByText("That sign-in link has expired or was already used.")).toBeVisible();
});

test("wrong input gets a friendly message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid email address." })).toBeVisible();

  const email = uniqueEmail("wrong");
  const before = await emailCount(email);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  const real = codeFrom(await latestEmail(email, before));
  const wrong = real === "000000" ? "111111" : "000000";
  await page.getByLabel("6-digit code").fill(wrong);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That code didn't work" })).toBeVisible();
});

test("signing out ends the session", async ({ page }) => {
  await signInWithCode(page, uniqueEmail("signout"));
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("tap targets on the sign-in screen are at least 44px tall", async ({ page }) => {
  await page.goto("/sign-in");
  for (const el of [page.getByLabel("Your email"), page.getByRole("button", { name: "Email me a sign-in code" })]) {
    const box = await el.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
