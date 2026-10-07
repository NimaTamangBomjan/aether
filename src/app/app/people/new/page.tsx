import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RecipientForm } from "@/components/app/recipient-form";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { getListContext } from "@/lib/data/list";
import { FREE_RECIPIENT_LIMIT } from "@/lib/types";

export const metadata: Metadata = { title: "Add a person" };

export default async function NewPersonPage() {
  const ctx = await getListContext();
  if (!ctx.isOwner) redirect("/app");
  const atLimit = !ctx.hasPass && ctx.recipientCount >= FREE_RECIPIENT_LIMIT;
  const { data: members } = await ctx.supabase.rpc("list_member_names", { p_list: ctx.list.id });
  const memberOptions = (members ?? []).map((m) => ({
    id: m.user_id,
    name: m.user_id === ctx.userId ? "me" : m.display_name || "a family member",
  }));

  return (
    <div className="space-y-4 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All people
      </Link>
      <h1 className="text-2xl font-bold">Add a person</h1>
      {atLimit ? (
        <UpgradePrompt message={`You've added ${FREE_RECIPIENT_LIMIT} people. Unlock unlimited people for $9.99.`} />
      ) : (
        <RecipientForm submitLabel="Add person" members={memberOptions} />
      )}
    </div>
  );
}
