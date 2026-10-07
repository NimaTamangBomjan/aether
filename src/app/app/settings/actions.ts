"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_LIST_COOKIE, getListContext } from "@/lib/data/list";
import { isValidTimeZone } from "@/lib/dates";
import { displayNameInput } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/app/actions";
import { trackServer } from "@/lib/analytics-server";

const settingsSchema = z.object({
  display_name: displayNameInput,
  time_zone: z.string().refine(isValidTimeZone, "Choose a time zone from the list."),
  email_reminders: z.literal("on").optional(),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getListContext();
  const parsed = settingsSchema.safeParse({
    display_name: formData.get("display_name"),
    time_zone: formData.get("time_zone"),
    email_reminders: formData.get("email_reminders") ?? undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors: errors };
  }
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      time_zone: parsed.data.time_zone,
      email_reminders: parsed.data.email_reminders === "on",
    })
    .eq("id", ctx.userId);
  if (error) return { error: "Couldn't save your settings. Please try again." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
  successors: z.record(z.uuid(), z.uuid()).default({}),
});

/**
 * Deletes the signed-in person's account and personal data.
 * Shared lists they own pass to the member they chose; lists only they use are deleted.
 * Gifts they added to other people's lists stay on those lists, without their name.
 */
export async function deleteAccount(input: { confirm: string; successors: Record<string, string> }): Promise<FormState> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: 'Type DELETE in capital letters to confirm.' };
  const ctx = await getListContext();
  const admin = createAdminClient();

  for (const list of ctx.lists.filter((l) => l.role === "owner")) {
    const { data: members } = await ctx.supabase.rpc("list_member_names", { p_list: list.id });
    const others = (members ?? []).filter((m) => m.user_id !== ctx.userId);
    if (others.length === 0) {
      const { error } = await admin.from("lists").delete().eq("id", list.id);
      if (error) return { error: "Couldn't delete your account. Please try again." };
      continue;
    }
    const chosen = parsed.data.successors[list.id];
    const successor = others.find((m) => m.user_id === chosen) ?? others[0];
    const { error } = await admin.rpc("transfer_list_ownership", { p_list: list.id, p_from: ctx.userId, p_to: successor.user_id });
    if (error) return { error: "Couldn't hand over your shared list. Please try again." };
  }

  const { error } = await admin.auth.admin.deleteUser(ctx.userId);
  if (error) return { error: "Couldn't delete your account. Please try again." };
  trackServer(ctx.userId, "account_deleted");
  await ctx.supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_LIST_COOKIE);
  redirect("/goodbye");
}
