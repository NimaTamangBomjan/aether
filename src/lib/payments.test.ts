import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { checkoutSessionParams, interpretEvent } from "./payments";

const USER = "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a";

function sessionEvent(over: Partial<Stripe.Checkout.Session> = {}, type = "checkout.session.completed"): Stripe.Event {
  return {
    id: "evt_1",
    type,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        client_reference_id: USER,
        metadata: { app: "giftledger", user_id: USER },
        payment_intent: "pi_1",
        amount_total: 999,
        currency: "usd",
        ...over,
      },
    },
  } as unknown as Stripe.Event;
}

describe("Checkout session", () => {
  it("is a one-time payment for one Season Pass, tagged with the user", () => {
    const p = checkoutSessionParams({ userId: USER, email: "m@example.com", appUrl: "https://giftledger.app", priceId: "price_123" });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(p.client_reference_id).toBe(USER);
    expect(p.metadata).toEqual({ app: "giftledger", user_id: USER });
    expect(p.success_url).toBe("https://giftledger.app/app/upgrade/success?session_id={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://giftledger.app/app/upgrade?canceled=1");
  });
});

describe("webhook events", () => {
  it("a paid checkout unlocks the pass for that user", () => {
    expect(interpretEvent(sessionEvent())).toEqual({
      kind: "paid",
      eventId: "evt_1",
      sessionId: "cs_test_1",
      paymentIntent: "pi_1",
      userId: USER,
      amount: 999,
      currency: "usd",
    });
    expect(interpretEvent(sessionEvent({}, "checkout.session.async_payment_succeeded")).kind).toBe("paid");
  });

  it("ignores unpaid, foreign, subscription or user-less checkouts", () => {
    expect(interpretEvent(sessionEvent({ payment_status: "unpaid" }))).toMatchObject({ kind: "ignore" });
    expect(interpretEvent(sessionEvent({ metadata: { app: "other" } }))).toMatchObject({ kind: "ignore" });
    expect(interpretEvent(sessionEvent({ mode: "subscription" }))).toMatchObject({ kind: "ignore" });
    expect(interpretEvent(sessionEvent({ client_reference_id: "nope", metadata: { app: "giftledger" } }))).toMatchObject({ kind: "ignore" });
  });

  it("a refund reports how much was refunded", () => {
    const event = {
      id: "evt_2",
      type: "charge.refunded",
      data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_1", amount: 999, amount_refunded: 999 } },
    } as unknown as Stripe.Event;
    expect(interpretEvent(event)).toEqual({ kind: "refunded", eventId: "evt_2", paymentIntent: "pi_1", amountRefunded: 999, amount: 999 });
  });

  it("ignores other events", () => {
    expect(interpretEvent({ id: "evt_3", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event)).toMatchObject({ kind: "ignore" });
  });
});
