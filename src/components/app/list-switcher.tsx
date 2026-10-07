"use client";

import { useRef } from "react";
import { switchList } from "@/app/app/family/actions";
import { Label } from "@/components/ui/label";

export function ListSwitcher({ lists, activeId }: { lists: { id: string; label: string }[]; activeId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={switchList} className="flex items-center gap-2">
      <Label htmlFor="list-switcher" className="sr-only">
        Switch list
      </Label>
      <select
        id="list-switcher"
        name="list_id"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-11 max-w-44 truncate rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      >
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit">Switch</button>
      </noscript>
    </form>
  );
}
