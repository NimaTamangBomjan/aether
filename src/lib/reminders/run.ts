import "server-only";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { costWarningEmail, reminderEmail, type ReminderItem } from "@/lib/email/templates";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/email/unsubscribe";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

const COST_WARNING_USD = 50;
// claude-haiku-4-5 prices per million tokens.
const INPUT_USD_PER_MTOK = 1;
const OUTPUT_USD_PER_MTOK = 5;

export type ReminderRun = { people: number; sent: number; alreadySent: number; failed: number; costWarning: boolean };

/**
 * The daily job: one bundled email per person per day for gifts whose return window closes
 * in 3 days or today. Safe to run twice: a person already emailed today is skipped.
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderRun> {
  const admin = createAdminClient();
  const secret = serverEnv().UNSUBSCRIBE_SECRET;
  const { data: rows, error } = await admin.rpc("due_reminders", { p_now: now.toISOString() });
  if (error) throw new Error("due_reminders failed");

  const byUser = new Map<string, typeof rows>();
  for (const row of rows ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const result: ReminderRun = { people: byUser.size, sent: 0, alreadySent: 0, failed: 0, costWarning: false };
  for (const [userId, items] of byUser) {
    const first = items[0];
    const { data: claimed } = await admin.rpc("claim_reminder", {
      p_user: userId,
      p_local_date: first.local_date,
      p_gift_ids: items.map((i) => i.gift_id),
    });
    if (!claimed) {
      result.alreadySent++;
      continue;
    }
    const mailItems: ReminderItem[] = items.map((i) => ({
      giftTitle: i.gift_title,
      recipientName: i.recipient_name,
      store: i.store,
      returnBy: i.return_by,
      daysLeft: i.days_left,
    }));
    const unsubscribe = secret ? unsubscribeUrl(env.NEXT_PUBLIC_APP_URL, userId, secret) : `${env.NEXT_PUBLIC_APP_URL}/app/settings`;
    const sent = await sendEmail(
      first.email,
      reminderEmail({ name: first.display_name, items: mailItems, today: first.local_date, appUrl: env.NEXT_PUBLIC_APP_URL, unsubscribeUrl: unsubscribe }),
      {
        tag: "reminder",
        idempotencyKey: `reminder-${userId}-${first.local_date}`,
        oneClickUnsubscribeUrl: secret ? oneClickUnsubscribeUrl(env.NEXT_PUBLIC_APP_URL, userId, secret) : undefined,
      },
    );
    await admin.rpc("finish_reminder", { p_user: userId, p_local_date: first.local_date, p_sent: sent });
    if (sent) result.sent++;
    else result.failed++;
  }

  result.costWarning = await maybeWarnAboutCost(now);
  return result;
}

/** Projects this month's AI cost from usage so far and emails the owner if it passes $50. */
async function maybeWarnAboutCost(now: Date): Promise<boolean> {
  const adminEmail = serverEnv().ADMIN_EMAIL;
  const { data } = await createAdminClient().rpc("ai_tokens_this_month", { p_now: now.toISOString() });
  const usage = data?.[0];
  if (!usage) return false;
  const spent = (Number(usage.input_tokens) * INPUT_USD_PER_MTOK + Number(usage.output_tokens) * OUTPUT_USD_PER_MTOK) / 1_000_000;
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const projected = (spent / day) * daysInMonth;
  if (projected <= COST_WARNING_USD || !adminEmail) return false;
  return sendEmail(adminEmail, costWarningEmail({ projectedUsd: projected, spentUsd: spent }), {
    tag: "cost-warning",
    idempotencyKey: `cost-warning-${now.toISOString().slice(0, 10)}`,
  });
}
