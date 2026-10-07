import { expect, type Page, test as base } from "@playwright/test";
import { randomUUID } from "node:crypto";

const MAILPIT = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Fails the test if the page logs any console error or warning, or throws. */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
      await use(problems);
      expect(problems, "browser console should be clean").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export function uniqueEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@test.giftledger.local`;
}

type MailpitMessage = { ID: string; To: { Address: string }[]; Subject: string };

/** Waits for the newest sign-in email to arrive in the local test inbox. */
export async function latestEmail(to: string, after = 0): Promise<{ html: string; text: string; subject: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const body = (await res.json()) as { messages: MailpitMessage[] };
    if (body.messages.length > after) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${body.messages[0].ID}`)).json();
      return { html: msg.HTML as string, text: msg.Text as string, subject: msg.Subject as string };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email arrived for ${to}`);
}

export async function emailCount(to: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return ((await res.json()) as { messages: unknown[] }).messages.length;
}

export function codeFrom(email: { subject: string }) {
  const match = email.subject.match(/(\d{6})/);
  if (!match) throw new Error("No code in email subject");
  return match[1];
}

export function linkFrom(email: { html: string }) {
  const match = email.html.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
  if (!match) throw new Error("No sign-in link in email");
  return match[1].replaceAll("&amp;", "&");
}

/** Signs in through the real UI using the emailed 6-digit code. */
export async function signInWithCode(page: Page, email: string, path = "/sign-in") {
  const before = await emailCount(email);
  await page.goto(path);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  const mail = await latestEmail(email, before);
  await page.getByLabel("6-digit code").fill(codeFrom(mail));
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A brand-new account that skipped onboarding, sitting on the dashboard. */
export async function newUserOnDashboard(page: Page, label = "user") {
  const email = uniqueEmail(label);
  await signInWithCode(page, email);
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return email;
}

export async function addPerson(page: Page, name: string, budget?: string) {
  await page.goto("/app/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (budget) await page.getByLabel("Budget for this person").fill(budget);
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

export async function quickAddGift(page: Page, title: string, price?: string) {
  await page.getByPlaceholder("What's the gift?").fill(title);
  if (price) await page.getByLabel("Price").fill(price);
  await page.getByRole("button", { name: "Add gift" }).click();
  await expect(page.getByTestId("gift").filter({ hasText: title })).toBeVisible();
}
