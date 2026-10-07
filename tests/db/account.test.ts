import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createInvite, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;

beforeAll(async () => {
  [owner, member, outsider] = await Promise.all([createTestUser("acct-owner"), createTestUser("acct-member"), createTestUser("acct-out")]);
  await member.client.rpc("accept_invite", { p_token: await createInvite(owner) });
});
afterAll(async () => Promise.all([owner, member, outsider].map(deleteTestUser)));

describe("handing over a list", () => {
  it("people can't call it themselves", async () => {
    const { error } = await member.client.rpc("transfer_list_ownership", { p_list: owner.listId, p_from: owner.id, p_to: member.id });
    expect(error).not.toBeNull();
  });

  it("only to a member, and only from the owner", async () => {
    expect((await admin.rpc("transfer_list_ownership", { p_list: owner.listId, p_from: owner.id, p_to: outsider.id })).error?.message).toContain("NOT_A_MEMBER");
    expect((await admin.rpc("transfer_list_ownership", { p_list: owner.listId, p_from: member.id, p_to: owner.id })).error?.message).toContain("NOT_OWNER");
  });

  it("swaps roles, and the new owner's own plan applies", async () => {
    await givePass(owner);
    expect((await member.client.rpc("list_plan", { p_list: owner.listId })).data?.[0]?.has_pass).toBe(true);

    expect((await admin.rpc("transfer_list_ownership", { p_list: owner.listId, p_from: owner.id, p_to: member.id })).error).toBeNull();
    const { data } = await admin.from("list_members").select("user_id, role").eq("list_id", owner.listId);
    expect(data?.find((r) => r.user_id === member.id)?.role).toBe("owner");
    expect(data?.find((r) => r.user_id === owner.id)?.role).toBe("member");
    // The Season Pass belonged to the old owner, so the list is back on the free plan.
    expect((await member.client.rpc("list_plan", { p_list: owner.listId })).data?.[0]?.has_pass).toBe(false);
  });
});

describe("deleting an account", () => {
  it("removes the person's data but keeps payment records without their identity", async () => {
    const gone = await createTestUser("acct-gone");
    await admin.from("payments").insert({ user_id: gone.id, stripe_session_id: `cs_${gone.id}`, amount_cents: 999, status: "paid" });
    await admin.from("ai_requests").insert({ user_id: gone.id, list_id: gone.listId, kind: "initial", status: "success" });
    await admin.from("lists").delete().eq("id", gone.listId);
    expect((await admin.auth.admin.deleteUser(gone.id)).error).toBeNull();

    expect((await admin.from("profiles").select("id").eq("id", gone.id)).data).toEqual([]);
    expect((await admin.from("list_members").select("user_id").eq("user_id", gone.id)).data).toEqual([]);
    const { data: payment } = await admin.from("payments").select("user_id, amount_cents").eq("stripe_session_id", `cs_${gone.id}`).single();
    expect(payment).toEqual({ user_id: null, amount_cents: 999 });
  });
});
