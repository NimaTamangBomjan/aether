"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { nextFromConfirmParams } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

export function ConfirmSignIn() {
  const params = useSearchParams();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as EmailOtpType | null;
    const next = nextFromConfirmParams(new URLSearchParams(params.toString()), process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin);
    const fail = () => router.replace(`/sign-in?error=link&next=${encodeURIComponent(next)}`);
    const code = params.get("code");
    // Supabase's default email (used until custom email is set up) sends a one-time code that
    // only works in the browser where sign-in started. Our own email sends a token that works anywhere.
    const signIn = code
      ? createClient().auth.exchangeCodeForSession(code)
      : tokenHash && type && ALLOWED_TYPES.includes(type)
        ? createClient().auth.verifyOtp({ type, token_hash: tokenHash })
        : null;
    if (!signIn) return fail();
    signIn
      .then(({ error }) => {
        if (error) return fail();
        router.replace(next);
        router.refresh();
      }, fail);
  }, [params, router]);

  return <p role="status">Signing you in…</p>;
}
