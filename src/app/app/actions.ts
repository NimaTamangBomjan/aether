"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getListContext } from "@/lib/data/list";
import { Constants } from "@/lib/database.types";
import { isValidTimeZone } from "@/lib/dates";
import { FREE_RECIPIENT_LIMIT } from "@/lib/types";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { trackServer } from "@/lib/analytics-server";
import {
  budgetInput,
  fieldErrors,
  formToObject,
  giftInput,
  quickGiftInput,
  recipientInput,
} from "@/lib/validation";

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  code?: "limit";
  id?: string;
};

const TRY_AGAIN = "Something went wrong saving that. Please try again.";
const LIMIT_MESSAGE = `You've added ${FREE_RECIPIENT_LIMIT} people. Unlock unlimited people for $9.99.`;

const uuid = z.uuid();

function refresh() {
  revalidatePath("/app", "layout");
}

// ---------- People ----------

export async function saveRecipient(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getListContext();
  if (!ctx.isOwner) return { error: "Only the list owner can add or change people." };

  const parsed = recipientInput.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { budget, ...rest } = parsed.data;
  const values = { ...rest, budget_cents: budget };
  // Linking a person to yourself hides them from you, so the saved row can't be read back.
  const linkedToMe = values.linked_user_id === ctx.userId;

  const id = formData.get("id")?.toString();
  if (id) {
    if (!uuid.safeParse(id).success) return { error: TRY_AGAIN };
    const query = ctx.supabase.from("recipients").update(values).eq("id", id).eq("list_id", ctx.list.id);
    const { data, error } = linkedToMe ? { ...(await query), data: [{ id }] } : await query.select("id");
    if (error) return linkError(error.message);
    if (!data?.length) return { error: TRY_AGAIN };
    refresh();
    redirect(linkedToMe ? "/app" : `/app/people/${id}`);
  }

  const insert = { ...values, list_id: ctx.list.id, created_by: ctx.userId };
  if (linkedToMe) {
    const { error } = await ctx.supabase.from("recipients").insert(insert);
    if (error) return error.message.includes("RECIPIENT_LIMIT") ? { code: "limit", error: LIMIT_MESSAGE } : linkError(error.message);
    refresh();
    redirect("/app");
  }
  const { data, error } = await ctx.supabase.from("recipients").insert(insert).select("id").single();
  if (error) {
    if (error.message.includes("RECIPIENT_LIMIT")) return { code: "limit", error: LIMIT_MESSAGE };
    return linkError(error.message);
  }
  refresh();
  trackServer(ctx.userId, "person_added", { onboarding: formData.get("then") === "stay" });
  if (formData.get("then") === "stay") return { ok: true, id: data.id };
  redirect(`/app/people/${data.id}`);
}

function linkError(message: string): FormState {
  return message.includes("LINKED_USER_NOT_MEMBER")
    ? { fieldErrors: { linked_user_id: "Choose someone who's on this list." } }
    : { error: TRY_AGAIN };
}

export async function setRecipientArchived(id: string, archived: boolean): Promise<FormState> {
  const ctx = await getListContext();
  if (!uuid.safeParse(id).success || !ctx.isOwner) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("recipients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: TRY_AGAIN };
  refresh();
  return { ok: true };
}

export async function deleteRecipient(id: string): Promise<FormState> {
  const ctx = await getListContext();
  if (!uuid.safeParse(id).success || !ctx.isOwner) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase.from("recipients").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: TRY_AGAIN };
  refresh();
  redirect("/app");
}

// ---------- Gifts ----------

async function recipientOnList(ctx: Awaited<ReturnType<typeof getListContext>>, recipientId: string) {
  if (!uuid.safeParse(recipientId).success) return null;
  const { data } = await ctx.supabase
    .from("recipients")
    .select("id, list_id")
    .eq("id", recipientId)
    .eq("list_id", ctx.list.id)
    .maybeSingle();
  return data;
}

export async function addQuickGift(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getListContext();
  const recipient = await recipientOnList(ctx, formData.get("recipient_id")?.toString() ?? "");
  if (!recipient) return { error: TRY_AGAIN };

  const parsed = quickGiftInput.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await ctx.supabase.from("gifts").insert({
    list_id: recipient.list_id,
    recipient_id: recipient.id,
    title: parsed.data.title,
    price_cents: parsed.data.price,
    created_by: ctx.userId,
  });
  if (error) return { error: TRY_AGAIN };
  refresh();
  trackServer(ctx.userId, "gift_added", { with_price: parsed.data.price != null });
  return { ok: true };
}

