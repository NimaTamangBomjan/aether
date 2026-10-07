import "server-only";
import { Resend } from "resend";
import type { Email } from "@/lib/email/templates";
import { serverEnv } from "@/lib/server-env";

export function emailConfigured() {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Sends one email. Returns false (and logs no personal details) if it couldn't be sent.
 * The idempotency key stops Resend from sending the same email twice within 24 hours.
 */
export async function sendEmail(
  to: string,
  email: Email,
  opts: { idempotencyKey?: string; unsubscribeUrl?: string; tag: string },
): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info(`email_skipped tag=${opts.tag} reason=not_configured`);
    return false;
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: opts.unsubscribeUrl
          ? { "List-Unsubscribe": `<${opts.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
        tags: [{ name: "type", value: opts.tag }],
      },
      opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
    );
    if (error) {
      console.error(`email_failed tag=${opts.tag} reason=${error.name}`);
      return false;
    }
    return true;
  } catch {
    console.error(`email_failed tag=${opts.tag} reason=exception`);
    return false;
  }
}
