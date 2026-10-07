import { addDays, formatDate, todayInTimeZone } from "../../src/lib/dates";
import { addPerson, expect, newBrowserContext, newUserOnDashboard, quickAddGift, signInWithCode, test, uniqueEmail } from "./helpers";

const today = () => todayInTimeZone("America/New_York");

test("new user onboarding: budget, first person, then their page", async ({ page }) => {
  await signInWithCode(page, uniqueEmail("onboard"));
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByLabel("Total budget").fill("500");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.getByLabel("Name").fill("Grandma Rose");
  await page.getByLabel("Relationship").selectOption("Grandparent");
  await page.getByLabel("Budget for them").fill("50");
  await page.getByRole("button", { name: "Add person" }).click();

  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Go to Grandma Rose" }).click();
  await expect(page.getByRole("heading", { name: "Grandma Rose", level: 1 })).toBeVisible();
  await expect(page.getByTestId("person-budget")).toHaveText("$0 of $50 · $50 left");

  await page.goto("/app");
  await expect(page.getByTestId("total-budget")).toHaveText("$500");
});

test("gifts: quick add, one-tap status, and totals that update right away", async ({ page }) => {
  await newUserOnDashboard(page, "gifts");
  await addPerson(page, "Uncle Joe", "40");

  await quickAddGift(page, "Fishing hat", "24.99");
  const gift = page.getByTestId("gift").filter({ hasText: "Fishing hat" });
  await expect(gift.getByText("Idea", { exact: true })).toBeVisible();
  await expect(page.getByTestId("person-budget")).toHaveText("$0 of $40 · $40 left");

  await gift.getByRole("button", { name: "Mark bought" }).click();
  await expect(gift.getByText("Bought", { exact: true })).toBeVisible();
  await expect(page.getByTestId("person-budget")).toHaveText("$24.99 of $40 · $15.01 left");
  await gift.getByRole("button", { name: "Mark wrapped" }).click();
  await expect(gift.getByText("Wrapped", { exact: true })).toBeVisible();

  await quickAddGift(page, "Tackle box", "20");
  await page.getByTestId("gift").filter({ hasText: "Tackle box" }).getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByTestId("person-budget")).toHaveText("$44.99 of $40 · $4.99 over");

  await page.goto("/app");
  await expect(page.getByTestId("total-spent")).toHaveText("$44.99");
  await expect(page.getByTestId("total-budget")).toHaveText("$40");
});

test("people who still need a gift are listed first", async ({ page }) => {
  await newUserOnDashboard(page, "sort");
  await addPerson(page, "Aaron");
  await quickAddGift(page, "Book", "10");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  await addPerson(page, "Zoe");
  await page.goto("/app");
  const names = await page.locator("ul li a p.font-semibold").allTextContents();
  expect(names).toEqual(["Zoe", "Aaron"]);
  await expect(page.getByText("1 of 2 still need a gift")).toBeVisible();
});

test("editing a gift with a store suggests a return-by date 30 days after purchase", async ({ page }) => {
  await newUserOnDashboard(page, "return");
  await addPerson(page, "Mia");
  await quickAddGift(page, "Scooter", "60");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).last().click();

  await expect(page.getByLabel("Bought on")).toHaveValue(today());
  await expect(page.getByLabel("Return by")).toHaveValue("");
  await page.getByLabel("Store").fill("Target");
  await page.getByLabel("Store").blur();
  const expected = addDays(today(), 30);
  await expect(page.getByLabel("Return by")).toHaveValue(expected);
  await expect(page.getByText("Suggested: 30 days after purchase.")).toBeVisible();
  await page.getByRole("button", { name: "Save gift" }).click();

  await expect(page.getByRole("heading", { name: "Mia", level: 1 })).toBeVisible();
  await expect(page.getByText(`Return by ${formatDate(expected, today())} (30 days)`)).toBeVisible();
});

test("free plan stops at 5 people with a friendly upgrade prompt", async ({ page }) => {
  await newUserOnDashboard(page, "limit");
  for (const name of ["P1", "P2", "P3", "P4", "P5"]) await addPerson(page, name);
  await page.goto("/app");
  await expect(page.getByText("You've added 5 people. Unlock unlimited people for $9.99.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add person" })).toHaveCount(0);
  await page.goto("/app/people/new");
  await expect(page.getByText("You've added 5 people.")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});

test("archive, unarchive and delete a person (with confirmation)", async ({ page }) => {
  await newUserOnDashboard(page, "archive");
  await addPerson(page, "Coworker Pat");
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Archive (hide from the main list)" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Archived (1)")).toBeVisible();

  await page.getByText("Archived (1)").click();
  await page.getByRole("link", { name: /Coworker Pat/ }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete Coworker Pat" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("This deletes them and all their gifts.");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete Coworker Pat" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Coworker Pat")).toHaveCount(0);
});

test("wrong input gets clear messages and nothing is saved", async ({ page }) => {
  await newUserOnDashboard(page, "invalid");
  await page.goto("/app/people/new");
  await page.getByLabel("Budget for this person").fill("fifty");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Add a name.")).toBeVisible();
  await expect(page.getByText("Budget should be an amount like 25 or 24.99.")).toBeVisible();

  await addPerson(page, "Lee");
  await page.getByRole("button", { name: "Add gift" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add what the gift is." })).toBeVisible();
  await expect(page.getByTestId("gift")).toHaveCount(0);
});

test("one person can't open another person's list", async ({ page, browser }) => {
  await newUserOnDashboard(page, "owner-a");
  await addPerson(page, "Secret Santa Target");
  const privateUrl = page.url();

  const other = await newBrowserContext(browser);
  const otherPage = await other.newPage();
  await newUserOnDashboard(otherPage, "owner-b");
  const response = await otherPage.goto(privateUrl);
  expect(response?.status()).toBe(404);
  await expect(otherPage.getByText("Secret Santa Target")).toHaveCount(0);
  await other.close();
});

test("an empty list shows a helpful starting point", async ({ page }) => {
  await newUserOnDashboard(page, "empty");
  await expect(page.getByText("No one on your list yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add the first person" }).click();
  await expect(page).toHaveURL(/\/app\/people\/new$/);
});
