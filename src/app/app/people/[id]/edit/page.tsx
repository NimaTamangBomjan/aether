import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipientForm } from "@/components/app/recipient-form";
import { getListContext } from "@/lib/data/list";
import { RecipientDangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Edit person" };

export default async function EditPersonPage({ params }: PageProps<"/app/people/[id]/edit">) {
  const { id } = await params;
  const ctx = await getListContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (!ctx.isOwner) redirect(`/app/people/${id}`);

  const [{ data: recipient }, { data: members }] = await Promise.all([
    ctx.supabase.from("recipients").select("*").eq("id", id).eq("list_id", ctx.list.id).maybeSingle(),
    ctx.supabase.rpc("list_member_names", { p_list: ctx.list.id }),
  ]);
  if (!recipient) notFound();
  const memberOptions = (members ?? []).map((m) => ({
    id: m.user_id,
    name: m.user_id === ctx.userId ? "me" : m.display_name || "a family member",
  }));

  return (
    <div className="space-y-4 pt-2">
      <Link href={`/app/people/${id}`} className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to {recipient.name}
      </Link>
      <h1 className="text-2xl font-bold">Edit {recipient.name}</h1>
      <RecipientForm recipient={recipient} submitLabel="Save changes" members={memberOptions} />
      <RecipientDangerZone id={recipient.id} name={recipient.name} archived={Boolean(recipient.archived_at)} />
    </div>
  );
}
