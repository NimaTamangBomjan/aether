"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_LIST_COOKIE, getListContext } from "@/lib/data/list";
import { env } from "@/lib/env";
import { newInviteToken } from "@/lib/invite-token";
import { FREE_MEMBER_LIMIT } from "@/lib/types";

const uuid = z.uuid();

export type InviteResult = { ok: true; url: string } | { ok: false; message: string; code?: "limit" };

export async function createInviteLink(): Promise<InviteResult> {
  const ctx = await getListContext();
  if (!ctx.isOwner) return { ok: false, message: "Only the list owner can invite people." };
  if (!ctx.hasPass && ctx.memberCount >= FREE_MEMBER_LIMIT) {
    return {
      ok: false,
      code: "limit",
      message: "Your free plan includes 1 family member. Unlock unlimited family members for $9.99.",
    };
  }
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
