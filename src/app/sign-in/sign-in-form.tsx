"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCode, verifyCode, type SignInState } from "./actions";

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const initial: SignInState = {
    step: "email",
    email: "",
    next,
    error: linkError ? "That sign-in link has expired or was already used. Enter your email to get a new code." : undefined,
  };
  const [emailState, emailAction, sending] = useActionState(sendCode, initial);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, initial);
  const [editingEmail, setEditingEmail] = useState(false);

  const onCodeStep = emailState.step === "code" && !editingEmail;

  if (!onCodeStep) {
    return (
      <form
        action={(fd) => {
          setEditingEmail(false);
          emailAction(fd);
        }}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Your email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={emailState.email}
            aria-invalid={Boolean(emailState.error)}
            aria-describedby={emailState.error ? "email-error" : undefined}
          />
        </div>
        {emailState.error && (
          <p id="email-error" role="alert" className="text-sm text-over-foreground">
            {emailState.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Sending…" : "Email me a sign-in code"}
        </Button>
        <p className="text-sm text-muted-foreground">
          New here? This also creates your free account. By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
        </p>
      </form>
    );
  }

  const error = codeState.error;
  return (
    <div className="space-y-4">
      <p role="status" className="text-base">
        {emailState.notice} Type it below, or tap the button in the email.
      </p>
      <form action={codeAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={emailState.email} />
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            className="text-2xl tracking-[0.4em]"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "code-error" : undefined}
          />
        </div>
        {error && (
          <p id="code-error" role="alert" className="text-sm text-over-foreground">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? "Checking…" : "Sign in"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={emailAction}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={emailState.email} />
          <Button type="submit" variant="ghost" size="sm" disabled={sending}>
            {sending ? "Sending…" : "Send a new code"}
          </Button>
        </form>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingEmail(true)}>
          Use a different email
        </Button>
      </div>
    </div>
  );
}
