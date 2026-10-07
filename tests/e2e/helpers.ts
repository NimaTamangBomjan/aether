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
