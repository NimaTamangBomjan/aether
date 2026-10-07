import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders/run";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron calls this once a day (see vercel.json) with "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 300;

function authorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runReminders();
  console.info(`reminders_run people=${result.people} sent=${result.sent} skipped=${result.alreadySent} failed=${result.failed}`);

  // Daily tidy-up: unfinished sign-ups older than a day, sign-in logs and invite-email records older than 30 days.
  const { data: cleanup, error } = await createAdminClient().rpc("daily_cleanup", {});
  const cleaned = cleanup?.[0];
  if (error || !cleaned) console.error("daily_cleanup_failed");
  else console.info(`daily_cleanup users=${cleaned.unconfirmed_users} logs=${cleaned.auth_log_rows} invite_emails=${cleaned.invite_email_rows}`);
  return NextResponse.json({ ...result, cleanup: cleaned ?? null });
}
