"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FormState } from "@/app/app/actions";
import { deleteAccount, saveSettings } from "@/app/app/settings/actions";
import { describedBy, Field } from "@/components/app/field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function SettingsForm({ name, timeZone, reminders, zones }: { name: string; timeZone: string; reminders: boolean; zones: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await saveSettings(prev, formData);
    if (result.ok) toast.success("Settings saved");
    return result;
  }, {});
  const [zone, setZone] = useState(timeZone);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field id="display_name" label="Your name" hint="What your family sees, e.g. “Marked bought by Maria”." error={e.display_name}>
        <Input id="display_name" name="display_name" defaultValue={name} maxLength={60} autoComplete="given-name" {...describedBy("display_name", e.display_name, "x")} />
      </Field>
      <Field id="time_zone" label="Time zone" hint="Used for return-by dates and reminder emails." error={e.time_zone}>
        <NativeSelect id="time_zone" name="time_zone" value={zone} onChange={(ev) => setZone(ev.target.value)} {...describedBy("time_zone", e.time_zone, "x")}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
      >
        Use this device&apos;s time zone
      </Button>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="email_reminders" defaultChecked={reminders} className="mt-1 size-5 accent-primary" />
        <span>
          <span className="block font-medium">Return reminder emails</span>
          <span className="block text-sm text-muted-foreground">
            3 days before and on the last day to return a gift (with the Season Pass).
          </span>
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-over-foreground">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

type SharedList = { id: string; name: string; members: { id: string; name: string }[] };

export function DeleteAccount({ sharedLists }: { sharedLists: SharedList[] }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [successors, setSuccessors] = useState<Record<string, string>>(
    Object.fromEntries(sharedLists.map((l) => [l.id, l.members[0]?.id ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section aria-labelledby="delete-heading" className="space-y-3 border-t pt-6">
      <h2 id="delete-heading" className="text-lg font-bold">
        Delete my account
      </h2>
      <p className="text-sm text-muted-foreground">
        This removes your account, your lists, and the people and gifts on them. It can&apos;t be undone. Export your data
        first if you want a copy.
      </p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account and personal data will be deleted. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {sharedLists.map((l) => (
              <div key={l.id} className="space-y-2">
                <Label htmlFor={`successor-${l.id}`}>Who should take over &ldquo;{l.name}&rdquo;?</Label>
                <NativeSelect
                  id={`successor-${l.id}`}
                  value={successors[l.id]}
                  onChange={(e) => setSuccessors((s) => ({ ...s, [l.id]: e.target.value }))}
                >
                  {l.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-sm text-muted-foreground">They&apos;ll keep the list. Your Season Pass doesn&apos;t transfer.</p>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
            </div>
            {error && (
              <p role="alert" className="text-sm text-over-foreground">
                {error}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || confirm !== "DELETE"}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAccount({ confirm, successors });
                  if (result?.error) setError(result.error);
                })
              }
            >
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
