import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="mb-6 inline-block text-lg font-bold text-primary">
        GiftLedger
      </Link>
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
      <div className="space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Questions? {SUPPORT_EMAIL ? <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : "Use the contact address on our home page."}
      </p>
    </main>
  );
}

export function ContactLine() {
  return SUPPORT_EMAIL ? (
    <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>the contact address on our home page</span>
  );
}
