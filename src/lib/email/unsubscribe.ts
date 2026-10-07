import { createHmac, timingSafeEqual } from "node:crypto";

/** One-click unsubscribe links are signed, so nobody can turn off someone else's reminders. */
export function unsubscribeSignature(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
}

export function unsubscribeUrl(appUrl: string, userId: string, secret: string): string {
  return `${appUrl}/unsubscribe?u=${encodeURIComponent(userId)}&s=${unsubscribeSignature(userId, secret)}`;
}

export function verifyUnsubscribe(userId: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !signature) return false;
  const expected = Buffer.from(unsubscribeSignature(userId, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
