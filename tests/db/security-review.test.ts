import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createInvite, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

// Regression tests for every finding in security review #1 (PROGRESS.md).

const MAILPIT = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function emailCount(email: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  return ((await res.json()) as { messages: unknown[] }).messages.length;
}

async function latestCode(email: string, after = 0) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages: { Subject: string }[] };
    const code = body.messages.length > after ? body.messages[0]?.Subject.match(/(\d{6})/)?.[1] : undefined;
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no code email");
}

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;
beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([createTestUser("sr-owner"), createTestUser("sr-member"), createTestUser("sr-out")]);
  await member.client.rpc("accept_invite", { p_token: await createInvite(owner) });
});
afterAll(async () => Promise.all([owner, member, outsider].map(deleteTestUser)));

describe("H1: a password someone else set doesn't survive the real owner signing in", () => {
  it("attacker pre-registers with a password; the victim signs in by code; the password no longer works", async () => {
    const email = `victim-${randomUUID().slice(0, 8)}@test.giftledger.local`;
    const password = `Attacker-${randomBytes(8).toString("hex")}`;
    const attacker = anon();
    const signUp = await attacker.auth.signUp({ email, password });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull(); // "Confirm email" is on: no session for the attacker
    expect((await anon().auth.signInWithPassword({ email, password })).error).not.toBeNull();

    // The real owner signs in with an emailed code (Supabase allows one email per address per second).
    await new Promise((r) => setTimeout(r, 1500));
    const before = await emailCount(email);
    const victim = anon();
    const otp = await victim.auth.signInWithOtp({ email });
    expect(otp.error?.message ?? null).toBeNull();
    const verified = await victim.auth.verifyOtp({ email, token: await latestCode(email, before), type: "email" });
    expect(verified.error).toBeNull();
    expect(verified.data.session).not.toBeNull();

    const later = await anon().auth.signInWithPassword({ email, password });
    expect(later.error).not.toBeNull();
    expect(later.data.session).toBeNull();
    await admin.auth.admin.deleteUser(verified.data.user!.id);
  });
});

describe("H2: AI prompts stay small and attempts are capped", () => {
  it("rejects interests longer than 30 characters, even straight through the API", async () => {
    const { error } = await owner.client
      .from("recipients")
      .insert({ list_id: owner.listId, name: "Big", created_by: owner.id, interests: ["x".repeat(31)] });
    expect(error?.message).toContain("recipients_interest_length");
  });

  it("stops after 30 attempts a day per person, even if they all failed", async () => {
    const busy = await createTestUser("sr-busy");
    try {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        user_id: busy.id,
        list_id: busy.listId,
        kind: "initial" as const,
        status: "failed" as const,
        created_at: new Date(Date.now() - (i + 2) * 60_000).toISOString(),
      }));
      expect((await admin.from("ai_requests").insert(rows)).error).toBeNull();
      const r = await admin.rpc("reserve_ai_request", { p_user: busy.id, p_list: busy.listId, p_recipient: null as unknown as string, p_kind: "initial" });
      expect(r.error?.message).toContain("AI_DAILY_LIMIT");
    } finally {
      await deleteTestUser(busy);
    }
  });
});

describe("L1: a member can't count people hidden from them", () => {
  it("list_plan only counts the people the member can see", async () => {
    await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Visible", created_by: owner.id });
    await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Member themself", created_by: owner.id, linked_user_id: member.id });
    const ownerCount = (await owner.client.rpc("list_plan", { p_list: owner.listId })).data?.[0]?.recipient_count;
    const memberCount = (await member.client.rpc("list_plan", { p_list: owner.listId })).data?.[0]?.recipient_count;
    const visible = (await member.client.from("recipients").select("id").eq("list_id", owner.listId)).data?.length;
    expect(memberCount).toBe(visible);
    expect(ownerCount).toBe((visible ?? 0) + 1);
  });
});

describe("L2: people can't choose an invite's dates or other system columns", () => {
  it("rejects a hand-picked expiry or creation date", async () => {
    const hash = createHash("sha256").update(randomUUID()).digest("hex");
    const { error } = await owner.client
      .from("invites")
      .insert({ list_id: owner.listId, token_hash: hash, created_by: owner.id, expires_at: "2099-01-01T00:00:00Z" });
    expect(error).not.toBeNull();
    const backdated = await owner.client
      .from("invites")
      .insert({ list_id: owner.listId, token_hash: hash, created_by: owner.id, created_at: "2000-01-01T00:00:00Z" });
    expect(backdated.error).not.toBeNull();
  });

  it("can't fake a gift's activity line", async () => {
    const r = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Act", created_by: owner.id }).select("id").single();
    const { error } = await member.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: r.data!.id, title: "x", created_by: member.id, status_changed_by: owner.id });
    expect(error).not.toBeNull();
  });
});

