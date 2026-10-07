"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  completeOnboarding,
  saveDetectedTimeZone,
  saveListBudget,
  saveRecipient,
  type FormState,
} from "@/app/app/actions";
import { describedBy, Field } from "@/components/app/field";
import { MoneyInput } from "@/components/app/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RELATIONSHIPS } from "@/lib/types";

export function Onboarding({ firstName }: { firstName: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [finishing, startFinishing] = useTransition();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void saveDetectedTimeZone(tz);
  }, []);

  const finish = (to?: string) => startFinishing(() => completeOnboarding(to));

  return (
    <div className="mx-auto max-w-md space-y-6 pt-4">
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        Step {step} of 3
      </p>
      {step === 1 && <BudgetStep firstName={firstName} onDone={() => setStep(2)} />}
      {step === 2 && (
        <PersonStep
          onDone={(p) => {
            setPerson(p);
            setStep(3);
          }}
        />
      )}
      {step === 3 && person && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{person.name} is on your list</h1>
          <p className="text-muted-foreground">
            Next, add gift ideas for {person.name}. Tap &ldquo;Mark bought&rdquo; when you buy one, and your totals update
            right away.
          </p>
          <Button className="w-full" disabled={finishing} onClick={() => finish(`/app/people/${person.id}`)}>
            {finishing ? "One moment…" : `Go to ${person.name}`}
          </Button>
        </div>
      )}
      {step !== 3 && (
        <Button variant="ghost" className="w-full" disabled={finishing} onClick={() => finish()}>
          Skip setup
        </Button>
      )}
    </div>
  );
}

function BudgetStep({ firstName, onDone }: { firstName: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await saveListBudget(prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});
  const error = state.fieldErrors?.budget ?? state.error;

  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold">Welcome{firstName ? `, ${firstName}` : ""}! What&apos;s your total holiday budget?</h1>
      <p className="text-muted-foreground">Optional. You can change it any time.</p>
      <Field id="onboarding-budget" label="Total budget" error={error}>
        <MoneyInput id="onboarding-budget" name="budget" placeholder="e.g. 800" {...describedBy("onboarding-budget", error)} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Next"}
      </Button>
    </form>
  );
}

function PersonStep({ onDone }: { onDone: (p: { id: string; name: string }) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await saveRecipient(prev, formData);
    if (result.ok && result.id) onDone({ id: result.id, name: String(formData.get("name") ?? "").trim() });
    return result;
  }, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="then" value="stay" />
      <h1 className="text-2xl font-bold">Who&apos;s the first person you&apos;re shopping for?</h1>
      <Field id="first-name" label="Name" error={e.name}>
        <Input id="first-name" name="name" autoComplete="off" required {...describedBy("first-name", e.name)} />
      </Field>
      <Field id="first-relationship" label="Relationship">
        <NativeSelect id="first-relationship" name="relationship" defaultValue="">
          <option value="">Choose…</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="first-budget" label="Budget for them" hint="Optional." error={e.budget}>
        <MoneyInput id="first-budget" name="budget" {...describedBy("first-budget", e.budget, "x")} />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-over-foreground">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add person"}
      </Button>
    </form>
  );
}
