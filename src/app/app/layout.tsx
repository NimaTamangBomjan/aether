import Link from "next/link";
import { Users } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";
import { ListSwitcher } from "@/components/app/list-switcher";
import { Button } from "@/components/ui/button";
import { getListContext } from "@/lib/data/list";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await getListContext();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/app" className="text-lg font-bold text-primary">
          GiftLedger
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {ctx.lists.length > 1 && <ListSwitcher lists={ctx.lists} activeId={ctx.list.id} />}
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/family">
              <Users aria-hidden /> Family
            </Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </header>
      <main className="flex-1 px-4 pb-10">{children}</main>
    </div>
  );
}
