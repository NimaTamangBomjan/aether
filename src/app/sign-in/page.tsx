import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  if (await getUserId()) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-lg font-bold text-primary">
        GiftLedger
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Sign in or create your account</h1>
      <p className="mb-6 text-muted-foreground">No password needed.</p>
      {params.error === "google" && (
        <p role="alert" className="mb-4 text-sm text-over-foreground">
          Google sign-in didn&apos;t finish. Try again, or use your email.
        </p>
      )}
      <SignInForm next={next} linkError={params.error === "link"} />
    </main>
  );
}
