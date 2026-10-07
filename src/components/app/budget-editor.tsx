"use client";

import { useActionState, useState } from "react";
import { saveListBudget, type FormState } from "@/app/app/actions";
import { describedBy, Field } from "@/components/app/field";
import { MoneyInput } from "@/components/app/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { centsToInput } from "@/lib/money";

export function BudgetEditor({ budget }: { budget: number | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await saveListBudget(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, {});
  const error = state.fieldErrors?.budget ?? state.error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {budget == null ? "Set a total budget" : "Edit total budget"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Total holiday budget</DialogTitle>
          <DialogDescription>
            Leave it empty to use the sum of everyone&apos;s budgets instead.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          <Field id="total-budget" label="Total budget" error={error}>
            <MoneyInput id="total-budget" name="budget" defaultValue={centsToInput(budget)} autoFocus {...describedBy("total-budget", error)} />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
