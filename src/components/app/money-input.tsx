import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input inputMode="decimal" autoComplete="off" placeholder="0" className={cn("pl-7", className)} {...props} />
    </div>
  );
}
