"use client";

import { Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { cancelInvite, createInviteLink, emailInvite, leaveList, removeMember } from "@/app/app/family/actions";
import { ConfirmButton } from "@/components/app/confirm-button";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteCreator() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  // Only known in the browser; reading it this way avoids a server/browser mismatch.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  if (error?.limit) return <UpgradePrompt message={error.message} />;

  return (
    <div className="space-y-3 rounded-xl border bg-secondary/50 p-4">
      {url ? (
        <>
          <Label htmlFor="invite-url">Send this link to one person</Label>
          <Input id="invite-url" value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copied");
                } catch {
                  toast.error("Couldn't copy. Press and hold the link to copy it.");
                }
              }}
            >
              <Copy aria-hidden /> Copy link
            </Button>
            {canShare && (
              <Button
                variant="outline"
                onClick={() =>
                  navigator.share({ title: "Join my gift list", text: "Join our family gift list on GiftLedger:", url }).catch(() => {})
                }
              >
                <Share2 aria-hidden /> Share
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">The link works once and expires in 7 days.</p>
          <Button variant="ghost" size="sm" onClick={() => setUrl(null)}>
            Make another link
          </Button>
        </>
      ) : (
        <>
          <p>Create a private link and text or email it to a family member.</p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await createInviteLink();
                if (result.ok) {
                  setUrl(result.url);
                  setError(null);
                } else setError({ message: result.message, limit: result.code === "limit" });
              })
            }
          >
            {pending ? "Creating…" : "Create invite link"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-over-foreground">
              {error.message}
            </p>
          )}
          <EmailInvite onLimit={(message) => setError({ message, limit: true })} />
        </>
      )}
    </div>
  );
}

function EmailInvite({ onLimit }: { onLimit: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2 border-t pt-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await emailInvite(email);
          if (result.ok) {
            setStatus({ ok: true, text: `Invite sent to ${email}.` });
            setEmail("");
          } else if (result.code === "limit") onLimit(result.message);
          else setStatus({ ok: false, text: result.message });
        });
      }}
    >
      <Label htmlFor="invite-email">Or email an invite</Label>
      <div className="flex gap-2">
        <Input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mom@example.com"
        />
        <Button type="submit" variant="outline" disabled={pending || !email}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm text-ok-foreground" : "text-sm text-over-foreground"}>
          {status.text}
        </p>
      )}
    </form>
  );
}

export function PendingInvite({ id, days }: { id: string; days: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <span className="text-sm">
        Expires in {days} {days === 1 ? "day" : "days"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelInvite(id);
            if (result.error) toast.error(result.error);
          })
        }
      >
        Cancel link
      </Button>
    </li>
  );
}

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmButton
      label="Remove"
      title={`Remove ${name}?`}
      description="They won't see this list anymore. Gifts they added stay on the list."
      confirmLabel="Remove"
      variant="outline"
      onConfirm={() => removeMember(userId)}
    />
  );
}

export function LeaveListButton({ listName }: { listName: string }) {
  return (
    <ConfirmButton
      label={`Leave ${listName}`}
      title={`Leave ${listName}?`}
      description="You'll stop seeing this list. Gifts you added stay on it. You can join again with a new invite."
      confirmLabel="Leave"
      variant="outline"
      onConfirm={() => leaveList()}
    />
  );
}
