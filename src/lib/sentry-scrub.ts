import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Removes personal details from error reports before they leave the app: cookies, headers,
 * request bodies, query strings (which can hold invite tokens) and anything about the user
 * except their random account id.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0].replace(/\/join\/[^/]+/, "/join/[token]");
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}
