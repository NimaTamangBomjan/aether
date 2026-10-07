import Stripe from "stripe";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { passReceiptEmail } from "@/lib/email/templates";
import { interpretEvent } from "@/lib/payments";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe tells us about payments here. This is the only thing that unlocks the Season Pass:
// the signature proves the message is really from Stripe, and each event is applied once.
export async function POST(request: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const key = serverEnv().STRIPE_SECRET_KEY;
  const action = interpretEvent(event, key ? key.startsWith("sk_live_") || key.startsWith("rk_live_") : undefined);
  const admin = createAdminClient();

  if (action.kind === "paid") {
    const { data: applied, error } = await admin.rpc("record_checkout_paid", {
      p_event_id: action.eventId,
      p_session_id: action.sessionId,
      p_payment_intent: action.paymentIntent as string,
      p_user: action.userId,
      p_amount: action.amount,
      p_currency: action.currency,
    });
    if (error) {
      console.error(`stripe_webhook_failed event=${event.id} type=${event.type}`);
      return NextResponse.json({ error: "try again" }, { status: 500 }); // Stripe will retry
    }
    if (applied) await sendThankYou(admin, action.userId, action.amount, event.id);
  } else if (action.kind === "refunded") {
    const { error } = await admin.rpc("record_charge_refunded", {
      p_event_id: action.eventId,
      p_payment_intent: action.paymentIntent,
      p_amount_refunded: action.amountRefunded,
      p_amount: action.amount,
    });
    if (error) {
      console.error(`stripe_webhook_failed event=${event.id} type=${event.type}`);
      return NextResponse.json({ error: "try again" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function sendThankYou(admin: ReturnType<typeof createAdminClient>, userId: string, amount: number, eventId: string) {
  const [{ data: user }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  const email = user?.user?.email;
  if (!email) return;
  await sendEmail(email, passReceiptEmail({ name: profile?.display_name ?? "", amountCents: amount, appUrl: env.NEXT_PUBLIC_APP_URL }), {
    tag: "receipt",
    idempotencyKey: `receipt-${eventId}`,
  });
}
