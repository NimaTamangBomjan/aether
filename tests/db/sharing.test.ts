import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { admin, anon, createInvite, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;

beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([createTestUser("sh-owner"), createTestUser("sh-member"), createTestUser("sh-outsider")]);
  await givePass(owner);
  const { error } = await member.client.rpc("accept_invite", { p_token: await createInvite(owner) });
  if (error) throw error;
});
afterAll(async () => Promise.all([owner, member, outsider].map(deleteTestUser)));

describe("invites", () => {
  it("the join page preview shows the list, who invited you, and whether the link still works", async () => {
    const valid = await createInvite(owner);
    expect((await outsider.client.rpc("invite_preview", { p_token: valid })).data).toEqual([
      { list_name: "Holidays 2026", invited_by: "sh-owner", status: "valid" },
    ]);
    const expired = await createInvite(owner, { expired: true });
    expect((await outsider.client.rpc("invite_preview", { p_token: expired })).data?.[0]?.status).toBe("expired");
    expect((await outsider.client.rpc("invite_preview", { p_token: "nope" })).data).toEqual([]);
    expect((await anon().rpc("invite_preview", { p_token: valid })).error).not.toBeNull();
  });

  it("stores only a 64-character fingerprint, never a raw token", async () => {
    const { error } = await owner.client
      .from("invites")
      .insert({ list_id: owner.listId, token_hash: "raw-token-not-a-hash", created_by: owner.id });
    expect(error).not.toBeNull();
  });

  it("limits each person to 10 invites an hour", async () => {
    const busy = await createTestUser("sh-busy");
    try {
      for (let i = 0; i < 10; i++) {
        const hash = createHash("sha256").update(`busy-${i}-${Math.random()}`).digest("hex");
        const { error } = await busy.client.from("invites").insert({ list_id: busy.listId, token_hash: hash, created_by: busy.id });
        expect(error).toBeNull();
      }
      const hash = createHash("sha256").update(`busy-11-${Math.random()}`).digest("hex");
      const eleventh = await busy.client.from("invites").insert({ list_id: busy.listId, token_hash: hash, created_by: busy.id });
      expect(eleventh.error?.message).toContain("INVITE_RATE_LIMIT");
    } finally {
      await deleteTestUser(busy);
    }
  });
});

describe("only people on the list can be linked, hidden from or recorded as buyer", () => {
  let recipientId: string;
  let giftId: string;
  beforeAll(async () => {
    const r = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Pop", created_by: owner.id }).select("id").single();
    recipientId = r.data!.id;
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Tie", created_by: owner.id })
      .select("id")
      .single();
    giftId = g.data!.id;
  });

  it("can't link a person to someone outside the list", async () => {
    const { error } = await owner.client.from("recipients").update({ linked_user_id: outsider.id }).eq("id", recipientId);
    expect(error?.message).toContain("LINKED_USER_NOT_MEMBER");
    const ok = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "M", created_by: owner.id, linked_user_id: member.id });
    expect(ok.error).toBeNull();
  });

  it("can't record an outsider as the buyer", async () => {
    const { error } = await owner.client.from("gifts").update({ bought_by: outsider.id }).eq("id", giftId);
    expect(error?.message).toContain("BUYER_NOT_MEMBER");
    const ok = await owner.client.from("gifts").update({ bought_by: member.id }).eq("id", giftId).select("id");
    expect(ok.data).toHaveLength(1);
  });

  it("members can hide their own gift from the owner, but not someone else's gift", async () => {
    const mine = await member.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Surprise for owner", created_by: member.id })
      .select("id")
      .single();
    expect((await member.client.from("gift_hidden_from").insert({ gift_id: mine.data!.id, user_id: owner.id })).error).toBeNull();
    expect((await owner.client.from("gifts").select("id").eq("id", mine.data!.id)).data).toEqual([]);

    const notMine = await member.client.from("gift_hidden_from").insert({ gift_id: giftId, user_id: owner.id });
    expect(notMine.error).not.toBeNull();
    expect((await admin.from("gift_hidden_from").select("*").eq("gift_id", giftId)).data).toEqual([]);
  });
});
