import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmSignIn } from "./confirm-sign-in";

export const metadata: Metadata = { title: "Signing you in", robots: { index: false } };

// The button in the sign-in email lands here. It works in any browser, because it verifies a
// one-time token rather than something stored where sign-in started.
export default function ConfirmPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <p className="text-lg font-bold text-primary">GiftLedger</p>
      <Suspense fallback={<p role="status">Signing you in…</p>}>
        <ConfirmSignIn />
      </Suspense>
    </main>
  );
}
