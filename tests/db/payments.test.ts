import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, createTestUser, deleteTestUser, type TestUser } from "../helpers/supabase";

let buyer: TestUser;
beforeAll(async () => {
  buyer = await createTestUser("payer");
});
afterAll(async () => deleteTestUser(buyer));

const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

async function paid(user: string, opts: { event?: string; session?: string; intent?: string } = {}) {
  return admin.rpc("record_checkout_paid", {
    p_event_id: opts.event ?? id("evt"),
    p_session_id: opts.session ?? id("cs"),
    p_payment_intent: opts.intent ?? id("pi"),
    p_user: user,
    p_amount: 999,
    p_currency: "USD",
  });
}
async function refunded(intent: string, refundedCents: number, event = id("evt")) {
  return admin.rpc("record_charge_refunded", { p_event_id: event, p_payment_intent: intent, p_amount_refunded: refundedCents, p_amount: 999 });
}
async function paidUntil(userId: string) {
  return (await admin.from("profiles").select("paid_until").eq("id", userId).single()).data?.paid_until ?? null;
}

describe("payments (webhook only)", () => {
  it("people can't record payments or refunds themselves", async () => {
    const r = await buyer.client.rpc("record_checkout_paid", {
      p_event_id: "evt_x", p_session_id: "cs_x", p_payment_intent: "pi_x", p_user: buyer.id, p_amount: 999, p_currency: "usd",
    });
    expect(r.error).not.toBeNull();
    expect((await buyer.client.rpc("record_charge_refunded", { p_event_id: "e", p_payment_intent: "p", p_amount_refunded: 1, p_amount: 1 })).error).not.toBeNull();
    expect(await paidUntil(buyer.id)).toBeNull();
  });

  it("a paid checkout unlocks the pass through Jan 31, 2027, and the same event twice changes nothing", async () => {
    const event = id("evt");
    const session = id("cs");
    const first = await paid(buyer.id, { event, session });
    expect(first.data).toBe(true);
    expect(new Date((await paidUntil(buyer.id))!).toISOString()).toBe("2027-02-01T05:00:00.000Z");

    const again = await paid(buyer.id, { event, session });
    expect(again.data).toBe(false);
    const { count } = await admin.from("payments").select("*", { count: "exact", head: true }).eq("stripe_session_id", session);
    expect(count).toBe(1);

    const { data: mine } = await buyer.client.from("payments").select("amount_cents, currency, status");
    expect(mine).toEqual([{ amount_cents: 999, currency: "usd", status: "paid" }]);
  });

  it("a partial refund keeps the pass; a full refund removes it; repeats are ignored", async () => {
    const user = await createTestUser("refund");
    try {
      const intent = id("pi");
      await paid(user.id, { intent });
      expect(await paidUntil(user.id)).not.toBeNull();

      expect((await refunded(intent, 300)).data).toBe(true);
      expect(await paidUntil(user.id)).not.toBeNull();
      expect((await admin.from("payments").select("status").eq("stripe_payment_intent_id", intent).single()).data?.status).toBe("partially_refunded");

      const fullEvent = id("evt");
      expect((await refunded(intent, 999, fullEvent)).data).toBe(true);
      expect(await paidUntil(user.id)).toBeNull();
      expect((await admin.from("payments").select("status, refunded_at").eq("stripe_payment_intent_id", intent).single()).data).toMatchObject({ status: "refunded" });
      expect((await refunded(intent, 999, fullEvent)).data).toBe(false);
    } finally {
      await deleteTestUser(user);
    }
  });

  it("a refund doesn't remove a pass that another payment still covers", async () => {
    const user = await createTestUser("twice");
    try {
      const firstIntent = id("pi");
      await paid(user.id, { intent: firstIntent });
      await paid(user.id);
      await refunded(firstIntent, 999);
      expect(await paidUntil(user.id)).not.toBeNull();
    } finally {
      await deleteTestUser(user);
    }
  });

  it("a payment for a deleted account is still recorded, without a person attached", async () => {
    const session = id("cs");
    const res = await paid(randomUUID(), { session });
    expect(res.error).toBeNull();
    const { data } = await admin.from("payments").select("user_id").eq("stripe_session_id", session).single();
    expect(data?.user_id).toBeNull();
  });

  it("nobody can read the processed-events list", async () => {
    expect((await buyer.client.from("stripe_events").select("id")).error).not.toBeNull();
  });
});
