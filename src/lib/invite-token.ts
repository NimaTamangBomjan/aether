import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256 random bits, URL-safe. Only its sha256 fingerprint is stored. */
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isInviteTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** A one-way fingerprint of an invited email address, so repeat invites can be spotted without storing it. */
export function hashInviteEmail(email: string) {
  return createHash("sha256").update(`giftledger-invite-email:${email.trim().toLowerCase()}`).digest("hex");
}
