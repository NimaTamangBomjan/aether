import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function GoodbyePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <p className="text-lg font-bold text-primary">GiftLedger</p>
      <h1 className="text-2xl font-bold">Your account has been deleted</h1>
      <p>Your personal data is gone. Thanks for using GiftLedger, and happy holidays.</p>
      <div>
        <Button asChild variant="outline">
          <Link href="/">Back to the home page</Link>
        </Button>
      </div>
    </main>
  );
}
