import type { Metadata } from "next";
import { PassStatus } from "./pass-status";

export const metadata: Metadata = { title: "Thank you" };

// Stripe sends people here after paying. The pass is unlocked only by Stripe's webhook,
// so this page just waits for that to happen.
export default function UpgradeSuccessPage() {
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-2xl font-bold">Thank you!</h1>
      <PassStatus />
    </div>
  );
}
