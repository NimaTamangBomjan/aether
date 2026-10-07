"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_LIST_COOKIE, getListContext } from "@/lib/data/list";
import { env } from "@/lib/env";
import { hashInviteEmail, newInviteToken } from "@/lib/invite-token";
import { FREE_MEMBER_LIMIT } from "@/lib/types";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { inviteEmail, invitesPausedEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServer } from "@/lib/analytics-server";

const uuid = z.uuid();

export type InviteResult = { ok: true; url: string } | { ok: false; message: string; code?: "limit" };

type ListContext = Awaited<ReturnType<typeof getListContext>>;

function cannotInvite(ctx: ListContext): Extract<InviteResult, { ok: false }> | null {
  if (!ctx.isOwner) return { ok: false, message: "Only the list owner can invite people." };
  if (!ctx.hasPass && ctx.memberCount >= FREE_MEMBER_LIMIT) {
    return {
      ok: false,
      code: "limit",
      message: "Your free plan includes 1 family member. Unlock unlimited family members for $9.99.",
    };
  }
  return null;
}

export async function createInviteLink(): Promise<InviteResult> {
  const ctx = await getListContext();
  const refused = cannotInvite(ctx);
  if (refused) return refused;
  const { token, hash } = newInviteToken();
  const { error } = await ctx.supabase
    .from("invites")
    .insert({ list_id: ctx.list.id, token_hash: hash, created_by: ctx.userId });
  if (error) {
    return {
      ok: false,
      message: error.message.includes("INVITE_RATE_LIMIT")
        ? "That's a lot of invites in one hour. Please try again later."
        : "Couldn't create an invite link. Please try again.",
    };
  }
  revalidatePath("/app/family");
  trackServer(ctx.userId, "invite_created", { plan: ctx.hasPass ? "pass" : "free" });
  return { ok: true, url: `${env.NEXT_PUBLIC_APP_URL}/join/${token}` };
}

export async function cancelInvite(id: string) {
  const ctx = await getListContext();
  if (!uuid.safeParse(id).success || !ctx.isOwner) return { error: "Couldn't cancel that invite." };
  await ctx.supabase.from("invites").delete().eq("id", id).eq("list_id", ctx.list.id);
  revalidatePath("/app/family");
  return { ok: true };
}

export async function removeMember(userId: string) {
  const ctx = await getListContext();
  if (!uuid.safeParse(userId).success || !ctx.isOwner || userId === ctx.userId) {
    return { error: "Couldn't remove that person." };
  }
  const { data, error } = await ctx.supabase
    .from("list_members")
    .delete()
    .eq("list_id", ctx.list.id)
    .eq("user_id", userId)
    .eq("role", "member")
    .select("user_id");
  if (error || !data?.length) return { error: "Couldn't remove that person." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function leaveList() {
  const ctx = await getListContext();
  if (ctx.isOwner) return { error: "The owner can't leave their own list." };
  const { data, error } = await ctx.supabase
    .from("list_members")
    .delete()
    .eq("list_id", ctx.list.id)
    .eq("user_id", ctx.userId)
    .select("user_id");
  if (error || !data?.length) return { error: "Couldn't leave the list. Please try again." };
  (await cookies()).delete(ACTIVE_LIST_COOKIE);
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function switchList(formData: FormData) {
  const ctx = await getListContext();
  const listId = formData.get("list_id")?.toString() ?? "";
  if (ctx.lists.some((l) => l.id === listId)) {
    (await cookies()).set(ACTIVE_LIST_COOKIE, listId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}

const EMAIL_INVITE_REFUSALS: Record<string, string> = {
  INVITE_EMAIL_DUPLICATE: "An invite was already emailed to this address. Copy the link and send it yourself instead.",
  INVITE_EMAIL_LIMIT: "You've emailed all the invites you can today. Copy the link and send it yourself instead.",
  INVITE_EMAIL_PAUSED: "Invite emails are paused for today. Copy the link and send it yourself instead.",
};

/**
 * Creates a fresh single-use link and emails it. The address is only used for this one email;
 * a one-way fingerprint of it is kept for 30 days so nobody can email the same person twice.
 * Each account can email 3 invites a day (10 with the Season Pass).
 */
export async function emailInvite(email: string): Promise<{ ok: true } | { ok: false; message: string; code?: "limit" }> {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  if (!emailConfigured()) return { ok: false, message: "Sending invites by email isn't switched on yet. Copy the link instead." };
  const ctx = await getListContext();
  const refused = cannotInvite(ctx);
  if (refused) return refused;

  const { error: reserveError } = await createAdminClient().rpc("reserve_invite_email", {
    p_user: ctx.userId,
    p_email_hash: hashInviteEmail(parsed.data),
  });
  if (reserveError) {
    const code = Object.keys(EMAIL_INVITE_REFUSALS).find((c) => reserveError.message.includes(c));
    if (code === "INVITE_EMAIL_PAUSED") await alertOwnerInvitesPaused();
    return { ok: false, message: code ? EMAIL_INVITE_REFUSALS[code] : "Couldn't send the email. Copy the link instead." };
  }

  const created = await createInviteLink();
  if (!created.ok) return created;
  const sent = await sendEmail(parsed.data, inviteEmail({ inviterName: ctx.profile.display_name, inviteUrl: created.url }), {
    tag: "invite",
  });
  return sent ? { ok: true } : { ok: false, message: "Couldn't send the email. Copy the link instead." };
}

async function alertOwnerInvitesPaused() {
  const adminEmail = serverEnv().ADMIN_EMAIL;
  if (!adminEmail) return;
  await sendEmail(adminEmail, invitesPausedEmail(), {
    tag: "invites-paused",
    idempotencyKey: `invites-paused-${new Date().toISOString().slice(0, 10)}`,
  });
}
