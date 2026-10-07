import { NextResponse } from "next/server";
import { unsubscribeFromReminders } from "@/lib/reminders/unsubscribe";

// One-click unsubscribe from email apps (RFC 8058). Uses POST, so link scanners can't trigger it.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribeFromReminders(url.searchParams.get("u") ?? "", url.searchParams.get("s") ?? "");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
