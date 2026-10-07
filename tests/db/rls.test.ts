import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  createInvite,
  createTestUser,
  deleteTestUser,
  givePass,
  type TestUser,
} from "../helpers/supabase";

// These tests run against the local Supabase database with real row-level security.
// Three people: an owner, a family member who joins the owner's list, and a stranger.

let owner: TestUser;
let member: TestUser;
let stranger: TestUser;

async function addRecipient(user: TestUser, name: string, extra: Record<string, unknown> = {}) {
  return user.client
    .from("recipients")
    .insert({ list_id: user.listId, name, created_by: user.id, ...extra })
    .select("id")
    .single();
}

beforeAll(async () => {
  [owner, member, stranger] = await Promise.all([
    createTestUser("owner"),
    createTestUser("member"),
    createTestUser("stranger"),
  ]);
  const token = await createInvite(owner);
  const { error } = await member.client.rpc("accept_invite", { p_token: token });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all([owner, member, stranger].map(deleteTestUser));
});

describe("sign-up", () => {
  it("creates a profile, a list and an owner membership for every new account", async () => {
    const { data: profile } = await owner.client.from("profiles").select("*").single();
    expect(profile?.id).toBe(owner.id);
    expect(profile?.display_name).toBe("owner");
    expect(profile?.paid_until).toBeNull();

    const { data: list } = await owner.client.from("lists").select("*").eq("id", owner.listId).single();
    expect(list?.name).toBe("Holidays 2026");
  });
});

describe("a stranger", () => {
  let recipientId: string;
  let giftId: string;

  beforeAll(async () => {
    const { data, error } = await addRecipient(owner, "Grandma");
    if (error) throw error;
    recipientId = data.id;
    const gift = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Scarf", created_by: owner.id })
      .select("id")
      .single();
    if (gift.error) throw gift.error;
    giftId = gift.data.id;
    await createInvite(owner);
  });

  it("cannot read anything on someone else's list", async () => {
    const c = stranger.client;
    expect((await c.from("lists").select("id").eq("id", owner.listId)).data).toEqual([]);
    expect((await c.from("list_members").select("user_id").eq("list_id", owner.listId)).data).toEqual([]);
    expect((await c.from("recipients").select("id").eq("list_id", owner.listId)).data).toEqual([]);
    expect((await c.from("gifts").select("id").eq("list_id", owner.listId)).data).toEqual([]);
    expect((await c.from("invites").select("id").eq("list_id", owner.listId)).data).toEqual([]);
    expect((await c.from("profiles").select("id").eq("id", owner.id)).data).toEqual([]);
    expect((await c.rpc("list_member_names", { p_list: owner.listId })).data).toEqual([]);
  });

  it("cannot add, change or delete anything on someone else's list", async () => {
    const c = stranger.client;
    const insertRecipient = await c
      .from("recipients")
      .insert({ list_id: owner.listId, name: "Sneaky", created_by: stranger.id });
    expect(insertRecipient.error).not.toBeNull();

    const insertGift = await c
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Sneaky", created_by: stranger.id });
    expect(insertGift.error).not.toBeNull();

    const updateRecipient = await c.from("recipients").update({ name: "Changed" }).eq("id", recipientId).select();
    expect(updateRecipient.data ?? []).toEqual([]);
    const updateGift = await c.from("gifts").update({ title: "Changed" }).eq("id", giftId).select();
    expect(updateGift.data ?? []).toEqual([]);
    const updateList = await c.from("lists").update({ name: "Mine now" }).eq("id", owner.listId).select();
    expect(updateList.data ?? []).toEqual([]);

    await c.from("gifts").delete().eq("id", giftId);
    await c.from("recipients").delete().eq("id", recipientId);
    await c.from("list_members").delete().eq("list_id", owner.listId);

    const { data: stillThere } = await admin.from("gifts").select("title").eq("id", giftId).single();
    expect(stillThere?.title).toBe("Scarf");
    const { count } = await admin
      .from("list_members")
      .select("*", { count: "exact", head: true })
      .eq("list_id", owner.listId);
    expect(count).toBe(2);
  });

  it("cannot change gift status or join with a made-up invite", async () => {
    const status = await stranger.client.rpc("set_gift_status", { p_gift: giftId, p_status: "bought" });
    expect(status.error?.message).toContain("NOT_FOUND");
    const join = await stranger.client.rpc("accept_invite", { p_token: "not-a-real-token" });
    expect(join.error?.message).toContain("INVITE_INVALID");
  });
});

