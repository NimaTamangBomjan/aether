"use client";

import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestIdeas, saveIdeaAsGift, type IdeasResult, type IdeasUsage } from "@/app/app/ideas-actions";
import { MoneyInput } from "@/components/app/money-input";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Idea, IdeaKind } from "@/lib/ai/ideas";
import { formatCents } from "@/lib/money";

const CATEGORY_LABEL: Record<Idea["category"], string> = {
  item: "Gift",
  experience: "Experience",
  personal: "Personal",
  consumable: "Treat",
};

type Failure = Extract<IdeasResult, { ok: false }>;

export function IdeasPanel({
  recipient,
  needsBudget,
  initialUsage,
}: {
  recipient: { id: string; name: string };
  needsBudget: boolean;
  initialUsage: IdeasUsage;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [usage, setUsage] = useState(initialUsage);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [askBudget, setAskBudget] = useState(needsBudget);
  const [budget, setBudget] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();

  function run(kind: IdeaKind, likedTitle?: string, budgetOverride?: string) {
    startLoading(async () => {
      const result = await requestIdeas({
        recipientId: recipient.id,
        kind,
        likedTitle,
        previousTitles: kind === "initial" ? [] : history,
        budget: budgetOverride,
      });
      if (result.usage) setUsage(result.usage);
      if (result.ok) {
        setIdeas(result.ideas);
        setHistory((h) => [...h, ...result.ideas.map((i) => i.title)].slice(-15));
        setFailure(null);
        setAskBudget(false);
      } else {
        setFailure(result);
        if (result.code === "budget_needed") setAskBudget(true);
      }
    });
  }

  async function save(idea: Idea) {
    const result = await saveIdeaAsGift({
      recipientId: recipient.id,
      title: idea.title,
      priceUsd: idea.estimated_price_usd,
      why: idea.why_it_fits,
    });
    if (!result.ok) return void toast.error(result.message ?? "Couldn't save that idea.");
    setSaved((s) => new Set(s).add(idea.title));
    toast.success(`Saved to ${recipient.name}'s gifts`);
  }

  const left = Math.max(0, usage.cap - usage.used);

  return (
    <section aria-labelledby="ideas-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ideas-heading" className="flex items-center gap-2 text-lg font-bold">
          <Lightbulb aria-hidden className="size-5 text-primary" /> Gift ideas for {recipient.name}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="ideas-left">
        {left} of {usage.cap} idea requests left
      </p>

      {askBudget ? (
        <BudgetQuestion
          name={recipient.name}
          budget={budget}
          setBudget={setBudget}
          error={failure?.code === "budget_needed" && budget ? failure.message : undefined}
          onSubmit={(value) => run("initial", undefined, value)}
          loading={loading}
        />
      ) : (
        ideas.length === 0 &&
        !loading &&
        failure?.code !== "limit" &&
        failure?.code !== "limit_member" && (
          <Button className="w-full" onClick={() => run("initial")}>
            <Sparkles aria-hidden /> Get ideas
          </Button>
        )
      )}

      <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Thinking of ideas for {recipient.name}…</p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && failure && failure.code !== "budget_needed" && (
          failure.code === "limit" ? (
            <UpgradePrompt message={failure.message} />
          ) : (
            <div role="alert" className="space-y-3 rounded-xl border border-over/30 bg-over/5 p-4">
              <p>{failure.message}</p>
              {(failure.code === "failed" || failure.code === "rate") && (
                <Button variant="outline" size="sm" onClick={() => run(ideas.length ? "different_direction" : "initial")}>
                  <RefreshCw aria-hidden /> Try again
                </Button>
              )}
            </div>
          )
        )}

        {!loading && ideas.length > 0 && (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.title} className="space-y-2 rounded-xl border bg-card p-4 shadow-xs" data-testid="idea">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{idea.title}</p>
                  <p className="shrink-0 font-semibold" data-testid="idea-price">
                    ~{formatCents(Math.round(idea.estimated_price_usd * 100))}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <Badge variant="secondary" className="mr-2 align-middle">
                    {CATEGORY_LABEL[idea.category]}
                  </Badge>
                  {idea.why_it_fits}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {saved.has(idea.title) ? (
                    <span className="px-3 text-sm font-medium text-ok-foreground">Saved ✓</span>
                  ) : (
                    <Button size="sm" onClick={() => save(idea)}>
                      Save as gift idea
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => run("more_like_this", idea.title)}>
                    More like this
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && ideas.length > 0 && (
        <Button variant="outline" className="w-full" onClick={() => run("different_direction")}>
          <RefreshCw aria-hidden /> Different direction
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Ideas are suggestions from AI. Prices are estimates. Each request (including &ldquo;More like this&rdquo; and
        &ldquo;Different direction&rdquo;) uses one of your idea requests.
      </p>
    </section>
  );
}

function BudgetQuestion({
  name,
  budget,
  setBudget,
  error,
  onSubmit,
  loading,
}: {
  name: string;
  budget: string;
  setBudget: (v: string) => void;
  error?: string;
  onSubmit: (value: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-secondary/50 p-4">
      <p className="font-medium">About how much do you want to spend on {name}?</p>
      <div className="flex flex-wrap gap-2">
        {["25", "50", "100"].map((v) => (
          <Button key={v} variant="outline" disabled={loading} onClick={() => onSubmit(v)}>
            ${v}
          </Button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(budget);
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="ideas-budget">Other amount</Label>
          <MoneyInput id="ideas-budget" value={budget} onChange={(e) => setBudget(e.target.value)} aria-invalid={Boolean(error)} />
        </div>
        <Button type="submit" disabled={loading || !budget}>
          Go
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-over-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
