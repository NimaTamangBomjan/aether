"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteRecipient, setRecipientArchived } from "@/app/app/actions";
import { ConfirmButton } from "@/components/app/confirm-button";
import { Button } from "@/components/ui/button";

export function RecipientDangerZone({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section aria-labelledby="more-actions" className="space-y-3 border-t pt-6">
      <h2 id="more-actions" className="font-semibold">
        More actions
      </h2>
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setRecipientArchived(id, !archived);
            if (result.error) return void toast.error(result.error);
            toast.success(archived ? `${name} is back on your list` : `${name} archived`);
            router.push(archived ? `/app/people/${id}` : "/app");
          })
        }
      >
        {archived ? "Unarchive" : "Archive (hide from the main list)"}
      </Button>
      <ConfirmButton
        label={`Delete ${name}`}
        title={`Delete ${name}?`}
        description="This deletes them and all their gifts. It can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteRecipient(id)}
      />
    </section>
  );
}
