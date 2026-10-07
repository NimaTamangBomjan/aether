import { addPerson, adminClient, expect, newBrowserContext, newUserOnDashboard, quickAddGift, signInWithCode, test } from "./helpers";
import type { Browser } from "@playwright/test";

async function joinFromLink(browser: Browser, url: string, label: string) {
  const context = await newBrowserContext(browser, { timezoneId: "America/New_York" });
  const page = await context.newPage();
  const email = `${label}-${Math.random().toString(36).slice(2, 10)}@test.giftledger.local`;
  await signInWithCode(page, email, `/sign-in?next=${encodeURIComponent(new URL(url).pathname)}`);
  await page.getByLabel("Your name").fill(label);
  await page.getByRole("button", { name: "Join the list" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return { page, context, email };
}

test("settings: name, time zone and reminder emails are saved", async ({ page }) => {
  await newUserOnDashboard(page, "settings");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Your name").fill("Maria");
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByLabel(/Return reminder emails/).uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("Maria");
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Chicago");
  await expect(page.getByLabel(/Return reminder emails/)).not.toBeChecked();

  await page.getByLabel("Your name").fill("");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Add the name your family sees.")).toBeVisible();

  // Family members and invited people see this name, so it can't hold a web address.
  await page.getByLabel("Your name").fill("Claim your prize at www.evil.example");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Names can't include web or email addresses.")).toBeVisible();
});

test("export gives a CSV of what you can see, never a gift hidden from you", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "exporter");
  await addPerson(page, "Grandma, \"Nana\"", "60");
  await quickAddGift(page, "Bird feeder", "24.99");
  await quickAddGift(page, "Surprise quilt", "55");
  await page.goto("/app/family");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Send this link to one person").inputValue();
  const member = await joinFromLink(browser, invite, "Exportmember");

  // Hide the quilt from the member.
  await page.goto("/app");
  await page.getByRole("link", { name: /Grandma/ }).click();
  await page.getByTestId("gift").filter({ hasText: "Surprise quilt" }).getByRole("link", { name: "Edit" }).click();
  await page.getByRole("checkbox", { name: "Exportmember" }).check();
  await page.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByText("Hidden from Exportmember")).toBeVisible();

  const ownerCsv = await (await page.request.get("/api/export")).text();
  expect(ownerCsv).toContain('"Grandma, ""Nana"""');
  expect(ownerCsv).toContain("Bird feeder,Idea,24.99");
  expect(ownerCsv).toContain("Surprise quilt");

  const response = await member.page.request.get("/api/export");
  expect(response.headers()["content-type"]).toContain("text/csv");
  const memberCsv = await response.text();
  expect(memberCsv).toContain("Bird feeder");
  expect(memberCsv).not.toContain("Surprise quilt");
  await member.context.close();
});

test("signed-out visitors can't export anything", async ({ request }) => {
  const res = await request.get("/api/export", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(res.status());
  expect(res.headers()["location"]).toContain("/sign-in");
});

test("deleting an account removes it, and signing in again starts fresh", async ({ page }) => {
  const email = await newUserOnDashboard(page, "deleter");
  await addPerson(page, "Old person");
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Delete forever" })).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/goodbye$/);
  await expect(page.getByRole("heading", { name: "Your account has been deleted" })).toBeVisible();

  await signInWithCode(page, email);
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page.getByText("Old person")).toHaveCount(0);
});

test("an owner who deletes their account hands the shared list to the member they choose", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "leaver");
  await addPerson(page, "Shared person");
  await page.goto("/app/family");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Send this link to one person").inputValue();
  const heir = await joinFromLink(browser, invite, "Heir");

  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByLabel(/Who should take over/)).toHaveValue(/.+/);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/goodbye$/);

  const h = heir.page;
  await h.goto("/app");
  await expect(h.getByRole("link", { name: /Shared person/ })).toBeVisible();
  await expect(h.getByRole("link", { name: "Add person" })).toBeVisible(); // owner powers now
  const { count } = await adminClient().from("list_members").select("*", { count: "exact", head: true }).eq("role", "owner");
  expect(count).toBeGreaterThan(0);
  await heir.context.close();
});
