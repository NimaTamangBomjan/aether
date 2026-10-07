"use client";

import { useActionState, useState } from "react";
import { saveRecipient, type FormState } from "@/app/app/actions";
import { describedBy, Field } from "@/components/app/field";
import { MoneyInput } from "@/components/app/money-input";
import { TagInput } from "@/components/app/tag-input";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput } from "@/lib/money";
import { AGE_RANGES, RELATIONSHIPS, type Recipient } from "@/lib/types";

const OTHER = "__other";

export function RecipientForm({
  recipient,
  submitLabel = "Save",
  members = [],
}: {
  recipient?: Recipient;
  submitLabel?: string;
  /** Everyone on the list, with "Me" for the viewer. Shown only when the list is shared. */
  members?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecipient, {});
  const known = (RELATIONSHIPS as readonly string[]).includes(recipient?.relationship ?? "");
  const [relationship, setRelationship] = useState(
    recipient?.relationship ? (known ? recipient.relationship : OTHER) : "",
  );
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {recipient && <input type="hidden" name="id" value={recipient.id} />}

      <Field id="name" label="Name" error={e.name}>
        <Input id="name" name="name" defaultValue={recipient?.name} autoComplete="off" required {...describedBy("name", e.name)} />
      </Field>

      <Field id="relationship-select" label="Relationship" error={e.relationship}>
        <NativeSelect
          id="relationship-select"
          name={relationship === OTHER ? undefined : "relationship"}
          value={relationship}
          onChange={(ev) => setRelationship(ev.target.value)}
        >
          <option value="">Choose…</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value={OTHER}>Something else…</option>
        </NativeSelect>
      </Field>
      {relationship === OTHER && (
        <Field id="relationship" label="Relationship (your words)" error={e.relationship}>
          <Input
            id="relationship"
            name="relationship"
            defaultValue={known ? "" : recipient?.relationship}
            maxLength={40}
            autoFocus
            {...describedBy("relationship", e.relationship)}
          />
        </Field>
      )}

      <Field id="budget" label="Budget for this person" hint="Optional. Leave empty if you're not sure yet." error={e.budget}>
        <MoneyInput id="budget" name="budget" defaultValue={centsToInput(recipient?.budget_cents)} {...describedBy("budget", e.budget, "x")} />
      </Field>

      <Field id="age_range" label="Age range" hint="Helps with gift ideas." error={e.age_range}>
        <NativeSelect id="age_range" name="age_range" defaultValue={recipient?.age_range ?? ""} {...describedBy("age_range", e.age_range, "x")}>
          <option value="">Not sure</option>
          {AGE_RANGES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field id="interests" label="Interests" hint="Press Enter or comma after each one." error={e.interests}>
        <TagInput id="interests" name="interests" defaultValue={recipient?.interests ?? []} describedBy={e.interests ? "interests-error" : "interests-hint"} />
      </Field>

      <Field id="notes" label="Notes" hint="Sizes, favorite colors, wish-list items. Please don't include names: notes help with AI ideas." error={e.notes}>
        <Textarea id="notes" name="notes" defaultValue={recipient?.notes} maxLength={1000} rows={3} {...describedBy("notes", e.notes, "x")} />
      </Field>

      <Field id="dont_buy_notes" label="Already has / don't buy" hint="Things to avoid, so you and the AI don't suggest them." error={e.dont_buy_notes}>
        <Textarea id="dont_buy_notes" name="dont_buy_notes" defaultValue={recipient?.dont_buy_notes} maxLength={1000} rows={2} {...describedBy("dont_buy_notes", e.dont_buy_notes, "x")} />
      </Field>

      {members.length > 1 && (
        <Field
          id="linked_user_id"
          label="Is this person on your family list?"
          hint="If you link them, they won't see this person or any gifts for them. Great for keeping surprises."
          error={e.linked_user_id}
        >
          <NativeSelect id="linked_user_id" name="linked_user_id" defaultValue={recipient?.linked_user_id ?? ""} {...describedBy("linked_user_id", e.linked_user_id, "x")}>
            <option value="">No</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                Yes, this is {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {state.code === "limit" && state.error ? (
        <UpgradePrompt message={state.error} />
      ) : (
        state.error && (
          <p role="alert" className="text-sm text-over-foreground">
            {state.error}
          </p>
        )
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
