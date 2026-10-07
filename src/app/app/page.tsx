import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { BudgetBar } from "@/components/app/budget-bar";
import { BudgetEditor } from "@/components/app/budget-editor";
import { BudgetText } from "@/components/app/budget-text";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { summarizeList, type PersonSummary } from "@/lib/budget";
import { getListContext, getListData } from "@/lib/data/list";
import { formatCents } from "@/lib/money";
import { FREE_RECIPIENT_LIMIT } from "@/lib/types";

export const metadata: Metadata = { title: "Your list" };

export default async function Dashboard() {
  const ctx = await getListContext("/app");
  if (!ctx.profile.onboarded_at) redirect("/app/welcome");

  const { recipients, gifts } = await getListData(ctx);
  const summary = summarizeList(ctx.list.overall_budget_cents, recipients, gifts);
  const atLimit = !ctx.hasPass && ctx.recipientCount >= FREE_RECIPIENT_LIMIT;

  return (
    <div className="space-y-6 pt-2">
      <section aria-labelledby="totals" className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
        <h1 id="totals" className="text-xl font-bold">
          {ctx.list.name}
        </h1>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-sm text-muted-foreground">Spent</dt>
            <dd className="text-xl font-bold" data-testid="total-spent">
              {formatCents(summary.spent)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{summary.left != null && summary.left < 0 ? "Over" : "Left"}</dt>
            <dd
              className={summary.state === "over" ? "text-xl font-bold text-over-foreground" : "text-xl font-bold"}
              data-testid="total-left"
            >
              {summary.left == null ? "—" : formatCents(Math.abs(summary.left))}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Budget</dt>
            <dd className="text-xl font-bold" data-testid="total-budget">
              {summary.totalBudget == null ? "—" : formatCents(summary.totalBudget)}
            </dd>
          </div>
        </dl>
        <BudgetBar percent={summary.percent} state={summary.state} label="Total budget used" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {summary.people.length === 0
              ? "Add the people you're shopping for."
              : summary.stillNeedGift === 0
                ? "Everyone has a gift. Nice work!"
                : `${summary.stillNeedGift} of ${summary.people.length} still need a gift`}
            {summary.budgetSource === "people" && " · budget is everyone's budgets added up"}
            {summary.unassigned != null && summary.unassigned > 0 && ` · ${formatCents(summary.unassigned)} not assigned to anyone yet`}
          </p>
          {ctx.isOwner && <BudgetEditor budget={ctx.list.overall_budget_cents} />}
        </div>
      </section>

      <section aria-labelledby="people" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="people" className="text-lg font-bold">
            People
          </h2>
          {ctx.isOwner && !atLimit && (
            <Button asChild size="sm">
              <Link href="/app/people/new">
                <Plus aria-hidden /> Add person
              </Link>
            </Button>
          )}
        </div>

        {ctx.isOwner && atLimit && (
          <UpgradePrompt message={`You've added ${FREE_RECIPIENT_LIMIT} people. Unlock unlimited people for $9.99.`} />
        )}

        {summary.people.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="mb-4 text-muted-foreground">No one on your list yet.</p>
            {ctx.isOwner && (
              <Button asChild>
                <Link href="/app/people/new">Add the first person</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {summary.people.map((p) => (
              <PersonCard key={p.recipient.id} person={p} relationship={recipients.find((r) => r.id === p.recipient.id)?.relationship} />
            ))}
          </ul>
        )}

        {summary.archived.length > 0 && (
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer py-2 font-medium">Archived ({summary.archived.length})</summary>
            <ul className="mt-3 space-y-3">
              {summary.archived.map((p) => (
                <PersonCard key={p.recipient.id} person={p} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function PersonCard({ person, relationship }: { person: PersonSummary; relationship?: string }) {
  const { recipient } = person;
  return (
    <li>
      <Link
        href={`/app/people/${recipient.id}`}
        className="block space-y-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{recipient.name}</p>
            {relationship && <p className="text-sm text-muted-foreground">{relationship}</p>}
          </div>
          {person.needsGift ? (
            <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
              Needs a gift
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              {person.purchasedCount} {person.purchasedCount === 1 ? "gift" : "gifts"}
            </Badge>
          )}
        </div>
        <BudgetText spent={person.spent} budget={recipient.budget_cents} state={person.state} className="text-sm" />
        {recipient.budget_cents != null && (
          <BudgetBar percent={person.percent} state={person.state} label={`Budget used for ${recipient.name}`} />
        )}
      </Link>
    </li>
  );
}
