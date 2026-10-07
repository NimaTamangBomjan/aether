"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  step: "email" | "code";
  email: string;
  next: string;
  error?: string;
  notice?: string;
};

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  next: z.string().optional(),
});

export async function sendCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNextPath(formData.get("next")?.toString());
  const parsed = emailSchema.safeParse({ email: formData.get("email"), next });
  if (!parsed.success) {
    return { step: "email", email: String(formData.get("email") ?? ""), next, error: "Please enter a valid email address." };
  }
  const { email } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    const tooMany = error.status === 429 || /rate|seconds/i.test(error.message);
    return {
      step: "email",
      email,
      next,
      error: tooMany
        ? "Too many tries. Wait a minute, then try again."
        : "We couldn't send the email. Check the address and try again.",
    };
  }
  return { step: "code", email, next, notice: `We sent a 6-digit code to ${email}.` };
}

const codeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function verifyCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = String(formData.get("email") ?? "");
  const parsed = codeSchema.safeParse({ email, code: formData.get("code") });
  if (!parsed.success) {
    return { step: "code", email, next, error: "The code is the 6 numbers in the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: "email" });
  if (error) {
    return {
      step: "code",
      email,
      next,
      error: "That code didn't work. Use the newest email, or send a new code.",
    };
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
