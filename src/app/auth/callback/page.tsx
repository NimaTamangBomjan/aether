import type { Metadata } from "next";
import { Suspense } from "react";
import { FinishOAuth } from "./finish-oauth";

export const metadata: Metadata = { title: "Signing you in", robots: { index: false } };

// Google sends people back here after they choose their account.
export default function OAuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <p className="text-lg font-bold text-primary">GiftLedger</p>
      <Suspense fallback={<p role="status">Signing you in…</p>}>
        <FinishOAuth />
      </Suspense>
    </main>
  );
}
