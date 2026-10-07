"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";
import { addQuickGift, setGiftStatus, type FormState } from "@/app/app/actions";
import { BudgetBar } from "@/components/app/budget-bar";
import { BudgetText } from "@/components/app/budget-text";
import { MoneyInput } from "@/components/app/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { giftCost, summarizePerson } from "@/lib/budget";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { NEXT_STATUS, NEXT_STATUS_ACTION, STATUS_LABEL, type Gift, type GiftStatus, type Recipient } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<GiftStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  bought: "bg-accent text-accent-foreground",
  wrapped: "bg-secondary text-secondary-foreground",
  given: "bg-ok/15 text-ok-foreground",
};

export function PersonView({
  recipient,
  gifts,
  userId,
  isOwner,
  today,
  timeZone,
  names,
  shared,
  hiddenFrom,
}: {
  recipient: Recipient;
  gifts: Gift[];
  userId: string;
  isOwner: boolean;
  today: string;
  timeZone: string;
  names: Record<string, string>;
  shared: boolean;
  hiddenFrom: Record<string, string[]>;
}) {
  const [optimisticGifts, setOptimisticStatus] = useOptimistic(
    gifts,
    (current, change: { id: string; status: GiftStatus }) =>
      current.map((g) =>
        g.id === change.id
          ? {
              ...g,
              status: change.status,
              bought_by: g.bought_by ?? userId,
              status_changed_by: userId,
              status_changed_at: new Date().toISOString(),
            }
          : g,
      ),
  );
  const [, startTransition] = useTransition();
  const summary = summarizePerson(recipient, optimisticGifts);

  function advance(gift: Gift) {
    const next = NEXT_STATUS[gift.status];
    if (!next) return;
    startTransition(async () => {
      setOptimisticStatus({ id: gift.id, status: next });
      const result = await setGiftStatus(gift.id, next);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <>
      <section aria-label="Budget" className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
        <p data-testid="person-budget">
          <BudgetText spent={summary.spent} budget={recipient.budget_cents} state={summary.state} />
        </p>
        {recipient.budget_cents != null && (
          <BudgetBar percent={summary.percent} state={summary.state} label={`Budget used for ${recipient.name}`} />
        )}
        {summary.planned > 0 && (
          <p className="text-sm text-muted-foreground">{formatCents(summary.planned)} more in gift ideas</p>
        )}
      </section>

      <QuickAdd recipientId={recipient.id} />

      <section aria-labelledby="gifts" className="space-y-3">
        <h2 id="gifts" className="text-lg font-bold">
          Gifts
        </h2>
        {optimisticGifts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-muted-foreground">
            No gifts yet. Add an idea above when something comes to mind.
          </p>
        ) : (
          <ul className="space-y-3">
            {optimisticGifts.map((gift) => {
              const canEdit = isOwner || gift.created_by === userId;
              const nextAction = NEXT_STATUS_ACTION[gift.status];
              return (
                <li key={gift.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-xs" data-testid="gift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{gift.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {gift.price_cents == null
                          ? "No price yet"
                          : gift.quantity > 1
                            ? `${gift.quantity} × ${formatCents(gift.price_cents)} = ${formatCents(giftCost(gift))}`
                            : formatCents(gift.price_cents)}
                        {gift.store ? ` · ${gift.store}` : ""}
                      </p>
                      <ReturnLine gift={gift} today={today} />
                      {shared && <ActivityLine gift={gift} names={names} timeZone={timeZone} />}
                      {hiddenFrom[gift.id]?.length ? (
                        <p className="text-sm text-muted-foreground">Hidden from {hiddenFrom[gift.id].join(", ")}</p>
                      ) : null}
                    </div>
                    <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-medium", STATUS_STYLE[gift.status])}>
                      {STATUS_LABEL[gift.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextAction && (
                      <Button size="sm" onClick={() => advance(gift)}>
                        {nextAction}
                      </Button>
                    )}
                    {canEdit && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/gifts/${gift.id}`}>Edit</Link>
                      </Button>
                    )}
                    {gift.link && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={gift.link} target="_blank" rel="noopener noreferrer nofollow">
                          Open link
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function ActivityLine({ gift, names, timeZone }: { gift: Gift; names: Record<string, string>; timeZone: string }) {
  if (!gift.status_changed_by || !gift.status_changed_at) return null;
  const who = names[gift.status_changed_by] ?? "a family member";
  const when = new Date(gift.status_changed_at).toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" });
  const text =
    gift.status === "idea"
      ? `Added by ${who}, ${when}`
      : `Marked ${STATUS_LABEL[gift.status].toLowerCase()} by ${who}, ${when}`;
  const buyer = gift.bought_by && gift.bought_by !== gift.status_changed_by ? names[gift.bought_by] : null;
  return (
    <p className="text-sm text-muted-foreground" data-testid="activity">
      {text}
      {buyer ? ` · bought by ${buyer}` : ""}
    </p>
  );
}

function ReturnLine({ gift, today }: { gift: Gift; today: string }) {
  if (!gift.return_by || (gift.status !== "bought" && gift.status !== "wrapped")) return null;
  const days = daysBetween(today, gift.return_by);
  const text =
    days < 0
      ? `Return window closed ${formatDate(gift.return_by, today)}`
      : days === 0
        ? "Last day to return: today"
        : `Return by ${formatDate(gift.return_by, today)} (${days} ${days === 1 ? "day" : "days"})`;
  return (
    <Badge variant="outline" className={cn("mt-1", days >= 0 && days <= 3 && "border-near text-near-foreground")}>
      {text}
    </Badge>
  );
}

function QuickAdd({ recipientId }: { recipientId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addQuickGift, {});
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.fieldErrors?.title ?? state.fieldErrors?.price ?? state.error;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success("Gift added");
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2 rounded-xl border bg-secondary/50 p-4" noValidate>
      <input type="hidden" name="recipient_id" value={recipientId} />
      <p className="font-semibold">Add a gift idea</p>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="quick-title" className="sr-only">
            Gift
          </Label>
          <Input id="quick-title" name="title" placeholder="What's the gift?" maxLength={120} autoComplete="off" required aria-invalid={Boolean(state.fieldErrors?.title)} />
        </div>
        <div className="w-28">
          <Label htmlFor="quick-price" className="sr-only">
            Price
          </Label>
          <MoneyInput id="quick-price" name="price" placeholder="Price" aria-invalid={Boolean(state.fieldErrors?.price)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-over-foreground">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add gift"}
      </Button>
    </form>
  );
}
