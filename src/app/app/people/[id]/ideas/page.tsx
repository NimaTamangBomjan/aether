import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdeasPanel } from "@/components/app/ideas-panel";
import { getListContext } from "@/lib/data/list";

export const metadata: Metadata = { title: "Gift ideas" };
// Leaves room for the AI call (with one retry) on the hosting platform.
export const maxDuration = 60;

export default async function IdeasPage({ params }: PageProps<"/app/people/[id]/ideas">) {
  const { id } = await params;
  const ctx = await getListContext(`/app/people/${id}/ideas`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: recipient }, { data: usage }] = await Promise.all([
    ctx.supabase.from("recipients").select("id, name, budget_cents").eq("id", id).eq("list_id", ctx.list.id).maybeSingle(),
    ctx.supabase.rpc("ai_usage", { p_list: ctx.list.id }),
  ]);
  if (!recipient) notFound();

  return (
    <div className="space-y-4 pt-2">
      <Link href={`/app/people/${id}`} className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to {recipient.name}
      </Link>
      <IdeasPanel
        recipient={{ id: recipient.id, name: recipient.name }}
        needsBudget={recipient.budget_cents == null}
        initialUsage={usage?.[0] ?? { used: 0, cap: 10 }}
      />
    </div>
  );
}
