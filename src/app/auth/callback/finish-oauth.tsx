"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

export function FinishOAuth() {
  const params = useSearchParams();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const next = safeNextPath(params.get("next"));
    const fail = () => router.replace(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
    if (!code) return fail();
    createClient()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) return fail();
        router.replace(next);
        router.refresh();
      }, fail);
  }, [params, router]);

  return <p role="status">Signing you in…</p>;
}
