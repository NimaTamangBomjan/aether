import { addDays, todayInTimeZone } from "../../src/lib/dates";
import { addPerson, adminClient, expect, newBrowserContext, newUserOnDashboard, quickAddGift, test, userIdFor } from "./helpers";

// The changes from the competitor research: quicker capture, easier forms for less-techy relatives,
// the return-reminder upgrade moment, live updates, and the home-screen tip.

test("pasting a store link fills in the gift, the store and the link", async ({ page }) => {
  await newUserOnDashboard(page, "paste");
  await addPerson(page, "Mateo", "60");
  await page.getByLabel("Gift", { exact: true }).fill("https://www.amazon.com/LEGO-Classic-Creative-Bricks-10692/dp/B00NHQFA1I?ref=x");
  await page.getByLabel("Price").fill("35");
  await page.getByRole("button", { name: "Add gift" }).click();
  const gift = page.getByTestId("gift").filter({ hasText: "LEGO Classic Creative Bricks 10692" });
  await expect(gift).toBeVisible();
  await expect(gift).toContainText("$35 · Amazon");
  await expect(gift.getByRole("link", { name: "Open link" })).toHaveAttribute("href", /amazon\.com\/LEGO-Classic/);
});

test("the person form has one-tap budgets and age buttons", async ({ page }) => {
  await newUserOnDashboard(page, "chips");
  await page.goto("/app/people/new");
  await page.getByLabel("Name", { exact: true }).fill("Grandpa Lou");
  await page.getByRole("group", { name: "Quick budgets" }).getByRole("button", { name: "$50" }).click();
  await expect(page.getByLabel("Budget for this person")).toHaveValue("50");
  await page.getByText("Senior (65+)", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Senior (65+)" })).toBeChecked();
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("heading", { name: "Grandpa Lou", level: 1 })).toBeVisible();
  await expect(page.getByTestId("person-budget")).toHaveText("$0 of $50 · $50 left");

  await page.getByRole("link", { name: "Edit" }).first().click();
  await expect(page.getByRole("radio", { name: "Senior (65+)" })).toBeChecked();
});

test("free lists offer a return reminder on a bought gift; the Season Pass removes the offer", async ({ page }) => {
  const email = await newUserOnDashboard(page, "teaser");
  await addPerson(page, "Aunt May", "80");
  await quickAddGift(page, "Cardigan", "45");
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).last().click();
  await page.getByLabel("Return by").fill(addDays(todayInTimeZone("America/New_York"), 10));
  await page.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByRole("heading", { name: "Aunt May", level: 1 })).toBeVisible();

  const offer = page.getByRole("link", { name: "Email me 3 days before the return window closes" });
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(page).toHaveURL(/\/app\/upgrade$/);

  await adminClient().from("profiles").update({ paid_until: "2027-02-01T05:00:00Z" }).eq("id", await userIdFor(email));
  await page.goBack();
  await page.reload();
  await expect(page.getByTestId("gift").filter({ hasText: "Cardigan" })).toBeVisible();
  await expect(offer).toHaveCount(0);
});

test("a gift marked bought elsewhere shows up when you come back to the app, without reloading", async ({ page }) => {
  await newUserOnDashboard(page, "live");
  await addPerson(page, "Cousin Ana", "30");
  await quickAddGift(page, "Puzzle", "20");
  const gift = page.getByTestId("gift").filter({ hasText: "Puzzle" });
  await expect(gift).toContainText("Idea");

  // A family member marks it bought on their own phone.
  const { data } = await adminClient().from("gifts").select("id").eq("title", "Puzzle").order("created_at", { ascending: false }).limit(1).single();
  await adminClient().from("gifts").update({ status: "bought" }).eq("id", data!.id);

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(gift).toContainText("Bought");
});

test("everything is saved, and a copy is one tap away on every page", async ({ page }) => {
  await newUserOnDashboard(page, "trust");
  await expect(page.getByText("Everything is saved to your account as you go.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download a copy" })).toHaveAttribute("href", "/api/export");
});

test("iPhone visitors see how to add GiftLedger to the home screen, once", async ({ browser }) => {
  const context = await newBrowserContext(browser, {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await newUserOnDashboard(page, "iphone");
  const tip = page.getByRole("complementary", { name: "Add to home screen" });
  await expect(tip).toContainText("Add to Home Screen");
  await tip.getByRole("button", { name: "Hide this tip" }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(tip).toHaveCount(0);
  await context.close();
});
