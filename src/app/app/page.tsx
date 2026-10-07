import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Your list" };

// Stage 1 placeholder: proves sign-in works and data is read as the signed-in user.
// Stage 2 replaces this with the dashboard.
export default async function AppHome() {
  const { supabase, userId } = await requireUser("/app");
  const [{ data: profile }, { data: lists }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase.from("lists").select("id, name"),
  ]);

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-bold">Hi {profile?.display_name || "there"}!</h1>
      <p className="text-muted-foreground">You&apos;re signed in. Your list: {lists?.[0]?.name ?? "—"}</p>
    </div>
  );
}
