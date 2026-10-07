import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 GiftLedger. Not designed for children under 13.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="py-2 underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="py-2 underline-offset-4 hover:underline">
            Terms
          </Link>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="py-2 underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
