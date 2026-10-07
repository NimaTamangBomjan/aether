import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getListContext } from "@/lib/data/list";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Welcome" };
// Step 3 asks the AI for ideas.
export const maxDuration = 60;

export default async function WelcomePage() {
  const ctx = await getListContext();
  if (ctx.profile.onboarded_at) redirect("/app");
  const { data: usage } = await ctx.supabase.rpc("ai_usage", { p_list: ctx.list.id });
  return <Onboarding firstName={ctx.profile.display_name} usage={usage?.[0] ?? { used: 0, cap: 10 }} />;
}
