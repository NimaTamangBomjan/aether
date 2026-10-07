import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

// Server-side error reporting with Sentry. Does nothing until SENTRY_DSN is set.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
