import type { Metadata } from "next";
import Link from "next/link";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { getListContext } from "@/lib/data/list";
import { FREE_MEMBER_LIMIT } from "@/lib/types";
import { InviteCreator, LeaveListButton, PendingInvite, RemoveMemberButton } from "./family-controls";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage() {
  const ctx = await getListContext();
  const [{ data: members }, invitesResult] = await Promise.all([
    ctx.supabase.rpc("list_member_names", { p_list: ctx.list.id }),
    ctx.isOwner
      ? ctx.supabase
          .from("invites")
          .select("id, created_at, expires_at")
          .eq("list_id", ctx.list.id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const people = (members ?? []).sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
  const atLimit = !ctx.hasPass && ctx.memberCount >= FREE_MEMBER_LIMIT;
  const now = new Date().getTime();
  const invites = (invitesResult.data ?? []).map((i) => ({
    id: i.id,
    days: Math.max(1, Math.ceil((new Date(i.expires_at).getTime() - now) / 86_400_000)),
  }));

  return (
    <div className="space-y-6 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to your list
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Family on {ctx.list.name}</h1>
        <p className="text-muted-foreground">
          Everyone here sees the list, adds gifts and marks what they bought, so nobody buys the same thing twice.
        </p>
      </div>

      <section aria-labelledby="members" className="space-y-3">
        <h2 id="members" className="text-lg font-bold">
          Who&apos;s on this list
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {people.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.display_name || "Family member"}
                  {m.user_id === ctx.userId && " (you)"}
                </p>
                <p className="text-sm text-muted-foreground">{m.role === "owner" ? "Owner" : "Member"}</p>
              </div>
              {ctx.isOwner && m.role === "member" && (
                <div className="w-32 shrink-0">
                  <RemoveMemberButton userId={m.user_id} name={m.display_name || "this person"} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {ctx.isOwner ? (
        <section aria-labelledby="invite" className="space-y-3">
          <h2 id="invite" className="text-lg font-bold">
            Invite someone
          </h2>
          {atLimit ? (
            <UpgradePrompt message="Your free plan includes 1 family member. Unlock unlimited family members for $9.99." />
          ) : (
            <InviteCreator />
          )}
          {invites.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Unused invite links</h3>
              <ul className="space-y-2">
                {invites.map((i) => (
                  <PendingInvite key={i.id} id={i.id} days={i.days} />
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Tip: to keep a surprise, open someone&apos;s page, tap Edit, and link them to their name on the list. They
            won&apos;t see their own gifts.
          </p>
        </section>
      ) : (
        <section className="space-y-3 border-t pt-6">
          <LeaveListButton listName={ctx.list.name} />
        </section>
      )}
    </div>
  );
}
