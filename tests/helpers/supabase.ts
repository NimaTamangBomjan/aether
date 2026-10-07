import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Database } from "../../src/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey || !serviceKey) {
  throw new Error("Local Supabase env missing. Run `npm run db:start` then `npm run env:local`.");
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient<Database>(url, serviceKey, noPersist);
export const anon = (): SupabaseClient<Database> => createClient<Database>(url, anonKey, noPersist);

export type TestUser = { id: string; email: string; client: SupabaseClient<Database>; listId: string };

/**
 * Creates a confirmed user and returns a client signed in as them (passwordless, the same way
 * real people sign in), plus their own list id.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.giftledger.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  // New accounts are named after their email address; tests use the label as the name.
  await admin.from("profiles").update({ display_name: label }).eq("id", data.user.id);

  const client = anon();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;
  const { error: signInError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  const { data: membership, error: listError } = await client
    .from("list_members")
    .select("list_id")
    .eq("user_id", data.user.id)
    .eq("role", "owner")
    .single();
  if (listError) throw listError;

  return { id: data.user.id, email, client, listId: membership.list_id };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  await admin.from("lists").delete().eq("id", user.listId);
  await admin.auth.admin.deleteUser(user.id);
}

/** Creates an invite the way the app does: random token, only its hash stored. */
export async function createInvite(owner: TestUser, opts: { expired?: boolean } = {}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await owner.client.from("invites").insert({
    list_id: owner.listId,
    token_hash: tokenHash,
    created_by: owner.id,
  });
  if (error) throw error;
  if (opts.expired) {
    const { error: e } = await admin
      .from("invites")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", tokenHash);
    if (e) throw e;
  }
  return token;
}

export async function givePass(user: TestUser) {
  const { error } = await admin
    .from("profiles")
    .update({ paid_until: new Date(Date.now() + 86_400_000).toISOString() })
    .eq("id", user.id);
  if (error) throw error;
}
