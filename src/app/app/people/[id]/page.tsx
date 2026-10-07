import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListContext } from "@/lib/data/list";
import { todayInTimeZone } from "@/lib/dates";
import { AGE_RANGES } from "@/lib/types";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonView } from "./person-view";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage({ params }: PageProps<"/app/people/[id]">) {
  const { id } = await params;
  const ctx = await getListContext(`/app/people/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: recipient }, { data: gifts }] = await Promise.all([
    ctx.supabase.from("recipients").select("*").eq("id", id).eq("list_id", ctx.list.id).maybeSingle(),
    ctx.supabase.from("gifts").select("*").eq("recipient_id", id).eq("list_id", ctx.list.id).order("created_at"),
  ]);
  if (!recipient) notFound();

  const age = AGE_RANGES.find((a) => a.value === recipient.age_range)?.label;
  const details = [recipient.relationship, age].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All people
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{recipient.name}</h1>
          {details && <p className="text-muted-foreground">{details}</p>}
          {recipient.archived_at && <p className="text-sm font-medium text-near-foreground">Archived</p>}
        </div>
        {ctx.isOwner && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/people/${recipient.id}/edit`}>Edit</Link>
          </Button>
        )}
      </div>

      <Button asChild variant="secondary" className="w-full">
        <Link href={`/app/people/${recipient.id}/ideas`}>
          <Lightbulb aria-hidden /> Get gift ideas
        </Link>
      </Button>

      <PersonView
        recipient={recipient}
        gifts={gifts ?? []}
        userId={ctx.userId}
        isOwner={ctx.isOwner}
        today={todayInTimeZone(ctx.profile.time_zone)}
      />

      {(recipient.interests.length > 0 || recipient.notes || recipient.dont_buy_notes) && (
        <section aria-labelledby="about" className="space-y-3 rounded-xl border p-4">
          <h2 id="about" className="font-semibold">
            About {recipient.name}
          </h2>
          {recipient.interests.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Interests">
              {recipient.interests.map((i) => (
                <li key={i} className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                  {i}
                </li>
              ))}
            </ul>
          )}
          {recipient.notes && <p className="whitespace-pre-line">{recipient.notes}</p>}
          {recipient.dont_buy_notes && (
            <p className="whitespace-pre-line">
              <span className="font-medium">Don&apos;t buy: </span>
              {recipient.dont_buy_notes}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
