import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/server-env";

/** Stripe API client, or null until the Stripe keys are configured. */
export function getStripe(): Stripe | null {
  const key = serverEnv().STRIPE_SECRET_KEY;
  return key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 }) : null;
}

export function checkoutConfigured() {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
}
