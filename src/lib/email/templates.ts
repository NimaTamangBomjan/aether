import { formatDate } from "@/lib/dates";
import { SEASON_PASS_THROUGH } from "@/lib/season";

export type Email = { subject: string; html: string; text: string };

/** Everything people typed is escaped before it goes into an email. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, bodyHtml: string, footerHtml = "") {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#fffaf5;font-family:Arial,Helvetica,sans-serif;color:#2b2622;font-size:16px;line-height:1.5">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-weight:bold;color:#b4472f">GiftLedger</p>
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
${bodyHtml}
</div>
<div style="max-width:520px;margin:16px auto 0;font-size:12px;color:#6b625b;text-align:center">${footerHtml}</div>
</body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#b4472f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

export function welcomeEmail(opts: { name: string; appUrl: string }): Email {
  const hi = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  return {
    subject: "Welcome to GiftLedger",
    html: layout(
      "Welcome to GiftLedger",
      `<p>${hi}</p>
<p>You're set up to plan this year's gifts without overspending. Three tips:</p>
<ul><li>Give each person a budget, and watch the colors: green is fine, amber is close, red is over.</li>
<li>Tap &ldquo;Get gift ideas&rdquo; when you're stuck.</li>
<li>Invite your partner or family so nobody buys the same thing twice.</li></ul>
${button(`${opts.appUrl}/app`, "Open my list")}`,
    ),
    text: `${opts.name ? `Hi ${opts.name},` : "Hi,"}\n\nYou're set up to plan this year's gifts without overspending.\n- Give each person a budget and watch the colors.\n- Tap "Get gift ideas" when you're stuck.\n- Invite your family so nobody buys the same thing twice.\n\nOpen your list: ${opts.appUrl}/app\n`,
  };
}

/**
 * A name safe to show in an email sent to a stranger: letters, spaces, hyphens and apostrophes
 * only, so nobody can put a web address or a "verify your account" message in it.
 */