export async function saveGift(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getListContext();
  const id = formData.get("id")?.toString() ?? "";
  if (!uuid.safeParse(id).success) return { error: TRY_AGAIN };

  const parsed = giftInput.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { price, ...rest } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("gifts")
    .update({ ...rest, price_cents: price })
    .eq("id", id)
    .select("recipient_id, list_id");
  if (error) {
    return /BUYER_NOT_(MEMBER|ALLOWED)/.test(error.message)
      ? { fieldErrors: { bought_by: "You can record yourself as the buyer. The list owner can choose anyone." } }
      : { error: TRY_AGAIN };
  }
  if (!data?.length) return { error: "You can only edit gifts you added. You can still change their status." };

  // "Hide from": keep exactly the people ticked on the form (never yourself, only people on the list).
  const { data: members } = await ctx.supabase.rpc("list_member_names", { p_list: data[0].list_id });
  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const wanted = new Set(
    formData
      .getAll("hidden_from")
      .map(String)
      .filter((u) => uuid.safeParse(u).success && memberIds.has(u) && u !== ctx.userId),
  );
  const { data: existing } = await ctx.supabase.from("gift_hidden_from").select("user_id").eq("gift_id", id);
  const current = new Set((existing ?? []).map((r) => r.user_id));
  const toRemove = [...current].filter((u) => !wanted.has(u));
  const toAdd = [...wanted].filter((u) => !current.has(u));
  if (toRemove.length) {
    await ctx.supabase.from("gift_hidden_from").delete().eq("gift_id", id).in("user_id", toRemove);
  }
  if (toAdd.length) {
    const { error: hideError } = await ctx.supabase
      .from("gift_hidden_from")
      .insert(toAdd.map((user_id) => ({ gift_id: id, user_id })));
    if (hideError) return { error: TRY_AGAIN };
  }

  refresh();
  redirect(`/app/people/${data[0].recipient_id}`);
}

export async function deleteGift(id: string): Promise<FormState> {
  const ctx = await getListContext();
  if (!uuid.safeParse(id).success) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase.from("gifts").delete().eq("id", id).select("recipient_id");
  if (error) return { error: TRY_AGAIN };
  if (!data?.length) return { error: "You can only delete gifts you added." };
  refresh();
  redirect(`/app/people/${data[0].recipient_id}`);
}

const statusSchema = z.enum(Constants.public.Enums.gift_status);

export async function setGiftStatus(id: string, status: string): Promise<FormState> {
  const ctx = await getListContext();
  const parsedStatus = statusSchema.safeParse(status);
  if (!uuid.safeParse(id).success || !parsedStatus.success) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase.rpc("set_gift_status", { p_gift: id, p_status: parsedStatus.data });
  if (error) return { error: "Couldn't update that gift. Please try again." };
  refresh();
  trackServer(ctx.userId, "gift_status_changed", { status: parsedStatus.data });
  return { ok: true };
}

// ---------- List budget and onboarding ----------

export async function saveListBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getListContext();
  if (!ctx.isOwner) return { error: "Only the list owner can change the budget." };
  const parsed = budgetInput.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { error } = await ctx.supabase
    .from("lists")
    .update({ overall_budget_cents: parsed.data.budget })
    .eq("id", ctx.list.id);
  if (error) return { error: TRY_AGAIN };
  refresh();
  return { ok: true };
}

/** Saves the browser's time zone the first time we see it, so dates match where the person is. */
export async function saveDetectedTimeZone(timeZone: string): Promise<void> {
  const ctx = await getListContext();
  if (!isValidTimeZone(timeZone) || ctx.profile.onboarded_at) return;
  await ctx.supabase.from("profiles").update({ time_zone: timeZone }).eq("id", ctx.userId);
}

export async function completeOnboarding(destination?: string): Promise<void> {
  const ctx = await getListContext();
  const { data: updated } = await ctx.supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", ctx.userId)
    .is("onboarded_at", null)
    .select("id");
  if (updated?.length) trackServer(ctx.userId, "signed_up", { via: "onboarding" });
  if (updated?.length && ctx.email) {
    await sendEmail(ctx.email, welcomeEmail({ name: ctx.profile.display_name, appUrl: env.NEXT_PUBLIC_APP_URL }), {
      tag: "welcome",
      idempotencyKey: `welcome-${ctx.userId}`,
    });
  }
  refresh();
  const target = destination && /^\/app(\/[\w/-]*)?$/.test(destination) ? destination : "/app";
  redirect(target);
}
