import type Stripe from "stripe";

/** Marks our Checkout sessions, in case the Stripe account is ever used for anything else. */
export const CHECKOUT_APP_TAG = "giftledger";

export function checkoutSessionParams(opts: {
  userId: string;
  email: string;
  appUrl: string;
  priceId: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    line_items: [{ price: opts.priceId, quantity: 1 }],
    client_reference_id: opts.userId,
    customer_email: opts.email || undefined,
    metadata: { app: CHECKOUT_APP_TAG, user_id: opts.userId },
    payment_intent_data: { metadata: { app: CHECKOUT_APP_TAG, user_id: opts.userId } },
    success_url: `${opts.appUrl}/app/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.appUrl}/app/upgrade?canceled=1`,
  };
}

export type WebhookAction =
  | {
      kind: "paid";
      eventId: string;
      sessionId: string;
      paymentIntent: string | null;
      userId: string;
      amount: number;
      currency: string;
    }
  | { kind: "refunded"; eventId: string; paymentIntent: string; amountRefunded: number; amount: number }
  | { kind: "ignore"; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Season Pass price in cents. A checkout for less than this never grants a pass. */
export const SEASON_PASS_CENTS = 999;

/**
 * Decides what a verified Stripe event means for us. Pure, so it's easy to test.
 * `expectLivemode` (from the secret key) stops a test-mode event unlocking anything in production.
 */
export function interpretEvent(event: Stripe.Event, expectLivemode?: boolean): WebhookAction {
  if (expectLivemode !== undefined && event.livemode !== expectLivemode) {
    return { kind: "ignore", reason: "wrong mode" };
  }
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.metadata?.app !== CHECKOUT_APP_TAG) return { kind: "ignore", reason: "not our checkout" };
      if (session.mode !== "payment") return { kind: "ignore", reason: "not a one-time payment" };
      // Some payment methods confirm later; we'll get async_payment_succeeded then.
      if (session.payment_status !== "paid") return { kind: "ignore", reason: "not paid yet" };
      if ((session.currency ?? "").toLowerCase() !== "usd" || (session.amount_total ?? 0) < SEASON_PASS_CENTS) {
        return { kind: "ignore", reason: "unexpected amount" };
      }
      const userId = session.client_reference_id ?? session.metadata?.user_id ?? "";
      if (!UUID.test(userId)) return { kind: "ignore", reason: "no user" };
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      return {
        kind: "paid",
        eventId: event.id,
        sessionId: session.id,
        paymentIntent,
        userId,
        amount: session.amount_total ?? 0,
        currency: "usd",
      };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntent =
        typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
      if (!paymentIntent) return { kind: "ignore", reason: "no payment intent" };
      return {
        kind: "refunded",
        eventId: event.id,
        paymentIntent,
        amountRefunded: charge.amount_refunded,
        amount: charge.amount,
      };
    }
    default:
      return { kind: "ignore", reason: `unhandled ${event.type}` };
  }
}
