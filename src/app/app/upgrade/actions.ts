"use server";

import { redirect } from "next/navigation";
import { getListContext } from "@/lib/data/list";
import { env } from "@/lib/env";
import { checkoutSessionParams } from "@/lib/payments";
import { hasActivePass, seasonOver } from "@/lib/season";
import { serverEnv } from "@/lib/server-env";
import { getStripe } from "@/lib/stripe";
import { trackServer } from "@/lib/analytics-server";

export async function startCheckout(): Promise<{ error: string } | void> {
  const ctx = await getListContext();
  const { data: profile } = await ctx.supabase.from("profiles").select("paid_until").eq("id", ctx.userId).single();
  if (hasActivePass(profile?.paid_until)) redirect("/app/upgrade");
  if (seasonOver()) return { error: "The 2026 season has ended. Thanks for using GiftLedger!" };

  const stripe = getStripe();
  const priceId = serverEnv().STRIPE_PRICE_ID;
  if (!stripe || !priceId) return { error: "Checkout isn't switched on yet. Please check back soon." };

  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams({ userId: ctx.userId, email: ctx.email, appUrl: env.NEXT_PUBLIC_APP_URL, priceId }),
    );
    url = session.url;
  } catch {
    console.error("stripe_checkout_create_failed");
  }
  if (!url) return { error: "Couldn't open checkout. Please try again in a moment. You haven't been charged." };
  trackServer(ctx.userId, "checkout_started");
  redirect(url);
}

/** The success page asks this until the webhook has unlocked the pass. Never trusts the URL. */
export async function checkPassStatus(): Promise<{ active: boolean }> {
  const ctx = await getListContext();
  const { data } = await ctx.supabase.from("profiles").select("paid_until").eq("id", ctx.userId).single();
  return { active: hasActivePass(data?.paid_until) };
}
