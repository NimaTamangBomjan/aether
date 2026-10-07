import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

// Placeholder until the plain-language Privacy Policy is drafted and reviewed (Stage 8).
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-muted-foreground">
        Our full Privacy Policy is being written and will be published here before launch.
      </p>
      <Link href="/" className="underline underline-offset-4">Back to home</Link>
    </main>
  );
}
