"use client";

import { useState, useTransition } from "react";
import { joinList } from "@/app/join/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinButton({ token, currentName }: { token: string; currentName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await joinList(token, name);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="join-name">Your name</Label>
        <Input id="join-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" aria-describedby="join-name-hint" />
        <p id="join-name-hint" className="text-sm text-muted-foreground">
          So your family knows who bought what.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join the list"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-over-foreground">
          {error}
        </p>
      )}
    </form>
  );
}
