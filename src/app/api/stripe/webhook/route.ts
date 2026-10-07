import Stripe from "stripe";
import { NextResponse } from "next/server";
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

  const action = interpretEvent(event);
  const admin = createAdminClient();

  if (action.kind === "paid") {
    const { error } = await admin.rpc("record_checkout_paid", {
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
