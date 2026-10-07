import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder home page. The full landing page is built in Stage 8.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <p className="text-lg font-bold text-primary">GiftLedger</p>
      <h1 className="text-3xl font-bold leading-tight">Stop overspending on holiday gifts.</h1>
      <p className="text-lg text-muted-foreground">
        A budget for every person, gift ideas when you&apos;re stuck, and a shared family list so nobody buys the same
        thing twice.
      </p>
      <div>
        <Button asChild size="lg">
          <Link href="/sign-in">Get started free</Link>
        </Button>
      </div>
    </main>
  );
}
