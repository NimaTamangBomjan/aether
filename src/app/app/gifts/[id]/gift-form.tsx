"use client";

import { useActionState, useState } from "react";
import { deleteGift, saveGift, type FormState } from "@/app/app/actions";
import { ConfirmButton } from "@/components/app/confirm-button";
import { describedBy, Field } from "@/components/app/field";
import { MoneyInput } from "@/components/app/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { suggestReturnBy } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { GIFT_STATUSES, STATUS_LABEL, type Gift } from "@/lib/types";

export function GiftForm({
  gift,
  today,
  members,
  meId,
  hiddenFrom,
  linkedName,
  buyerOptions,
}: {
  gift: Gift;
  today: string;
  members: { id: string; name: string }[];
  meId: string;
  hiddenFrom: string[];
  /** The family member this gift's person is linked to; they never see it anyway. */
  linkedName?: string;
  /** Owners can record anyone on the list as the buyer; members only themselves. */
  buyerOptions: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveGift, {});
  const [status, setStatus] = useState(gift.status);
  const [store, setStore] = useState(gift.store ?? "");
  const [purchaseDate, setPurchaseDate] = useState(gift.purchase_date ?? "");
  const [returnBy, setReturnBy] = useState(gift.return_by ?? "");
  const [suggested, setSuggested] = useState(false);
  const e = state.fieldErrors ?? {};

  // If a store is entered and there's no return-by date, suggest one 30 days after purchase.
  function maybeSuggest(nextStore: string, nextPurchase: string) {
    if (nextStore.trim() && (!returnBy || suggested)) {
      setReturnBy(suggestReturnBy(nextPurchase || null, today));
      setSuggested(true);
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="id" value={gift.id} />
        <Field id="title" label="Gift" error={e.title}>
          <Input id="title" name="title" defaultValue={gift.title} maxLength={120} required {...describedBy("title", e.title)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="price" label="Price (each)" error={e.price}>
            <MoneyInput id="price" name="price" defaultValue={centsToInput(gift.price_cents)} {...describedBy("price", e.price)} />
          </Field>
          <Field id="quantity" label="Quantity" error={e.quantity}>
            <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} max={99} defaultValue={gift.quantity} {...describedBy("quantity", e.quantity)} />
          </Field>
        </div>

        <Field id="status" label="Status" error={e.status}>
          <NativeSelect
            id="status"
            name="status"
            value={status}
            onChange={(ev) => {
              const next = ev.target.value as Gift["status"];
              setStatus(next);
              if (next !== "idea" && !purchaseDate) setPurchaseDate(today);
            }}
          >
            {GIFT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {status !== "idea" && buyerOptions.length > 0 && (
          <Field id="bought_by" label="Bought by" error={e.bought_by}>
            <NativeSelect id="bought_by" name="bought_by" defaultValue={gift.bought_by ?? meId}>
              <option value="">Not set</option>
              {buyerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <Field id="store" label="Store" error={e.store}>
          <Input
            id="store"
            name="store"
            value={store}
            maxLength={80}
            autoComplete="off"
            onChange={(ev) => setStore(ev.target.value)}
            onBlur={() => maybeSuggest(store, purchaseDate)}
            {...describedBy("store", e.store)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="purchase_date" label="Bought on" error={e.purchase_date}>
            <Input
              id="purchase_date"
              name="purchase_date"
              type="date"
              value={purchaseDate}
              onChange={(ev) => {
                setPurchaseDate(ev.target.value);
                maybeSuggest(store, ev.target.value);
              }}
              {...describedBy("purchase_date", e.purchase_date)}
            />
          </Field>
          <Field id="return_by" label="Return by" error={e.return_by}>
            <Input
              id="return_by"
              name="return_by"
              type="date"
              value={returnBy}
              onChange={(ev) => {
                setReturnBy(ev.target.value);
                setSuggested(false);
              }}
              {...describedBy("return_by", e.return_by, suggested ? "x" : undefined)}
            />
          </Field>
        </div>
        {suggested && (
          <p id="return_by-hint" className="-mt-3 text-sm text-muted-foreground">
            Suggested: 30 days after purchase. Change it if the store&apos;s policy is different.
          </p>
        )}

        <Field id="link" label="Link" hint="Optional, e.g. the product page." error={e.link}>
          <Input id="link" name="link" type="url" inputMode="url" defaultValue={gift.link ?? ""} placeholder="https://" {...describedBy("link", e.link, "x")} />
        </Field>

        {members.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Hide this gift from</legend>
            {linkedName && (
              <p className="text-sm text-muted-foreground">{linkedName} never sees gifts for this person.</p>
            )}
            {members
              .filter((m) => m.id !== meId)
              .map((m) => (
                <label key={m.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="hidden_from"
                    value={m.id}
                    defaultChecked={hiddenFrom.includes(m.id)}
                    className="size-5 accent-primary"
                  />
                  {m.name}
                </label>
              ))}
          </fieldset>
        )}

        <Field id="gift-notes" label="Notes" error={e.notes}>
          <Textarea id="gift-notes" name="notes" defaultValue={gift.notes} maxLength={1000} rows={3} {...describedBy("gift-notes", e.notes)} />
        </Field>

        {state.error && (
          <p role="alert" className="text-sm text-over-foreground">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save gift"}
        </Button>
      </form>

      <div className="border-t pt-6">
        <ConfirmButton
          label="Delete gift"
          title="Delete this gift?"
          description="It will be removed from the list for everyone. This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteGift(gift.id)}
        />
      </div>
    </div>
  );
}
