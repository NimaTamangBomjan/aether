"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_LIST_COOKIE } from "@/lib/data/list";
import { isInviteTokenFormat } from "@/lib/invite-token";
import { requireUser } from "@/lib/auth";

export async function joinList(token: string, displayName?: string): Promise<{ error: string } | void> {
  const { supabase, userId } = await requireUser(`/join/${token}`);
  if (!isInviteTokenFormat(token)) return { error: "This invite link isn't complete. Ask for a new one." };

  const { data: listId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !listId) {
    if (error?.message.includes("MEMBER_LIMIT")) {
      return { error: "This list is full on the free plan. Ask the person who invited you to upgrade, then try again." };
    }
    return { error: "This invite link has expired or was already used. Ask for a new one." };
  }

  (await cookies()).set(ACTIVE_LIST_COOKIE, listId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // The name family members see next to "Marked bought by…".
  const name = displayName?.trim().slice(0, 60);
  if (name) await supabase.from("profiles").update({ display_name: name }).eq("id", userId);
  // People who join someone's list skip the setup steps for a new list.
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarded_at", null);
  redirect("/app");
}
