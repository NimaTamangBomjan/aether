import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserId } from "@/lib/auth";
import { isInviteTokenFormat } from "@/lib/invite-token";
import { createClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Join a family list", robots: { index: false } };

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const valid = isInviteTokenFormat(token);
  const userId = await getUserId();

  let content;
  if (!valid) {
    content = <Problem text="This invite link isn't complete. Ask the person who sent it for a new one." />;
  } else if (!userId) {
    content = (
      <>
        <p className="text-lg">You&apos;ve been invited to a family gift list on GiftLedger, so nobody buys the same gift twice.</p>
        <Button asChild size="lg" className="w-full">
          <Link href={`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in to join</Link>
        </Button>
        <p className="text-sm text-muted-foreground">New to GiftLedger? Signing in also creates your free account.</p>
      </>
    );
  } else {
    const supabase = await createClient();
    const [{ data }, { data: me }] = await Promise.all([
      supabase.rpc("invite_preview", { p_token: token }),
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
    ]);
    const invite = data?.[0];
    if (!invite) {
      content = <Problem text="We couldn't find this invite. Ask the person who sent it for a new one." />;
    } else if (invite.status !== "valid") {
      content = (
        <Problem
          text={
            invite.status === "used"
              ? "This invite link was already used. Each link works once. Ask for a new one."
              : "This invite link has expired (they last 7 days). Ask for a new one."
          }
        />
      );
    } else {
      content = (
        <>
          <p className="text-lg">
            <strong>{invite.invited_by || "A family member"}</strong> invited you to join <strong>{invite.list_name}</strong>.
          </p>
          <p className="text-muted-foreground">
            You&apos;ll see who&apos;s on the list and what&apos;s planned, and you can add gifts and mark what you bought.
          </p>
          <JoinButton token={token} currentName={me?.display_name ?? ""} />
        </>
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Link href="/" className="text-lg font-bold text-primary">
        GiftLedger
      </Link>
      <h1 className="text-2xl font-bold">Join a family list</h1>
      {content}
    </main>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      <p role="alert" className="rounded-xl border border-near/40 bg-near/10 p-4">
        {text}
      </p>
      <Button asChild variant="outline">
        <Link href="/app">Go to my list</Link>
      </Button>
    </div>
  );
}
