import { addPerson, expect, newUserOnDashboard, signInWithCode, test, uniqueEmail } from "./helpers";

const FAKE_AI = "http://127.0.0.1:4010";

/** Letters only: digits would be scrubbed like a phone number before reaching the AI. */
function marker(prefix: string) {
  return prefix + Array.from({ length: 10 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
}

async function aiRequestsContaining(marker: string) {
  const all = (await (await fetch(`${FAKE_AI}/requests`)).json()) as { system: string; user: string; model: string; max_tokens: number }[];
  return all.filter((r) => r.user.includes(marker));
}

async function addPersonWithNotes(page: import("@playwright/test").Page, name: string, budget: string | undefined, notes: string) {
  await page.goto("/app/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (budget) await page.getByLabel("Budget for this person").fill(budget);
  await page.getByLabel("Notes").fill(notes);
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("a new user reaches their first AI idea during onboarding, quickly", async ({ page }) => {
  const started = Date.now();
  await signInWithCode(page, uniqueEmail("first-idea"));
  await page.getByLabel("Total budget").fill("300");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Name").fill("Grandpa Lou");
  await page.getByLabel("Budget for them").fill("40");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByTestId("idea")).toHaveCount(5);
  expect(Date.now() - started).toBeLessThan(120_000);

  await page.getByTestId("idea").first().getByRole("button", { name: "Save as gift idea" }).click();
  await expect(page.getByTestId("idea").first().getByText("Saved ✓")).toBeVisible();
  await page.getByRole("button", { name: "Done: go to Grandpa Lou" }).click();
  await expect(page.getByTestId("gift")).toHaveCount(1);
  await expect(page.getByTestId("gift").first()).toContainText("Hummingbird feeder");
});

test("ideas stay in budget, send no names, and follow-ups each use one request", async ({ page }) => {
  await newUserOnDashboard(page, "ideas");
  const tag = marker("mk");
  await addPersonWithNotes(page, "Rosalind Fairweather", "50", `Rosalind loves birds ${tag}`);
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await expect(page.getByTestId("ideas-left")).toHaveText("10 of 10 idea requests left");
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByTestId("idea")).toHaveCount(5);
  await expect(page.getByTestId("ideas-left")).toHaveText("9 of 10 idea requests left");

  const prices = await page.getByTestId("idea-price").allTextContents();
  for (const p of prices) expect(Number(p.replace(/[~$,]/g, ""))).toBeLessThanOrEqual(50);

  const sent = await aiRequestsContaining(tag);
  expect(sent).toHaveLength(1);
  expect(sent[0].user).not.toMatch(/Rosalind|Fairweather|ideas-[0-9a-f]{8}/);
  expect(sent[0].user).toContain("[name] loves birds");
  expect(sent[0].model).toBe("claude-haiku-4-5");
  expect(sent[0].max_tokens).toBeLessThanOrEqual(1200);

  await page.getByTestId("idea").first().getByRole("button", { name: "More like this" }).click();
  await expect(page.getByTestId("ideas-left")).toHaveText("8 of 10 idea requests left");
  await expect(page.getByTestId("idea")).toHaveCount(5);
  await page.getByRole("button", { name: "Different direction" }).click();
  await expect(page.getByTestId("ideas-left")).toHaveText("7 of 10 idea requests left");

  const followUps = await aiRequestsContaining(tag);
  expect(followUps).toHaveLength(3);
  expect(followUps[1].user).toContain("They liked this idea");
  expect(followUps[2].user).toContain("clearly different directions");
});

test("asks for a budget first when the person doesn't have one", async ({ page }) => {
  await newUserOnDashboard(page, "nobudget");
  await addPerson(page, "Neighbor Kim");
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await expect(page.getByText("About how much do you want to spend on Neighbor Kim?")).toBeVisible();
  await page.getByRole("button", { name: "$25" }).click();
  await expect(page.getByTestId("idea")).toHaveCount(5);
  await page.getByRole("link", { name: "Back to Neighbor Kim" }).click();
  await expect(page.getByTestId("person-budget")).toHaveText("$0 of $25 · $25 left");
});

test("a failed AI call shows a friendly message and doesn't use up a request", async ({ page }) => {
  await newUserOnDashboard(page, "aifail");
  await addPersonWithNotes(page, "Pat", "30", "FAKE_ERROR");
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load ideas. Try again in a moment. This didn't use up a request." })).toBeVisible();
  await expect(page.getByTestId("ideas-left")).toHaveText("10 of 10 idea requests left");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a slow AI call gives up politely and doesn't use up a request", async ({ page }) => {
  await newUserOnDashboard(page, "aislow");
  await addPersonWithNotes(page, "Sam", "30", "FAKE_SLOW");
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByText("Thinking of ideas for Sam…")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "This didn't use up a request." })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("ideas-left")).toHaveText("10 of 10 idea requests left");
});

test("a malformed answer is retried once automatically", async ({ page }) => {
  await newUserOnDashboard(page, "airetry");
  const tag = marker("retry");
  await addPersonWithNotes(page, "Jo", "30", `FAKE_BAD_ONCE ${tag}`);
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByTestId("idea")).toHaveCount(5);
  expect(await aiRequestsContaining(tag)).toHaveLength(2);
  await expect(page.getByTestId("ideas-left")).toHaveText("9 of 10 idea requests left");
});

test("an answer that's still wrong after the retry is a free failure", async ({ page }) => {
  await newUserOnDashboard(page, "aibad");
  await addPersonWithNotes(page, "Lee", "30", "FAKE_BAD");
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This didn't use up a request." })).toBeVisible();
  await expect(page.getByTestId("ideas-left")).toHaveText("10 of 10 idea requests left");
});

test("after 10 free requests, the next one shows the Season Pass offer", async ({ page }) => {
  test.setTimeout(150_000);
  await newUserOnDashboard(page, "ailimit");
  await addPerson(page, "Max", "40");
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByTestId("ideas-left")).toHaveText("9 of 10 idea requests left");
  for (let i = 8; i >= 0; i--) {
    await page.getByRole("button", { name: "Different direction" }).click();
    await expect(page.getByTestId("ideas-left")).toHaveText(`${i} of 10 idea requests left`);
    // Stay under the 10-a-minute rate limit.
    if (i === 2) await page.waitForTimeout(61_000);
  }
  await page.getByRole("button", { name: "Different direction" }).click();
  await expect(page.getByText("You've used all 10 free idea requests. Get 100 more with the Season Pass for $9.99.")).toBeVisible();
});

test("you've reached the budget: no request is used", async ({ page }) => {
  await newUserOnDashboard(page, "aispent");
  await addPerson(page, "Ana", "20");
  await page.getByPlaceholder("What's the gift?").fill("Scarf");
  await page.getByLabel("Price").fill("20");
  await page.getByRole("button", { name: "Add gift" }).click();
  await page.getByRole("button", { name: "Mark bought" }).click();
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Get gift ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByText("You've reached Ana's budget. Raise their budget to get more ideas.")).toBeVisible();
  await expect(page.getByTestId("ideas-left")).toHaveText("10 of 10 idea requests left");
});
