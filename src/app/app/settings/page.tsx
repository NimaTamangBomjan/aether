import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { getListContext } from "@/lib/data/list";
import { hasActivePass, SEASON_PASS_THROUGH } from "@/lib/season";
import { SUPPORT_EMAIL } from "@/lib/site";
import { DeleteAccount, SettingsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default async function SettingsPage() {
  const ctx = await getListContext();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("display_name, time_zone, email_reminders, paid_until")
    .eq("id", ctx.userId)
    .single();
  const active = hasActivePass(profile?.paid_until);

  const allZones = Intl.supportedValuesOf("timeZone");
  const zones = [...COMMON_ZONES, ...allZones.filter((z) => !COMMON_ZONES.includes(z))];

  const sharedOwned = await Promise.all(
    ctx.lists
      .filter((l) => l.role === "owner")
      .map(async (l) => {
        const { data: members } = await ctx.supabase.rpc("list_member_names", { p_list: l.id });
        return {
          id: l.id,
          name: l.name,
          members: (members ?? [])
            .filter((m) => m.user_id !== ctx.userId)
            .map((m) => ({ id: m.user_id, name: m.display_name || "Family member" })),
        };
      }),
  );

  return (
    <div className="space-y-8 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to your list
      </Link>
      <h1 className="text-2xl font-bold">Settings</h1>

      <section aria-labelledby="profile-heading" className="space-y-4">
        <h2 id="profile-heading" className="text-lg font-bold">
          You
        </h2>
        <p className="text-sm text-muted-foreground">Signed in as {ctx.email}</p>
        <SettingsForm
          name={profile?.display_name ?? ""}
          timeZone={profile?.time_zone ?? "America/New_York"}
          reminders={profile?.email_reminders ?? true}
          zones={zones}
        />
      </section>

      <section aria-labelledby="plan-heading" className="space-y-3">
        <h2 id="plan-heading" className="text-lg font-bold">
          Plan
        </h2>
        {active ? (
          <p>Season Pass, active through {SEASON_PASS_THROUGH}.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Free plan</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/upgrade">See the Season Pass</Link>
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="data-heading" className="space-y-3">
        <h2 id="data-heading" className="text-lg font-bold">
          Your data
        </h2>
        <p className="text-sm text-muted-foreground">
          Download everyone and every gift you can see, as a spreadsheet (CSV). Always free.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/api/export" download>
            <Download aria-hidden /> Export my data
          </a>
        </Button>
      </section>

      {SUPPORT_EMAIL && (
        <section aria-labelledby="feedback-heading" className="space-y-3">
          <h2 id="feedback-heading" className="text-lg font-bold">
            Feedback
          </h2>
          <p className="text-sm text-muted-foreground">Something confusing, broken, or missing? We read every message.</p>
          <Button asChild variant="outline" className="w-full">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("GiftLedger feedback")}`}>Send feedback</a>
          </Button>
        </section>
      )}

      <section className="space-y-3">
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </section>

      <DeleteAccount sharedLists={sharedOwned.filter((l) => l.members.length > 0)} />
    </div>
  );
}
