"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiConfigured, generateIdeas } from "@/lib/ai/generate";
import { buildProfile, type Idea } from "@/lib/ai/ideas";
import { spentCents } from "@/lib/budget";
import { getListContext } from "@/lib/data/list";
import { dollarsToCents } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export type IdeasUsage = { used: number; cap: number };

export type IdeasResult =
  | { ok: true; ideas: Idea[]; usage: IdeasUsage }
  | {
      ok: false;
      code:
        | "limit"
        | "limit_member"
        | "rate"
        | "budget_needed"
        | "no_budget_left"
        | "failed"
        | "not_configured"
        | "invalid_input";
      message: string;
      usage?: IdeasUsage;
    };

const FAILED = "Couldn't load ideas. Try again in a moment. This didn't use up a request.";

const requestSchema = z.object({
  recipientId: z.uuid(),
  kind: z.enum(["initial", "more_like_this", "different_direction"]),
  previousTitles: z.array(z.string().max(120)).max(15).default([]),
  likedTitle: z.string().max(120).optional(),
  budget: z.string().max(20).optional(),
});

export async function requestIdeas(input: z.input<typeof requestSchema>): Promise<IdeasResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: FAILED };
  const req = parsed.data;
  const ctx = await getListContext();

  const { data: recipient } = await ctx.supabase
    .from("recipients")
    .select("*")
    .eq("id", req.recipientId)
    .eq("list_id", ctx.list.id)
    .maybeSingle();
  if (!recipient) return { ok: false, code: "failed", message: FAILED };

  // A budget is needed so ideas fit. Owners save it on the person; members use it just for this request.
  let budget = recipient.budget_cents;
  if (budget == null && req.budget) {
    budget = dollarsToCents(req.budget);
    if (budget == null || budget < 100 || budget > 10_000_000) {
      return { ok: false, code: "budget_needed", message: "Enter a budget like 25 or 50." };
    }
    if (ctx.isOwner) {
      await ctx.supabase.from("recipients").update({ budget_cents: budget }).eq("id", recipient.id);
      revalidatePath("/app", "layout");
    }
  }
  if (budget == null) {
    return { ok: false, code: "budget_needed", message: `About how much do you want to spend on ${recipient.name}?` };
  }

  const { data: gifts } = await ctx.supabase.from("gifts").select("*").eq("recipient_id", recipient.id);
  const remaining = budget - spentCents(gifts ?? []);
  if (remaining < 100) {
    return {
      ok: false,
      code: "no_budget_left",
      message: `You've reached ${recipient.name}'s budget. Raise their budget to get more ideas.`,
    };
  }

  if (!aiConfigured()) {
    return { ok: false, code: "not_configured", message: "Gift ideas aren't switched on yet. Please check back soon." };
  }

  const admin = createAdminClient();
  const { data: requestId, error: reserveError } = await admin.rpc("reserve_ai_request", {
    p_user: ctx.userId,
    p_list: ctx.list.id,
    p_recipient: recipient.id,
    p_kind: req.kind,
  });
  if (reserveError || !requestId) {
    const usage = await getUsage(ctx);
    if (reserveError?.message.includes("AI_LIMIT") && !ctx.isOwner) {
      return {
        ok: false,
        code: "limit_member",
        usage,
        message: `This list has used all ${usage.cap} idea requests. The list owner can unlock more with the Season Pass.`,
      };
    }
    if (reserveError?.message.includes("AI_LIMIT")) {
      return {
        ok: false,
        code: "limit",
        usage,
        message: ctx.hasPass
          ? `You've used all ${usage.cap} idea requests for this season.`
          : `You've used all ${usage.cap} free idea requests. Get 100 more with the Season Pass for $9.99.`,
      };
    }
    if (reserveError?.message.includes("AI_RATE_LIMIT")) {
      return { ok: false, code: "rate", usage, message: "That's a lot of ideas in one minute! Wait a moment, then try again." };
    }
    return { ok: false, code: "failed", usage, message: FAILED };
  }

  const { data: members } = await ctx.supabase.rpc("list_member_names", { p_list: ctx.list.id });
  const profile = buildProfile(recipient, (members ?? []).map((m) => m.display_name), remaining);
  const result = await generateIdeas({
    profile,
    kind: req.kind,
    previousTitles: req.previousTitles,
    likedTitle: req.likedTitle,
  });

  await admin.rpc("finish_ai_request", {
    p_id: requestId,
    p_success: result.ok,
    p_input_tokens: result.inputTokens,
    p_output_tokens: result.outputTokens,
  });
  const usage = await getUsage(ctx);
  if (!result.ok) return { ok: false, code: "failed", message: FAILED, usage };
  return { ok: true, ideas: result.ideas, usage };
}

async function getUsage(ctx: Awaited<ReturnType<typeof getListContext>>): Promise<IdeasUsage> {
  const { data } = await ctx.supabase.rpc("ai_usage", { p_list: ctx.list.id });
  return data?.[0] ?? { used: 0, cap: 10 };
}

const saveSchema = z.object({
  recipientId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  priceUsd: z.number().nonnegative().max(100_000),
  why: z.string().max(400).default(""),
});

/** One tap: turns an AI idea into a gift idea on the person's list. */
export async function saveIdeaAsGift(input: z.input<typeof saveSchema>): Promise<{ ok: boolean; message?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Couldn't save that idea. Please try again." };
  const ctx = await getListContext();
  const { data: recipient } = await ctx.supabase
    .from("recipients")
    .select("id, list_id")
    .eq("id", parsed.data.recipientId)
    .eq("list_id", ctx.list.id)
    .maybeSingle();
  if (!recipient) return { ok: false, message: "Couldn't save that idea. Please try again." };

  const { error } = await ctx.supabase.from("gifts").insert({
    list_id: recipient.list_id,
    recipient_id: recipient.id,
    title: parsed.data.title,
    price_cents: Math.round(parsed.data.priceUsd * 100),
    notes: parsed.data.why,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: "Couldn't save that idea. Please try again." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
