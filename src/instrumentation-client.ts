import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubSentryEvent } from "@/lib/sentry-scrub";

// Browser error reporting with Sentry. Does nothing until NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined;
