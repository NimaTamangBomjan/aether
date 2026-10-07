import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { unsubscribeFromReminders } from "@/lib/reminders/unsubscribe";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const params = await searchParams;
  const u = typeof params.u === "string" ? params.u : "";
  const s = typeof params.s === "string" ? params.s : "";
  const done = params.done === "1";

  async function confirm() {
    "use server";
    const ok = await unsubscribeFromReminders(u, s);
    redirect(ok ? `/unsubscribe?done=1` : `/unsubscribe?u=${encodeURIComponent(u)}&s=${encodeURIComponent(s)}&error=1`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Link href="/" className="text-lg font-bold text-primary">
        GiftLedger
      </Link>
      {done ? (
        <>
          <h1 className="text-2xl font-bold">You&apos;re unsubscribed</h1>
          <p>You won&apos;t get return reminder emails anymore. You can turn them back on in Settings.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Stop return reminders?</h1>
          <p>You&apos;ll stop getting emails about gifts whose return window is closing.</p>
          {params.error === "1" && (
            <p role="alert" className="text-over-foreground">
              This unsubscribe link didn&apos;t work. You can turn reminders off in Settings instead.
            </p>
          )}
          <form action={confirm}>
            <Button type="submit" size="lg" className="w-full">
              Unsubscribe from reminders
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
