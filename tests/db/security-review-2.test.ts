import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createTestUser, deleteTestUser, givePass, type TestUser } from "../helpers/supabase";

// Regression tests for every database finding in security review #2 (PROGRESS.md).

const MAILPIT = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function sql(query: string) {
  return execFileSync("psql", [DB_URL, "-Atc", query]).toString().trim();
}

async function mailTo(email: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await res.json()) as { messages: { ID: string }[] };
  return Promise.all(
    body.messages.map(async (m) => (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { HTML: string; Text: string }),
  );
}

const hash = () => randomBytes(32).toString("hex");

let owner: TestUser;
let other: TestUser;
beforeAll(async () => {
  [owner, other] = await Promise.all([createTestUser("sr2-owner"), createTestUser("sr2-other")]);
});
afterAll(async () => Promise.all([owner, other].map(deleteTestUser)));

describe("M1: nobody can add a password or move an account to another email address", () => {
  it("a password set by a signed-in session never works", async () => {
    const user = await createTestUser("sr2-pw");
    try {
      const password = `Backdoor-${randomBytes(8).toString("hex")}`;
      await user.client.auth.updateUser({ password });
      const attempt = await anon().auth.signInWithPassword({ email: user.email, password });
      expect(attempt.error).not.toBeNull();
      expect(attempt.data.session).toBeNull();
    } finally {
      await deleteTestUser(user);
    }
  });

  it("changing the account's email is refused, and the email sent carries no link", async () => {
    const user = await createTestUser("sr2-mail");
    const victim = `sr2-victim-${randomUUID().slice(0, 8)}@test.giftledger.local`;
    try {
      const change = await user.client.auth.updateUser({ email: victim });
      expect(change.error).not.toBeNull();
      const { data } = await admin.auth.admin.getUserById(user.id);
      expect(data.user?.email).toBe(user.email);
      expect(data.user?.new_email ?? "").toBe("");
      expect(sql(`select coalesce(email_change, '') from auth.users where id = '${user.id}'`)).toBe("");
      for (const mail of await mailTo(victim)) {
        expect(mail.HTML + mail.Text).not.toMatch(/https?:\/\/|token/i);
      }
    } finally {
      await deleteTestUser(user);
    }
  });
});

describe("L2: names and titles can't carry line breaks into email subjects", () => {
  it("is refused straight through the API for every one-line field", async () => {
    const gift = await owner.client.from("gifts").insert({ list_id: owner.listId, recipient_id: randomUUID(), title: "Scarf\r\nBcc: x@evil.test" });
    expect(gift.error?.message).toMatch(/gifts_title_single_line|foreign key|violates/);
    const person = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Grandma\nBcc: x", created_by: owner.id });
    expect(person.error?.message).toContain("recipients_name_single_line");
    const { data: ok } = await owner.client.from("recipients").insert({ list_id: owner.listId, name: "Grandma", created_by: owner.id }).select("id").single();
    const title = await owner.client.from("gifts").insert({ list_id: owner.listId, recipient_id: ok!.id, title: "Scarf\r\nBcc: x" });
    expect(title.error?.message).toContain("gifts_title_single_line");
    const store = await owner.client.from("gifts").insert({ list_id: owner.listId, recipient_id: ok!.id, title: "Scarf", store: "Target x" });
    expect(store.error?.message).toContain("gifts_store_single_line");
    const name = await owner.client.from("profiles").update({ display_name: "Eve\r\nX: y" }).eq("id", owner.id);
    expect(name.error?.message).toContain("profiles_display_name_single_line");
    const list = await owner.client.from("lists").update({ name: "List\tname" }).eq("id", owner.listId);
    expect(list.error?.message).toContain("lists_name_single_line");
    await admin.from("recipients").delete().eq("id", ok!.id);
  });
});

describe("L3: a partial refund that arrives before the payment", () => {
  it("still lets a later full refund remove the pass", async () => {
    const buyer = await createTestUser("sr2-buyer");
    try {
      const intent = `pi_${randomUUID()}`;
      await admin.rpc("record_charge_refunded", { p_event_id: `evt_${randomUUID()}`, p_payment_intent: intent, p_amount_refunded: 300, p_amount: 999 });
      await admin.rpc("record_checkout_paid", {
        p_event_id: `evt_${randomUUID()}`, p_session_id: `cs_${randomUUID()}`, p_payment_intent: intent,
        p_user: buyer.id, p_amount: 999, p_currency: "usd",
      });
      expect((await admin.from("profiles").select("paid_until").eq("id", buyer.id).single()).data?.paid_until).not.toBeNull();
      const { data: row } = await admin.from("payments").select("user_id, status").eq("stripe_payment_intent_id", intent).single();
      expect(row).toEqual({ user_id: buyer.id, status: "partially_refunded" });

      await admin.rpc("record_charge_refunded", { p_event_id: `evt_${randomUUID()}`, p_payment_intent: intent, p_amount_refunded: 999, p_amount: 999 });
      expect((await admin.from("profiles").select("paid_until").eq("id", buyer.id).single()).data?.paid_until).toBeNull();
    } finally {
      await deleteTestUser(buyer);
    }
  });
});

describe("L4: a deleted account leaves nothing in the sign-in logs", () => {
  it("removes every log line with the person's id or email", async () => {
    const user = await createTestUser("sr2-logs");
    const count = () =>
      Number(sql(`select count(*) from auth.audit_log_entries where payload::text like '%${user.id}%' or payload::text like '%${user.email}%'`));
    expect(count()).toBeGreaterThan(0);
    await deleteTestUser(user);
    expect(count()).toBe(0);
  });
});

