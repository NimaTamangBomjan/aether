import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms" };

// Placeholder until the plain-language Terms are drafted and reviewed (Stage 8).
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-muted-foreground">Our full Terms are being written and will be published here before launch.</p>
      <p className="mb-4">GiftLedger is not designed for children under 13, and you must be 13 or older to create an account.</p>
      <Link href="/" className="underline underline-offset-4">Back to home</Link>
    </main>
  );
}
