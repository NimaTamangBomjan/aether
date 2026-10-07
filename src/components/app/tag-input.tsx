"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

/** Type an interest and press Enter or comma to add it. Stored as a comma-separated hidden field. */
export function TagInput({ id, name, defaultValue = [], max = 20, describedBy }: { id: string; name: string; defaultValue?: string[]; max?: number; describedBy?: string }) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw.split(",").map((s) => s.trim().slice(0, 30)).filter(Boolean);
    if (!parts.length) return;
    setTags((current) => [...new Set([...current, ...parts])].slice(0, max));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length) {
      setTags((t) => t.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={[...tags, ...(draft.trim() ? [draft.trim()] : [])].join(",")} />
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Added interests">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-sm text-accent-foreground">
              {tag}
              <button
                type="button"
                onClick={() => setTags((t) => t.filter((x) => x !== tag))}
                className="flex size-8 items-center justify-center rounded-full hover:bg-background/60"
                aria-label={`Remove ${tag}`}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={tags.length >= max ? "That's the maximum" : "e.g. gardening, Lego, coffee"}
        disabled={tags.length >= max}
        enterKeyHint="done"
        aria-describedby={describedBy}
      />
    </div>
  );
}
