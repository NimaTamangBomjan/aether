import type { Browser, Page } from "@playwright/test";
import { addPerson, expect, newUserOnDashboard, quickAddGift, signInWithCode, test, uniqueEmail } from "./helpers";

async function createInviteLink(owner: Page) {
  await owner.goto("/app/family");
  await owner.getByRole("button", { name: "Create invite link" }).click();
  const url = await owner.getByLabel("Send this link to one person").inputValue();
  expect(url).toMatch(/\/join\/[A-Za-z0-9_-]{43}$/);
  return url;
}

/** A second person, in their own browser, who signs up from the invite link and joins. */
async function joinAsNewMember(browser: Browser, inviteUrl: string, label = "member") {
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  const page = await context.newPage();
  const email = uniqueEmail(label);
  await page.goto(inviteUrl);
  await page.getByRole("link", { name: "Sign in to join" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fjoin%2F/);
  await signInWithCode(page, email, page.url());
  await expect(page.getByText(/invited you to join Holidays 2026/)).toBeVisible();
  const name = `${label} ${email.slice(label.length + 1, label.length + 5)}`;
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the list" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return { page, context, name };
}

test("owner invites a family member who joins, sees the list and marks a gift bought", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "fam-owner");
  await addPerson(page, "Grandma June", "100");
  const personUrl = page.url();
  await quickAddGift(page, "Wool scarf", "30");
  const invite = await createInviteLink(page);

  const member = await joinAsNewMember(browser, invite);
  const m = member.page;
  await expect(m.getByRole("link", { name: /Grandma June/ })).toBeVisible();
  await expect(m.getByRole("link", { name: "Add person" })).toHaveCount(0);
  await expect(m.getByRole("button", { name: /total budget/ })).toHaveCount(0);

  await m.getByRole("link", { name: /Grandma June/ }).click();
  await expect(m.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  await m.getByTestId("gift").filter({ hasText: "Wool scarf" }).getByRole("button", { name: "Mark bought" }).click();
  await expect(m.getByTestId("gift").filter({ hasText: "Wool scarf" }).getByText("Bought", { exact: true })).toBeVisible();

  await page.goto(personUrl);
  await expect(page.getByTestId("activity").first()).toContainText(`Marked bought by ${member.name}`);
  await page.goto("/app/family");
  await expect(page.getByText(member.name)).toBeVisible();
  await expect(page.getByText("Your free plan includes 1 family member.")).toBeVisible();

  // The same link can't be used twice.
  const third = await browser.newContext();
  const t = await third.newPage();
  await signInWithCode(t, uniqueEmail("third"), `/sign-in?next=${encodeURIComponent(new URL(invite).pathname)}`);
  await expect(t.getByRole("alert").filter({ hasText: "already used" })).toBeVisible();
  await third.close();
  await member.context.close();
});

test("a hidden gift never reaches that member: pages, page source, totals or direct links", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "hide-owner");
  await addPerson(page, "Dad", "300");
  const member = await joinAsNewMember(browser, await createInviteLink(page), "hide-member");

  await page.goto("/app");
  await page.getByRole("link", { name: /Dad/ }).click();
  await quickAddGift(page, "Secret watch", "200");
  const gift = page.getByTestId("gift").filter({ hasText: "Secret watch" });
  await gift.getByRole("button", { name: "Mark bought" }).click();
  await expect(gift.getByText("Bought", { exact: true })).toBeVisible();
  await gift.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/app\/gifts\/[0-9a-f-]{36}$/);
  const giftUrl = page.url();
  await page.getByRole("checkbox", { name: member.name }).check();
  await page.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByText(`Hidden from ${member.name}`)).toBeVisible();
  await page.goto("/app");
  await expect(page.getByTestId("total-spent")).toHaveText("$200");

  const m = member.page;
  await m.goto("/app");
  await expect(m.getByTestId("total-spent")).toHaveText("$0");
  await m.getByRole("link", { name: /Dad/ }).click();
  await expect(m.getByText("Secret watch")).toHaveCount(0);
  expect(await m.content()).not.toContain("Secret watch");
  expect((await m.goto(giftUrl))?.status()).toBe(404);
  expect(await m.content()).not.toContain("Secret watch");
  await member.context.close();
});

test("linking a person to a family member hides that person and all their gifts from them", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "link-owner");
  const member = await joinAsNewMember(browser, await createInviteLink(page), "link-member");

  await page.goto("/app/people/new");
  await page.getByLabel("Name", { exact: true }).fill("Sis");
  await page.getByLabel("Is this person on your family list?").selectOption({ label: `Yes, this is ${member.name}` });
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("heading", { name: "Sis", level: 1 })).toBeVisible();
  const personUrl = page.url();
  await quickAddGift(page, "Concert tickets", "120");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();

  const m = member.page;
  await m.goto("/app");
  await expect(m.getByText("Sis")).toHaveCount(0);
  await expect(m.getByTestId("total-spent")).toHaveText("$0");
  expect(await m.content()).not.toContain("Concert tickets");
  expect((await m.goto(personUrl))?.status()).toBe(404);
  expect((await m.goto(`${personUrl}/ideas`))?.status()).toBe(404);
  await member.context.close();
});

test("members switch between lists and can leave a list", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await newUserOnDashboard(page, "switch-owner");
  await addPerson(page, "Uncle Ray");
  const member = await joinAsNewMember(browser, await createInviteLink(page), "switcher");
  const m = member.page;

  await expect(m.getByRole("link", { name: /Uncle Ray/ })).toBeVisible();
  await m.getByLabel("Switch list").selectOption({ label: "Holidays 2026 (mine)" });
  await expect(m.getByText("No one on your list yet.")).toBeVisible();
  const theirs = await m.getByLabel("Switch list").locator("option", { hasText: "'s Holidays 2026" }).textContent();
  expect(theirs).toMatch(/^switch-owner-.*'s Holidays 2026$/);
  await m.getByLabel("Switch list").selectOption({ label: theirs! });
  await expect(m.getByRole("link", { name: /Uncle Ray/ })).toBeVisible();

  await m.goto("/app/family");
  await m.getByRole("button", { name: "Leave Holidays 2026" }).click();
  await m.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await expect(m).toHaveURL(/\/app$/);
  await expect(m.getByText("Uncle Ray")).toHaveCount(0);
  await expect(m.getByLabel("Switch list")).toHaveCount(0);
  await member.context.close();
});

test("broken, unknown and signed-out invite links explain what to do", async ({ page }) => {
  await page.goto("/join/not-a-token");
  await expect(page.getByRole("alert").filter({ hasText: "This invite link isn't complete." })).toBeVisible();
  await page.goto(`/join/${"a".repeat(43)}`);
  await expect(page.getByRole("link", { name: "Sign in to join" })).toBeVisible();
  await signInWithCode(page, uniqueEmail("nobody"), `/sign-in?next=${encodeURIComponent(`/join/${"a".repeat(43)}`)}`);
  await expect(page.getByRole("alert").filter({ hasText: "We couldn't find this invite." })).toBeVisible();
});
