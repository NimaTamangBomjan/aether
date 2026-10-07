import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { scrubText, scrubUrl } from "@/lib/scrub";

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
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.transaction) event.transaction = scrubText(event.transaction);
  if (event.message) event.message = scrubText(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }
  const nextjs = event.contexts?.nextjs;
  if (nextjs && typeof nextjs.request_path === "string") nextjs.request_path = scrubUrl(nextjs.request_path);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  }
  return event;
}

/**
 * The trail of steps before an error. Clicks and typing are dropped (button labels can name
 * people); page changes and network calls keep their path only.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category?.startsWith("ui.")) return null;
  const out: Breadcrumb = { ...breadcrumb };
  if (out.message) out.message = scrubText(out.message);
  if (out.data) {
    const data: Record<string, unknown> = { ...out.data };
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") data[key] = ["url", "from", "to"].includes(key) ? scrubUrl(value) : scrubText(value);
    }
    out.data = data;
  }
  return out;
}
