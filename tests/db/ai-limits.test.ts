import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createInvite, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

let owner: TestUser;
let member: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, member, stranger] = await Promise.all([createTestUser("ai-owner"), createTestUser("ai-member"), createTestUser("ai-stranger")]);
  const { error } = await member.client.rpc("accept_invite", { p_token: await createInvite(owner) });
  if (error) throw error;
});
afterAll(async () => Promise.all([owner, member, stranger].map(deleteTestUser)));

async function reserve(user: TestUser, listId = owner.listId) {
  return admin.rpc("reserve_ai_request", { p_user: user.id, p_list: listId, p_recipient: null as unknown as string, p_kind: "initial" });
}
async function finish(id: string, success: boolean) {
  const { error } = await admin.rpc("finish_ai_request", { p_id: id, p_success: success, p_input_tokens: 700, p_output_tokens: 500 });
  if (error) throw error;
}

describe("AI request limits", () => {
  it("people can't reserve or finish requests themselves", async () => {
    const r = await owner.client.rpc("reserve_ai_request", { p_user: owner.id, p_list: owner.listId, p_recipient: null as unknown as string, p_kind: "initial" });
    expect(r.error).not.toBeNull();
    const f = await owner.client.rpc("finish_ai_request", { p_id: owner.id, p_success: false, p_input_tokens: 0, p_output_tokens: 0 });
    expect(f.error).not.toBeNull();
  });

  it("only people on the list can use its requests", async () => {
    const r = await reserve(stranger);
    expect(r.error?.message).toContain("NOT_A_MEMBER");
  });

  it("failed requests don't count; a free list stops at 10 successful requests, shared by the family", async () => {
    // Failed requests are free.
    for (let i = 0; i < 3; i++) {
      const r = await reserve(owner);
      expect(r.error).toBeNull();
      await finish(r.data as string, false);
    }
    // 10 successes, made by owner and member together.
    for (let i = 0; i < 10; i++) {
      const who = i % 2 === 0 ? owner : member;
      const r = await reserve(who);
      expect(r.error, `request ${i + 1}`).toBeNull();
      await finish(r.data as string, true);
    }
    const blocked = await reserve(member);
    expect(blocked.error?.message).toContain("AI_LIMIT");

    const usage = await member.client.rpc("ai_usage", { p_list: owner.listId });
    expect(usage.data?.[0]).toEqual({ used: 10, cap: 10 });
    expect((await stranger.client.rpc("ai_usage", { p_list: owner.listId })).data).toEqual([]);
  });

  it("finishing is one-time: a success can't be turned into a failure later", async () => {
    const before = (await member.client.rpc("ai_usage", { p_list: owner.listId })).data?.[0]?.used;
    const { data: rows } = await admin.from("ai_requests").select("id").eq("list_id", owner.listId).eq("status", "success").limit(1);
    await finish(rows![0].id, false);
    const after = (await member.client.rpc("ai_usage", { p_list: owner.listId })).data?.[0]?.used;
    expect(after).toBe(before);
  });

  it("a Season Pass raises the cap to 100", async () => {
    await givePass(owner);
    expect((await owner.client.rpc("ai_usage", { p_list: owner.listId })).data?.[0]?.cap).toBe(100);
  });

  it("each person can make at most 10 requests a minute", async () => {
    const busy = await createTestUser("ai-busy");
    try {
      await givePass(busy);
      for (let i = 0; i < 10; i++) {
        const r = await reserve(busy, busy.listId);
        expect(r.error).toBeNull();
        await finish(r.data as string, false);
      }
      const eleventh = await reserve(busy, busy.listId);
      expect(eleventh.error?.message).toContain("AI_RATE_LIMIT");
    } finally {
      await deleteTestUser(busy);
    }
  });

  it("people can see their own usage rows but not others'", async () => {
    const own = await owner.client.from("ai_requests").select("user_id");
    expect(own.data?.every((r) => r.user_id === owner.id)).toBe(true);
    expect((await stranger.client.from("ai_requests").select("id")).data).toEqual([]);
  });
});