describe("someone who is not signed in", () => {
  it("sees nothing and can call nothing", async () => {
    const c = anon();
    for (const table of ["profiles", "lists", "list_members", "recipients", "gifts", "invites"] as const) {
      const { data } = await c.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
    const join = await c.rpc("accept_invite", { p_token: "x" });
    expect(join.error).not.toBeNull();
  });
});

describe("paid status and server-only tables", () => {
  it("users cannot give themselves a Season Pass", async () => {
    const { error } = await owner.client
      .from("profiles")
      .update({ paid_until: "2099-01-01T00:00:00Z" })
      .eq("id", owner.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("paid_until").eq("id", owner.id).single();
    expect(data?.paid_until).toBeNull();
  });

  it("users can update their own name and time zone", async () => {
    const { error } = await owner.client
      .from("profiles")
      .update({ display_name: "Maria", time_zone: "America/Chicago" })
      .eq("id", owner.id);
    expect(error).toBeNull();
    await owner.client.from("profiles").update({ display_name: "owner" }).eq("id", owner.id);
  });

  it("users cannot write payments, AI usage, Stripe events or reminder logs", async () => {
    const c = owner.client;
    expect(
      (await c.from("payments").insert({ user_id: owner.id, stripe_session_id: "cs_x", amount_cents: 999, status: "paid" }))
        .error,
    ).not.toBeNull();
    expect((await c.from("ai_requests").insert({ user_id: owner.id, kind: "initial" })).error).not.toBeNull();
    expect((await c.from("stripe_events").insert({ id: "evt_x", type: "x" })).error).not.toBeNull();
    expect((await c.from("stripe_events").select("*")).error).not.toBeNull();
    expect((await c.from("reminder_log").select("*")).error).not.toBeNull();
  });
});

describe("free plan limits enforced by the database", () => {
  let freeOwner: TestUser;
  beforeAll(async () => {
    freeOwner = await createTestUser("limits");
  });
  afterAll(async () => deleteTestUser(freeOwner));

  it("blocks the 6th person on a free list, and allows it with a Season Pass", async () => {
    for (let i = 1; i <= 5; i++) {
      const { error } = await addRecipient(freeOwner, `Person ${i}`);
      expect(error).toBeNull();
    }
    const sixth = await addRecipient(freeOwner, "Person 6");
    expect(sixth.error?.message).toContain("RECIPIENT_LIMIT");

    await givePass(freeOwner);
    const withPass = await addRecipient(freeOwner, "Person 6");
    expect(withPass.error).toBeNull();
  });

  it("archived people still count toward the limit", async () => {
    const other = await createTestUser("archive");
    try {
      for (let i = 1; i <= 5; i++) await addRecipient(other, `P${i}`);
      await other.client.from("recipients").update({ archived_at: new Date().toISOString() }).eq("list_id", other.listId);
      const sixth = await addRecipient(other, "P6");
      expect(sixth.error?.message).toContain("RECIPIENT_LIMIT");
    } finally {
      await deleteTestUser(other);
    }
  });
});

describe("invites", () => {
  let host: TestUser;
  let guestA: TestUser;
  let guestB: TestUser;
  beforeAll(async () => {
    [host, guestA, guestB] = await Promise.all([
      createTestUser("host"),
      createTestUser("guest-a"),
      createTestUser("guest-b"),
    ]);
  });
  afterAll(async () => Promise.all([host, guestA, guestB].map(deleteTestUser)));

  it("only stores a fingerprint of the token, never the token", async () => {
    const token = await createInvite(host);
    const { data } = await host.client.from("invites").select("token_hash").eq("list_id", host.listId);
    expect(data?.some((row) => row.token_hash === token)).toBe(false);
  });

  it("rejects expired invites", async () => {
    const token = await createInvite(host, { expired: true });
    const { error } = await guestA.client.rpc("accept_invite", { p_token: token });
    expect(error?.message).toContain("INVITE_INVALID");
  });

  it("is single use, and a free list allows only one member", async () => {
    const token = await createInvite(host);
    const first = await guestA.client.rpc("accept_invite", { p_token: token });
    expect(first.error).toBeNull();
    expect(first.data).toBe(host.listId);

    const reused = await guestB.client.rpc("accept_invite", { p_token: token });
    expect(reused.error?.message).toContain("INVITE_INVALID");

    const second = await createInvite(host);
    const overLimit = await guestB.client.rpc("accept_invite", { p_token: second });
    expect(overLimit.error?.message).toContain("MEMBER_LIMIT");

    await givePass(host);
    const withPass = await guestB.client.rpc("accept_invite", { p_token: second });
    expect(withPass.error).toBeNull();
  });

  it("members can only be invited by the owner", async () => {
    const { error } = await guestA.client
      .from("invites")
      .insert({ list_id: host.listId, token_hash: "x".repeat(64), created_by: guestA.id });
    expect(error).not.toBeNull();
  });
});

describe("a family member", () => {
  let recipientId: string;
  let ownerGiftId: string;

  beforeAll(async () => {
    const r = await addRecipient(owner, "Uncle Ben");
    if (r.error) throw r.error;
    recipientId = r.data.id;
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Book", price_cents: 2500, created_by: owner.id })
      .select("id")
      .single();
    if (g.error) throw g.error;
    ownerGiftId = g.data.id;
  });

  it("can see the list, its people, gifts and member names", async () => {
    const c = member.client;
    expect((await c.from("recipients").select("id").eq("id", recipientId)).data).toHaveLength(1);
    expect((await c.from("gifts").select("id").eq("id", ownerGiftId)).data).toHaveLength(1);
    const names = (await c.rpc("list_member_names", { p_list: owner.listId })).data ?? [];
    expect(names.map((n: { role: string }) => n.role).sort()).toEqual(["member", "owner"]);
  });

  it("cannot add or edit people, budgets or invites", async () => {
    const c = member.client;
    expect((await c.from("recipients").insert({ list_id: owner.listId, name: "X", created_by: member.id })).error).not.toBeNull();
    expect((await c.from("recipients").update({ budget_cents: 1 }).eq("id", recipientId).select()).data ?? []).toEqual([]);
    expect((await c.from("lists").update({ overall_budget_cents: 1 }).eq("id", owner.listId).select()).data ?? []).toEqual([]);
  });

  it("can add a gift and edit their own, but not edit the owner's gift directly", async () => {
    const c = member.client;
    const mine = await c
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Mug", created_by: member.id })
      .select("id")
      .single();
    expect(mine.error).toBeNull();
    const edited = await c.from("gifts").update({ title: "Big mug" }).eq("id", mine.data!.id).select();
    expect(edited.data).toHaveLength(1);
    const notMine = await c.from("gifts").update({ title: "Hacked" }).eq("id", ownerGiftId).select();
    expect(notMine.data ?? []).toEqual([]);
  });

  it("can mark any visible gift bought, which records them as the buyer", async () => {
    const { error } = await member.client.rpc("set_gift_status", { p_gift: ownerGiftId, p_status: "bought" });
    expect(error).toBeNull();
    const { data } = await admin
      .from("gifts")
      .select("status, bought_by, status_changed_by, status_changed_at")
      .eq("id", ownerGiftId)
      .single();
    expect(data?.status).toBe("bought");
    expect(data?.bought_by).toBe(member.id);
    expect(data?.status_changed_by).toBe(member.id);
    expect(data?.status_changed_at).not.toBeNull();
  });

  it("can leave a list, but cannot remove the owner", async () => {
    const leaver = await createTestUser("leaver");
    const host = await createTestUser("leave-host");
    try {
      await givePass(host);
      await leaver.client.rpc("accept_invite", { p_token: await createInvite(host) });
      await leaver.client.from("list_members").delete().eq("list_id", host.listId).eq("user_id", host.id);
      const { count: afterOwnerAttempt } = await admin
        .from("list_members")
        .select("*", { count: "exact", head: true })
        .eq("list_id", host.listId);
      expect(afterOwnerAttempt).toBe(2);

      await leaver.client.from("list_members").delete().eq("list_id", host.listId).eq("user_id", leaver.id);
      const { count: afterLeave } = await admin
        .from("list_members")
        .select("*", { count: "exact", head: true })
        .eq("list_id", host.listId);
      expect(afterLeave).toBe(1);
    } finally {
      await Promise.all([deleteTestUser(leaver), deleteTestUser(host)]);
    }
  });
});

describe("hidden gifts (surprises)", () => {
  let recipientId: string;

  beforeAll(async () => {
    const r = await addRecipient(owner, "Cousin Sam");
    if (r.error) throw r.error;
    recipientId = r.data.id;
  });

  it("a gift hidden from a member never reaches them, including its hidden-from rows", async () => {
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Secret watch", created_by: owner.id })
      .select("id")
      .single();
    expect(g.error).toBeNull();
    const giftId = g.data!.id;
    const hide = await owner.client.from("gift_hidden_from").insert({ gift_id: giftId, user_id: member.id });
    expect(hide.error).toBeNull();

    expect((await member.client.from("gifts").select("id").eq("id", giftId)).data).toEqual([]);
    expect((await member.client.from("gifts").select("title").eq("list_id", owner.listId)).data?.map((x) => x.title))
      .not.toContain("Secret watch");
    expect((await member.client.from("gift_hidden_from").select("*").eq("gift_id", giftId)).data).toEqual([]);
    const status = await member.client.rpc("set_gift_status", { p_gift: giftId, p_status: "bought" });
    expect(status.error?.message).toContain("NOT_FOUND");
    // The owner still sees it.
    expect((await owner.client.from("gifts").select("id").eq("id", giftId)).data).toHaveLength(1);
  });

  it("nobody can hide a gift from themselves", async () => {
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Plain", created_by: owner.id })
      .select("id")
      .single();
    const { error } = await owner.client.from("gift_hidden_from").insert({ gift_id: g.data!.id, user_id: owner.id });
    expect(error).not.toBeNull();
  });

  it("members cannot un-hide a gift hidden from them", async () => {
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: recipientId, title: "Hidden 2", created_by: owner.id })
      .select("id")
      .single();
    await owner.client.from("gift_hidden_from").insert({ gift_id: g.data!.id, user_id: member.id });
    await member.client.from("gift_hidden_from").delete().eq("gift_id", g.data!.id);
    const { count } = await admin
      .from("gift_hidden_from")
      .select("*", { count: "exact", head: true })
      .eq("gift_id", g.data!.id);
    expect(count).toBe(1);
  });

  it("a person linked to a member is invisible to that member, with all their gifts", async () => {
    const r = await addRecipient(owner, "Alex (member)", { linked_user_id: member.id });
    expect(r.error).toBeNull();
    const linkedId = r.data!.id;
    const g = await owner.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: linkedId, title: "Headphones", created_by: owner.id })
      .select("id")
      .single();
    expect(g.error).toBeNull();

    expect((await member.client.from("recipients").select("id").eq("id", linkedId)).data).toEqual([]);
    expect((await member.client.from("gifts").select("id").eq("recipient_id", linkedId)).data).toEqual([]);
    const add = await member.client
      .from("gifts")
      .insert({ list_id: owner.listId, recipient_id: linkedId, title: "Peek", created_by: member.id });
    expect(add.error).not.toBeNull();
  });

  it("the owner can be surprised too: a gift for the owner's linked person is hidden from the owner", async () => {
    const host = await createTestUser("surprise-owner");
    const partner = await createTestUser("partner");
    try {
      await partner.client.rpc("accept_invite", { p_token: await createInvite(host) });
      // No .select() here: once linked, the owner can no longer read this row back.
      const me = await host.client
        .from("recipients")
        .insert({ list_id: host.listId, name: "Me", created_by: host.id, linked_user_id: host.id });
      expect(me.error).toBeNull();
      const { data: rows } = await admin.from("recipients").select("id").eq("list_id", host.listId).eq("name", "Me");
      const gift = await partner.client
        .from("gifts")
        .insert({ list_id: host.listId, recipient_id: rows![0].id, title: "Necklace", created_by: partner.id })
        .select("id")
        .single();
      expect(gift.error).toBeNull();
      expect((await host.client.from("gifts").select("id").eq("id", gift.data!.id)).data).toEqual([]);
      expect((await partner.client.from("gifts").select("id").eq("id", gift.data!.id)).data).toHaveLength(1);
    } finally {
      await Promise.all([deleteTestUser(host), deleteTestUser(partner)]);
    }
  });
});
