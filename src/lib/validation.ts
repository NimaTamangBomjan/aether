import { z } from "zod";
import { dollarsToCents } from "@/lib/money";
import { isIsoDate } from "@/lib/dates";
import { Constants } from "@/lib/database.types";

const optionalMoney = (label: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value == null || value.trim() === "") return null;
      const cents = dollarsToCents(value);
      if (cents == null || cents > 10_000_000) {
        ctx.addIssue({ code: "custom", message: `${label} should be an amount like 25 or 24.99.` });
        return z.NEVER;
      }
      return cents;
    });

const optionalDate = (label: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value == null || value.trim() === "") return null;
      if (!isIsoDate(value)) {
        ctx.addIssue({ code: "custom", message: `${label} isn't a valid date.` });
        return z.NEVER;
      }
      return value;
    });

// Line breaks and other invisible control characters (pasted text can carry them) become spaces in
// one-line fields like names and titles. They're refused by the database too.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
export const oneLine = (v: string) => v.replace(CONTROL_CHARS, " ").trim();

const text = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `${label} can be up to ${max} characters.`));

const lineText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => oneLine(v ?? ""))
    .pipe(z.string().max(max, `${label} can be up to ${max} characters.`));

export const recipientInput = z.object({
  name: z.string().transform(oneLine).pipe(z.string().min(1, "Add a name.").max(80, "Names can be up to 80 characters.")),
  relationship: text(40, "Relationship"),
  budget: optionalMoney("Budget"),
  age_range: z
    .union([z.enum(Constants.public.Enums.age_range), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  interests: z
    .string()
    .optional()
    .transform((v) =>
      [...new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean))],
    )
    .pipe(
      z
        .array(z.string().max(30, "Each interest can be up to 30 characters."))
        .max(20, "Add up to 20 interests."),
    ),
  notes: text(1000, "Notes"),
  dont_buy_notes: text(1000, "Don't-buy notes"),
  linked_user_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});
export type RecipientInput = z.infer<typeof recipientInput>;

export const giftInput = z.object({
  title: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1, "Add what the gift is.").max(120, "Keep the title under 120 characters.")),
  link: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(
      z.union([
        z.literal(""),
        z
          .url({ protocol: /^https?$/, message: "Links should start with https://" })
          .max(2000, "That link is too long."),
      ]),
    )
    .transform((v) => (v === "" ? null : v)),
  price: optionalMoney("Price"),
  quantity: z.coerce.number().int().min(1, "Quantity is at least 1.").max(99, "Quantity can be up to 99.").default(1),
  status: z.enum(Constants.public.Enums.gift_status).default("idea"),
  store: lineText(80, "Store").transform((v) => (v === "" ? null : v)),
  purchase_date: optionalDate("Purchase date"),
  return_by: optionalDate("Return-by date"),
  notes: text(1000, "Notes"),
  bought_by: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});
export type GiftInput = z.infer<typeof giftInput>;

export const quickGiftInput = z.object({
  title: giftInput.shape.title,
  price: optionalMoney("Price"),
});

export const budgetInput = z.object({ budget: optionalMoney("Budget") });

/** The name family members see. No web or email addresses: it's shown to people being invited. */
export const displayNameInput = z
  .string()
  .transform(oneLine)
  .pipe(
    z
      .string()
      .min(1, "Add the name your family sees.")
      .max(60, "Names can be up to 60 characters.")
      .refine((v) => !/:\/\/|www\.|@/i.test(v), "Names can't include web or email addresses."),
  );

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

/** First message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
