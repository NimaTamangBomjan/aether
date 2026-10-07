import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListContext } from "@/lib/data/list";
import { todayInTimeZone } from "@/lib/dates";
import { GiftForm } from "./gift-form";

export const metadata: Metadata = { title: "Edit gift" };

export default async function EditGiftPage({ params }: PageProps<"/app/gifts/[id]">) {
  const { id } = await params;
  const ctx = await getListContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: gift } = await ctx.supabase.from("gifts").select("*").eq("id", id).eq("list_id", ctx.list.id).maybeSingle();
  if (!gift) notFound();

  const [{ data: recipient }, { data: members }, { data: hidden }] = await Promise.all([
    ctx.supabase.from("recipients").select("id, name, linked_user_id").eq("id", gift.recipient_id).maybeSingle(),
    ctx.supabase.rpc("list_member_names", { p_list: ctx.list.id }),
    ctx.supabase.from("gift_hidden_from").select("user_id").eq("gift_id", gift.id),
  ]);
  const linked = (members ?? []).find((m) => m.user_id === recipient?.linked_user_id);
  const canEdit = ctx.isOwner || gift.created_by === ctx.userId;

  return (
    <div className="space-y-4 pt-2">
      <Link
        href={`/app/people/${gift.recipient_id}`}
        className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Back to {recipient?.name ?? "person"}
      </Link>
      <h1 className="text-2xl font-bold">Edit gift</h1>
      {canEdit ? (
        <GiftForm
          gift={gift}
          today={todayInTimeZone(ctx.profile.time_zone)}
          meId={ctx.userId}
          hiddenFrom={(hidden ?? []).map((h) => h.user_id)}
          linkedName={linked ? linked.display_name || "That family member" : undefined}
          members={(members ?? []).map((m) => ({ id: m.user_id, name: m.user_id === ctx.userId ? "Me" : m.display_name || "Family member" }))}
          buyerOptions={(members ?? [])
            .filter((m) => ctx.isOwner || m.user_id === ctx.userId || m.user_id === gift.bought_by)
            .map((m) => ({ id: m.user_id, name: m.user_id === ctx.userId ? "Me" : m.display_name || "Family member" }))}
        />
      ) : (
        <p className="text-muted-foreground">
          Only the person who added this gift or the list owner can edit it. You can still change its status from the
          person&apos;s page.
        </p>
      )}
    </div>
  );
}
