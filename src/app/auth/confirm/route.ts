import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { nextFromConfirmParams } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

// The button in the sign-in email lands here. It works in any browser, because it
// verifies a one-time token rather than relying on something stored where sign-in started.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = nextFromConfirmParams(params, env.NEXT_PUBLIC_APP_URL);

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  const failed = new URL("/sign-in", request.nextUrl.origin);
  failed.searchParams.set("error", "link");
  failed.searchParams.set("next", next);
  return NextResponse.redirect(failed);
}
