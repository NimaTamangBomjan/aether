import "server-only";
import { z } from "zod";

// Secret values: only ever read on the server. Missing optional keys switch features off
// with a friendly message rather than crashing the app.
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  CRON_SECRET: z.string().min(16).optional(),
  UNSUBSCRIBE_SECRET: z.string().min(16).optional(),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  STRIPE_SECRET_KEY: z.string().min(10).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(10).optional(),
  STRIPE_PRICE_ID: z.string().min(5).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  SENTRY_DSN: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;

export function serverEnv() {
  cached ??= schema.parse(process.env);
  return cached;
}
