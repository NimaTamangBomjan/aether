// Makes the landing-page screenshots from the real app with sample data.
// Needs: local Supabase, the AI stand-in (node tests/fake-ai/server.mjs) and the app running with
// ANTHROPIC_BASE_URL pointing at it. Usage: BASE_URL=http://localhost:3000 node scripts/make-screenshots.mjs
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324";
mkdirSync("public/screenshots", { recursive: true });

async function signIn(page, email, path = "/sign-in") {
  const before = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()).messages.length;
  await page.goto(base + path);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("6-digit code").waitFor();
  let code;
  for (let i = 0; i < 60 && !code; i++) {
    const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    if (r.messages.length > before) code = r.messages[0].Subject.match(/\d{6}/)[0];
    else await new Promise((res) => setTimeout(res, 250));
  }
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function shot(page, name) {
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(`public/screenshots/${name}.webp`);
  console.log("wrote", name);
}

async function addPerson(page, name, budget, relationship) {
  await page.goto(base + "/app/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (relationship) await page.getByLabel("Relationship").selectOption(relationship);
  await page.getByLabel("Budget for this person").fill(budget);
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByRole("heading", { name, level: 1 }).waitFor();
}

async function addGift(page, title, price, bought) {
  await page.getByPlaceholder("What's the gift?").fill(title);
  await page.getByLabel("Price").fill(price);
  await page.getByRole("button", { name: "Add gift" }).click();
  const card = page.getByTestId("gift").filter({ hasText: title });
  await card.waitFor();
  if (bought) {
    await card.getByRole("button", { name: "Mark bought" }).click();
    await card.getByText("Bought", { exact: true }).waitFor();
  }
}

const browser = await chromium.launch();
const phone = { viewport: { width: 375, height: 650 }, deviceScaleFactor: 2, timezoneId: "America/New_York", colorScheme: "light" };
const owner = await (await browser.newContext(phone)).newPage();
const stamp = Date.now().toString(36);
await signIn(owner, `maria-${stamp}@test.giftledger.local`);
await owner.getByLabel("Total budget").fill("600");
await owner.getByRole("button", { name: "Next" }).click();
await owner.getByLabel("Name").fill("Grandma Rose");
await owner.getByLabel("Relationship").selectOption("Grandparent");
await owner.getByLabel("Budget for them").fill("60");
await owner.getByRole("button", { name: "Add person" }).click();
await owner.getByRole("button", { name: "Done: go to Grandma Rose" }).click();
await owner.getByRole("heading", { name: "Grandma Rose", level: 1 }).waitFor();
await addGift(owner, "Hummingbird feeder", "34", true);
await addPerson(owner, "Dad", "120", "Parent");
await addGift(owner, "Fleece vest", "89", true);
await addPerson(owner, "Mateo", "50", "Niece or nephew");
await addGift(owner, "Lego space shuttle", "48", true);
await addPerson(owner, "Ms. Patel", "20", "Teacher");

// Settings: a real name for the family activity line.
await owner.goto(base + "/app/settings");
await owner.getByLabel("Your name").fill("Maria");
await owner.getByRole("button", { name: "Save settings" }).click();
await owner.getByText("Settings saved").waitFor();

await owner.goto(base + "/app");
await owner.getByTestId("total-spent").waitFor();
await shot(owner, "dashboard");

// One person's budget and gifts.
await owner.getByRole("link", { name: /Dad/ }).click();
await addGift(owner, "Grilling cookbook", "24", false);
await owner.getByText("Gift added").first().waitFor({ state: "hidden", timeout: 10_000 });
await owner.evaluate(() => window.scrollTo(0, 70));
await shot(owner, "person");

// Ideas for Grandma Rose.
await owner.goto(base + "/app");
await owner.getByRole("link", { name: /Grandma Rose/ }).click();
await owner.getByRole("link", { name: "Get gift ideas" }).click();
await owner.getByRole("button", { name: "Get ideas" }).click();
await owner.getByTestId("idea").first().waitFor();
await owner.evaluate(() => window.scrollTo(0, 120));
await shot(owner, "ideas");

// A family member marks a gift bought.
await owner.goto(base + "/app/family");
await owner.getByRole("button", { name: "Create invite link" }).click();
const invite = new URL(await owner.getByLabel("Send this link to one person").inputValue());
const alex = await (await browser.newContext(phone)).newPage();
await signIn(alex, `alex-${stamp}@test.giftledger.local`, `/sign-in?next=${encodeURIComponent(invite.pathname)}`);
await alex.getByLabel("Your name").fill("Alex");
await alex.getByRole("button", { name: "Join the list" }).click();
await alex.waitForURL(/\/app$/);
await alex.getByRole("link", { name: /Ms. Patel/ }).click();
await addGift(alex, "Coffee shop gift card", "20", true);
for (let i = 0; i < 20; i++) {
  await owner.goto(base + "/app");
  await owner.getByRole("link", { name: /Ms. Patel/ }).click();
  const activity = owner.getByTestId("activity").first();
  if ((await activity.count()) && (await activity.textContent())?.includes("Alex")) break;
  await new Promise((r) => setTimeout(r, 300));
}
await owner.getByRole("heading", { name: "Gifts" }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 360));
await shot(owner, "family");

await browser.close();
