"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCaptcha } from "@/components/captcha";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

function friendlySendError(message: string, status?: number) {
  return status === 429 || /rate|seconds|security purposes/i.test(message)
    ? "Too many tries. Wait a minute, then try again."
    : "We couldn't send the email. Check the address and try again.";
}

// Shown once Google sign-in is set up in Supabase (NEXT_PUBLIC_GOOGLE_SIGN_IN=1).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "1";

function GoogleButton({ next }: { next: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
            const { error: oauthError } = await createClient().auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}` },
            });
            if (oauthError)
              setError("Google sign-in isn't available right now. Use your email instead.");
          })
        }
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z"
          />
          <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
          />
        </svg>
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-over-foreground">
          {error}
        </p>
      )}
      <p className="text-center text-sm text-muted-foreground">or</p>
    </div>
  );
}

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    linkError
      ? "That sign-in link has expired or was already used. Enter your email to get a new code."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [verifying, startVerifying] = useTransition();
  const { mount: captchaMount, ...captcha } = useCaptcha();

  function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError("Please enter a valid email address.");
    if (captcha.enabled && !captcha.token) {
      return setError(
        captcha.failed
          ? "We couldn't check that you're a person. Reload the page and try again."
          : "One moment: we're checking that you're a person. Try again in a few seconds.",
      );
    }
    startSending(async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      const { error: sendError } = await createClient().auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
          captchaToken: captcha.token ?? undefined,
        },
      });
      // Each check works once; get a fresh one for "Send a new code".
      captcha.reset();
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
      const { error: verifyError } = await createClient().auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (verifyError)
        return setError("That code didn't work. Use the newest email, or send a new code.");
      router.replace(next);
      router.refresh();
    });
  }

  const emailStep = (
    <div className="space-y-4">
      {GOOGLE_ENABLED && <GoogleButton next={next} />}
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
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );

  const codeStep = (
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={sending}
          onClick={() => sendCode()}
        >
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

  return (
    <div className="space-y-4">
      {step === "email" ? emailStep : codeStep}
      {captcha.enabled && <div ref={captchaMount} />}
    </div>
  );
}