describe("L3 and L4: hide-from and buyer only name the right people", () => {
  let recipientId: string;
  beforeAll(async () => {
    const r = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Buyers", created_by: owner.id }).select("id").single();
    recipientId = r.data!.id;
  });

  it("can't hide a gift from someone who isn't on the list", async () => {
    const g = await owner.client.from("gifts").insert({ list_id: owner.listId, recipient_id: recipientId, title: "H", created_by: owner.id }).select("id").single();
    const { error } = await owner.client.from("gift_hidden_from").insert({ gift_id: g.data!.id, user_id: outsider.id });
    expect(error?.message).toContain("HIDDEN_USER_NOT_MEMBER");
  });

  it("members can record only themselves as the buyer; the owner can record anyone on the list", async () => {
    const asOwner = await member.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "M1", created_by: member.id, bought_by: owner.id });
    expect(asOwner.error?.message).toContain("BUYER_NOT_ALLOWED");
    const asSelf = await member.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "M2", created_by: member.id, bought_by: member.id });
    expect(asSelf.error).toBeNull();
    const byOwner = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "O1", created_by: owner.id, bought_by: member.id });
    expect(byOwner.error).toBeNull();
  });
});

describe("L5: refunds and payments arriving in any order", () => {
  it("a refund that arrives first means the later payment event grants nothing", async () => {
    const buyer = await createTestUser("sr-buyer");
    try {
      const intent = `pi_${randomUUID()}`;
      await admin.rpc("record_charge_refunded", { p_event_id: `evt_${randomUUID()}`, p_payment_intent: intent, p_amount_refunded: 999, p_amount: 999 });
      await admin.rpc("record_checkout_paid", {
        p_event_id: `evt_${randomUUID()}`, p_session_id: `cs_${randomUUID()}`, p_payment_intent: intent,
        p_user: buyer.id, p_amount: 999, p_currency: "usd",
      });
      expect((await admin.from("profiles").select("paid_until").eq("id", buyer.id).single()).data?.paid_until).toBeNull();
      const { data } = await admin.from("payments").select("status, user_id").eq("stripe_payment_intent_id", intent).single();
      expect(data).toEqual({ status: "refunded", user_id: buyer.id });
    } finally {
      await deleteTestUser(buyer);
    }
  });

  it("a second payment event after a refund doesn't bring the pass back", async () => {
    const buyer = await createTestUser("sr-buyer2");
    try {
      const intent = `pi_${randomUUID()}`;
      const session = `cs_${randomUUID()}`;
      const pay = () =>
        admin.rpc("record_checkout_paid", {
          p_event_id: `evt_${randomUUID()}`, p_session_id: session, p_payment_intent: intent, p_user: buyer.id, p_amount: 999, p_currency: "usd",
        });
      await pay();
      await admin.rpc("record_charge_refunded", { p_event_id: `evt_${randomUUID()}`, p_payment_intent: intent, p_amount_refunded: 999, p_amount: 999 });
      await pay();
      expect((await admin.from("profiles").select("paid_until").eq("id", buyer.id).single()).data?.paid_until).toBeNull();
    } finally {
      await deleteTestUser(buyer);
    }
  });
});

describe("L6: nothing is open by default", () => {
  it("no function in public or private can be run by signed-out visitors", () => {
    const out = execFileSync("psql", [
      DB_URL,
      "-Atc",
      `select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')`,
    ]).toString().trim();
    expect(out).toBe("");
  });

  it("server-only functions can't be run by signed-in people", () => {
    const out = execFileSync("psql", [
      DB_URL,
      "-Atc",
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') order by 1`,
    ]).toString().trim().split("\n");
    expect(out).toEqual(["accept_invite", "ai_usage", "invite_preview", "list_member_names", "list_plan", "set_gift_status"]);
  });
});

describe("L9: removing an account outside the app leaves no orphaned lists", () => {
  it("a solo list is deleted; a shared list passes to the earliest member", async () => {
    const solo = await createTestUser("sr-solo");
    await admin.from("recipients").insert({ list_id: solo.listId, name: "Orphan" });
    await admin.auth.admin.deleteUser(solo.id);
    expect((await admin.from("lists").select("id").eq("id", solo.listId)).data).toEqual([]);
    expect((await admin.from("recipients").select("id").eq("list_id", solo.listId)).data).toEqual([]);

    const host = await createTestUser("sr-host");
    const heir = await createTestUser("sr-heir");
    await givePass(host);
    await heir.client.rpc("accept_invite", { p_token: await createInvite(host) });
    await admin.auth.admin.deleteUser(host.id);
    const { data } = await admin.from("list_members").select("user_id, role").eq("list_id", host.listId);
    expect(data).toEqual([{ user_id: heir.id, role: "owner" }]);
    await deleteTestUser(heir);
    await admin.from("lists").delete().eq("id", host.listId);
  });
});
