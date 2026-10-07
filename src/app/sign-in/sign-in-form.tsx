"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

function friendlySendError(message: string, status?: number) {
  return status === 429 || /rate|seconds|security purposes/i.test(message)
    ? "Too many tries. Wait a minute, then try again."
    : "We couldn't send the email. Check the address and try again.";
}

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    linkError ? "That sign-in link has expired or was already used. Enter your email to get a new code." : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [verifying, startVerifying] = useTransition();

  function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError("Please enter a valid email address.");
    startSending(async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      const { error: sendError } = await createClient().auth.signInWithOtp({
        email: parsed.data,
        options: { shouldCreateUser: true, emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
      });
      if (sendError) return setError(friendlySendError(sendError.message, sendError.status));
      setEmail(parsed.data);
      setError(null);
      setNotice(`We sent a 6-digit code to ${parsed.data}.`);
      setStep("code");
    });
  }

  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) return setError("The code is the 6 numbers in the email.");
    startVerifying(async () => {
      const { error: verifyError } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
      if (verifyError) return setError("That code didn't work. Use the newest email, or send a new code.");
      router.replace(next);
      router.refresh();
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Your email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-error" : undefined}
          />
        </div>
        {error && (
          <p id="email-error" role="alert" className="text-sm text-over-foreground">
            {error}
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

  return (
    <div className="space-y-4">
      <p role="status" className="text-base">
        {notice} Type it below, or tap the button in the email.
      </p>
      <form onSubmit={verify} className="space-y-4" noValidate>
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
        <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => sendCode()}>
          {sending ? "Sending…" : "Send a new code"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
        >
          Use a different email
        </Button>
      </div>
    </div>
  );
}
