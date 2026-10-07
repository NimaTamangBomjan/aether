import Link from "next/link";
import { signOut } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/app" className="text-lg font-bold text-primary">
          GiftLedger
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="flex-1 px-4 pb-10">{children}</main>
    </div>
  );
}
