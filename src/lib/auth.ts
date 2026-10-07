import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's id, or null. Verified by Supabase, never trusted from the browser. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/** For private pages and actions: returns a user-scoped client, or sends the visitor to sign in. */
export async function requireUser(nextPath = "/app") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? "" };
}