export function plainName(name: string): string | null {
  const trimmed = name.trim();
  return /^[\p{L}\p{M}][\p{L}\p{M}' -]{0,39}$/u.test(trimmed) ? trimmed : null;
}

/** The subject is fixed and the list's name isn't included: invite emails carry no text a stranger chose. */
export function inviteEmail(opts: { inviterName: string; inviteUrl: string }): Email {
  const who = plainName(opts.inviterName) ?? "A family member";
  return {
    subject: "You're invited to a family gift list on GiftLedger",
    html: layout(
      "You're invited to a family gift list",
      `<p><strong>${escapeHtml(who)}</strong> invited you to their family gift list on GiftLedger, so nobody buys the same gift twice.</p>
${button(opts.inviteUrl, "Join the list")}
<p style="font-size:14px;color:#6b625b">This link works once and expires in 7 days. If you weren't expecting this, you can ignore it.</p>`,
    ),
    text: `${who} invited you to their family gift list on GiftLedger, so nobody buys the same gift twice.\n\nJoin: ${opts.inviteUrl}\n\nThis link works once and expires in 7 days. If you weren't expecting this, you can ignore it.\n`,
  };
}

/** To the owner, once a day at most, when invite emails pause because too many were sent today. */
export function invitesPausedEmail(): Email {
  return {
    subject: "GiftLedger: invite emails paused for today",
    html: layout(
      "Invite emails are paused for today",
      `<p>More than 500 invite emails were sent in the last 24 hours, so sending them has paused automatically. People can still copy invite links and send them themselves.</p>
<p>If this is real growth, great: ask Claude to raise the limit. If it looks like abuse, check the Resend dashboard.</p>`,
    ),
    text: "More than 500 invite emails were sent in the last 24 hours, so sending them has paused automatically. People can still copy invite links.\n\nIf this is real growth, ask Claude to raise the limit. If it looks like abuse, check the Resend dashboard.\n",
  };
}

export function passReceiptEmail(opts: { name: string; amountCents: number; appUrl: string }): Email {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  const hi = opts.name ? `Thank you, ${escapeHtml(opts.name)}!` : "Thank you!";
  return {
    subject: "GiftLedger: your Season Pass is active",
    html: layout(
      hi,
      `<p>We received your payment of ${amount}. Your Season Pass is active through ${SEASON_PASS_THROUGH}.</p>
<p>Unlocked: unlimited people, 100 AI gift-idea requests, unlimited family members, and return-window reminders.</p>
${button(`${opts.appUrl}/app`, "Open my list")}
<p style="font-size:14px;color:#6b625b">This is a one-time payment, not a subscription. Stripe also emails a receipt for your records.</p>`,
    ),
    text: `${opts.name ? `Thank you, ${opts.name}!` : "Thank you!"}\n\nWe received your payment of ${amount}. Your Season Pass is active through ${SEASON_PASS_THROUGH}.\nUnlocked: unlimited people, 100 AI gift-idea requests, unlimited family members, and return-window reminders.\n\nOpen your list: ${opts.appUrl}/app\n\nThis is a one-time payment, not a subscription.\n`,
  };
}

export type ReminderItem = {
  giftTitle: string;
  recipientName: string;
  store: string | null;
  returnBy: string;
  daysLeft: number;
};

export function reminderEmail(opts: { name: string; items: ReminderItem[]; today: string; appUrl: string; unsubscribeUrl: string }): Email {
  const lastDay = opts.items.filter((i) => i.daysLeft === 0);
  const soon = opts.items.filter((i) => i.daysLeft > 0);
  const count = opts.items.length;
  const subject =
    count === 1
      ? `GiftLedger: ${lastDay.length ? "last day to return" : "return by " + formatDate(opts.items[0].returnBy, opts.today)} ${opts.items[0].giftTitle}`
      : `GiftLedger: ${count} gifts to return soon`;

  const row = (i: ReminderItem) =>
    `<li><strong>${escapeHtml(i.giftTitle)}</strong> for ${escapeHtml(i.recipientName)}${i.store ? ` (${escapeHtml(i.store)})` : ""}: return by ${formatDate(i.returnBy, opts.today)}</li>`;
  const textRow = (i: ReminderItem) =>
    `- ${i.giftTitle} for ${i.recipientName}${i.store ? ` (${i.store})` : ""}: return by ${formatDate(i.returnBy, opts.today)}`;

  const sections = [
    lastDay.length ? `<p><strong>Last day to return:</strong></p><ul>${lastDay.map(row).join("")}</ul>` : "",
    soon.length ? `<p><strong>Return window closes in 3 days:</strong></p><ul>${soon.map(row).join("")}</ul>` : "",
  ].join("");

  return {
    subject,
    html: layout(
      count === 1 ? "A return window is closing" : "Return windows are closing",
      `<p>${opts.name ? `Hi ${escapeHtml(opts.name)}, h` : "H"}ere's what to return or keep:</p>${sections}
${button(`${opts.appUrl}/app`, "Open my list")}`,
      `You get this because return reminders are on. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6b625b">Unsubscribe from reminders</a>`,
    ),
    text: `${opts.name ? `Hi ${opts.name}, h` : "H"}ere's what to return or keep:\n\n${
      lastDay.length ? `Last day to return:\n${lastDay.map(textRow).join("\n")}\n\n` : ""
    }${soon.length ? `Return window closes in 3 days:\n${soon.map(textRow).join("\n")}\n\n` : ""}Open your list: ${opts.appUrl}/app\n\nUnsubscribe from reminders: ${opts.unsubscribeUrl}\n`,
  };
}

export function costWarningEmail(opts: { projectedUsd: number; spentUsd: number }): Email {
  return {
    subject: `GiftLedger: AI cost projected at $${opts.projectedUsd.toFixed(2)} this month`,
    html: layout(
      "AI spending warning",
      `<p>AI gift ideas have cost about <strong>$${opts.spentUsd.toFixed(2)}</strong> so far this month, on track for <strong>$${opts.projectedUsd.toFixed(2)}</strong> (your warning level is $50).</p>
<p>Check usage and your monthly limit in the Anthropic Console. Each person's requests are logged in the <code>ai_requests</code> table.</p>`,
    ),
    text: `AI gift ideas have cost about $${opts.spentUsd.toFixed(2)} so far this month, on track for $${opts.projectedUsd.toFixed(2)} (warning level $50). Check the Anthropic Console.\n`,
  };
}
