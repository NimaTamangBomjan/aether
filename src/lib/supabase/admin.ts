import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Supabase client with full access (bypasses row-level security).
 * Only for trusted server jobs: the Stripe webhook, the reminder cron, account deletion.
 * Never use it to read data on behalf of a signed-in user.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
