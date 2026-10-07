import "server-only";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Turns reminders off for the person in a signed unsubscribe link. Returns false for a bad link. */
export async function unsubscribeFromReminders(userId: string, signature: string): Promise<boolean> {
  const secret = serverEnv().UNSUBSCRIBE_SECRET;
  if (!secret || !verifyUnsubscribe(userId, signature, secret)) return false;
  const { error } = await createAdminClient().from("profiles").update({ email_reminders: false }).eq("id", userId);
  return !error;
}
