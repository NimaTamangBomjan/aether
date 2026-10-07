import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createInvite, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

// 9:00 AM Eastern on Dec 20, 2026: the moment the daily job runs.
const NOW = "2026-12-20T14:00:00Z";

let owner: TestUser;
let member: TestUser;
let kiwi: TestUser; // lives in New Zealand, where it's already Dec 21
let recipientId: string;

async function gift(list: string, recipient: string, title: string, status: string, returnBy: string, boughtBy?: string) {
  const { data, error } = await admin
    .from("gifts")
    .insert({ list_id: list, recipient_id: recipient, title, status: status as "bought", return_by: returnBy, bought_by: boughtBy ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function due(userId: string) {
  const { data, error } = await admin.rpc("due_reminders", { p_now: NOW });
  if (error) throw error;
  return (data ?? []).filter((r) => r.user_id === userId);
}

beforeAll(async () => {
  [owner, member, kiwi] = await Promise.all([createTestUser("rem-owner"), createTestUser("rem-member"), createTestUser("rem-kiwi")]);
  await givePass(owner);
  await givePass(kiwi);
  await member.client.rpc("accept_invite", { p_token: await createInvite(owner) });
  await admin.from("profiles").update({ time_zone: "Pacific/Auckland" }).eq("id", kiwi.id);
  const r = await admin.from("recipients").insert({ list_id: owner.listId, name: "Grandma" }).select("id").single();
  recipientId = r.data!.id;

  await gift(owner.listId, recipientId, "Scarf (3 days)", "bought", "2026-12-23");
  await gift(owner.listId, recipientId, "Book (today)", "wrapped", "2026-12-20");
  await gift(owner.listId, recipientId, "Mug (2 days)", "bought", "2026-12-22");
  await gift(owner.listId, recipientId, "Idea only", "idea", "2026-12-23");
  await gift(owner.listId, recipientId, "Already given", "given", "2026-12-23");
  await gift(owner.listId, recipientId, "Member bought", "bought", "2026-12-23", member.id);
  const hidden = await gift(owner.listId, recipientId, "Hidden from member", "bought", "2026-12-23", member.id);
  await admin.from("gift_hidden_from").insert({ gift_id: hidden, user_id: member.id });

  const k = await admin.from("recipients").insert({ list_id: kiwi.listId, name: "Mate" }).select("id").single();
  await gift(kiwi.listId, k.data!.id, "Kiwi gift", "bought", "2026-12-24");
});
afterAll(async () => Promise.all([owner, member, kiwi].map(deleteTestUser)));

describe("who gets which reminder", () => {
  it("3 days before and on the day, only for Bought or Wrapped gifts", async () => {
    const rows = await due(owner.id);
    expect(rows.map((r) => r.gift_title).sort()).toEqual(["Book (today)", "Scarf (3 days)"]);
    expect(rows.find((r) => r.gift_title === "Book (today)")?.days_left).toBe(0);
    expect(rows[0].local_date).toBe("2026-12-20");
    expect(rows[0].email).toBe(owner.email);
  });

  it("goes to whoever marked it bought, and never includes a gift hidden from them", async () => {
    const rows = await due(member.id);
    expect(rows.map((r) => r.gift_title)).toEqual(["Member bought"]);
  });

  it("uses each person's own date: it's already Dec 21 in New Zealand", async () => {
    const rows = await due(kiwi.id);
    expect(rows.map((r) => r.gift_title)).toEqual(["Kiwi gift"]);
    expect(rows[0].local_date).toBe("2026-12-21");
  });

  it("needs a Season Pass and reminders switched on", async () => {
    await admin.from("profiles").update({ email_reminders: false }).eq("id", member.id);
    expect(await due(member.id)).toEqual([]);
    await admin.from("profiles").update({ email_reminders: true }).eq("id", member.id);

    await admin.from("profiles").update({ paid_until: null }).eq("id", owner.id);
    expect(await due(owner.id)).toEqual([]);
    expect(await due(member.id)).toEqual([]);
    await givePass(owner);
  });

  it("people can't call the reminder functions themselves", async () => {
    expect((await owner.client.rpc("due_reminders", { p_now: NOW })).error).not.toBeNull();
    expect((await owner.client.rpc("claim_reminder", { p_user: owner.id, p_local_date: "2026-12-20", p_gift_ids: [] })).error).not.toBeNull();
  });
});

describe("running the job twice the same day", () => {
  it("claims each person's email once; only a failed send can be retried", async () => {
    const args = { p_user: kiwi.id, p_local_date: "2026-12-21", p_gift_ids: [] as string[] };
    expect((await admin.rpc("claim_reminder", args)).data).toBe(true);
    expect((await admin.rpc("claim_reminder", args)).data).toBe(false);

    await admin.rpc("finish_reminder", { p_user: kiwi.id, p_local_date: "2026-12-21", p_sent: false });
    expect((await admin.rpc("claim_reminder", args)).data).toBe(true);
    await admin.rpc("finish_reminder", { p_user: kiwi.id, p_local_date: "2026-12-21", p_sent: true });
    expect((await admin.rpc("claim_reminder", args)).data).toBe(false);

    // A new day is a new email.
    expect((await admin.rpc("claim_reminder", { ...args, p_local_date: "2026-12-22" })).data).toBe(true);
  });
});
