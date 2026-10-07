import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getListContext } from "@/lib/data/list";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const ctx = await getListContext("/app/welcome");
  if (ctx.profile.onboarded_at) redirect("/app");
  return <Onboarding firstName={ctx.profile.display_name} />;
}
