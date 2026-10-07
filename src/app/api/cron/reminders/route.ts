import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders/run";
import { serverEnv } from "@/lib/server-env";

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
  return NextResponse.json(result);
}