describe("L5: the name family members see isn't chosen by whoever typed the email address", () => {
  it("ignores a name attached to an emailed-code sign-up", async () => {
    const email = `sr2-named-${randomUUID().slice(0, 8)}@test.giftledger.local`;
    const { error } = await anon().auth.signInWithOtp({ email, options: { data: { full_name: "Visit evil.example now" } } });
    expect(error).toBeNull();
    const id = sql(`select id from auth.users where email = '${email}'`);
    try {
      expect(sql(`select display_name from public.profiles where id = '${id}'`)).toBe(email.split("@")[0]);
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("uses the name Google confirmed", async () => {
    const id = randomUUID();
    sql(`insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data)
         values ('${id}', 'sr2-google-${id.slice(0, 8)}@test.giftledger.local', 'authenticated', 'authenticated',
                 '{"provider":"google","providers":["google"]}', '{"full_name":"Maria Lopez"}')`);
    try {
      expect(sql(`select display_name from public.profiles where id = '${id}'`)).toBe("Maria Lopez");
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
});

describe("M4: emailed invites can't be used to send spam", () => {
  it("one address once a day from anyone, and once a month from the same person", async () => {
    const address = hash();
    expect((await admin.rpc("reserve_invite_email", { p_user: owner.id, p_email_hash: address })).error).toBeNull();
    expect((await admin.rpc("reserve_invite_email", { p_user: owner.id, p_email_hash: address })).error?.message).toContain("INVITE_EMAIL_DUPLICATE");
    expect((await admin.rpc("reserve_invite_email", { p_user: other.id, p_email_hash: address })).error?.message).toContain("INVITE_EMAIL_DUPLICATE");

    // A day later someone else may invite the same person; the first sender still can't.
    await admin.from("invite_emails").update({ created_at: new Date(Date.now() - 25 * 3600_000).toISOString() }).eq("email_hash", address);
    expect((await admin.rpc("reserve_invite_email", { p_user: owner.id, p_email_hash: address })).error?.message).toContain("INVITE_EMAIL_DUPLICATE");
    expect((await admin.rpc("reserve_invite_email", { p_user: other.id, p_email_hash: address })).error).toBeNull();
  });

  it("3 a day per account, 10 with the Season Pass", async () => {
    const sender = await createTestUser("sr2-sender");
    try {
      for (let i = 0; i < 3; i++) expect((await admin.rpc("reserve_invite_email", { p_user: sender.id, p_email_hash: hash() })).error).toBeNull();
      expect((await admin.rpc("reserve_invite_email", { p_user: sender.id, p_email_hash: hash() })).error?.message).toContain("INVITE_EMAIL_LIMIT");
      await givePass(sender);
      for (let i = 0; i < 7; i++) expect((await admin.rpc("reserve_invite_email", { p_user: sender.id, p_email_hash: hash() })).error).toBeNull();
      expect((await admin.rpc("reserve_invite_email", { p_user: sender.id, p_email_hash: hash() })).error?.message).toContain("INVITE_EMAIL_LIMIT");
    } finally {
      await deleteTestUser(sender);
    }
  });

  it("pauses for everyone at 500 a day", async () => {
    const already = Number(sql("select count(*) from public.invite_emails where created_at > now() - interval '24 hours'"));
    const filler = Array.from({ length: Math.max(0, 500 - already) }, () => ({ email_hash: hash() }));
    const { data: inserted } = await admin.from("invite_emails").insert(filler).select("id");
    try {
      expect((await admin.rpc("reserve_invite_email", { p_user: other.id, p_email_hash: hash() })).error?.message).toContain("INVITE_EMAIL_PAUSED");
    } finally {
      await admin.from("invite_emails").delete().in("id", (inserted ?? []).map((r) => r.id));
    }
  });

  it("only the server can use it; nobody can read the fingerprints", async () => {
    const call = await owner.client.rpc("reserve_invite_email", { p_user: owner.id, p_email_hash: hash() });
    expect(call.error).not.toBeNull();
    const read = await owner.client.from("invite_emails").select("*");
    expect(read.data ?? []).toEqual([]);
  });
});

describe("M5: the daily tidy-up", () => {
  it("removes sign-ups nobody finished after a day, with their empty list, and keeps real accounts", async () => {
    const email = `sr2-unfinished-${randomUUID().slice(0, 8)}@test.giftledger.local`;
    expect((await anon().auth.signInWithOtp({ email })).error).toBeNull();
    const id = sql(`select id from auth.users where email = '${email}'`);
    const list = sql(`select list_id from public.list_members where user_id = '${id}'`);
    sql(`update auth.users set created_at = now() - interval '2 days' where id in ('${id}', '${owner.id}')`);
    const old = randomUUID();
    sql(`insert into auth.audit_log_entries (id, payload, created_at) values ('${old}', '{}', now() - interval '40 days')`);

    const { data, error } = await admin.rpc("daily_cleanup", {});
    expect(error).toBeNull();
    expect(data?.[0].unconfirmed_users).toBeGreaterThanOrEqual(1);
    expect(sql(`select count(*) from auth.users where id = '${id}'`)).toBe("0");
    expect(sql(`select count(*) from public.lists where id = '${list}'`)).toBe("0");
    expect(sql(`select count(*) from auth.users where id = '${owner.id}'`)).toBe("1");
    expect(sql(`select count(*) from auth.audit_log_entries where id = '${old}'`)).toBe("0");
  });

  it("only the server can run it", async () => {
    expect((await owner.client.rpc("daily_cleanup", {})).error).not.toBeNull();
  });
});
