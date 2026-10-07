import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type GiftStatus = Database["public"]["Enums"]["gift_status"];
export type AgeRange = Database["public"]["Enums"]["age_range"];
export type Recipient = Tables["recipients"]["Row"];
export type Gift = Tables["gifts"]["Row"];
export type List = Tables["lists"]["Row"];
export type Profile = Tables["profiles"]["Row"];

export const GIFT_STATUSES: readonly GiftStatus[] = ["idea", "bought", "wrapped", "given"];

export const STATUS_LABEL: Record<GiftStatus, string> = {
  idea: "Idea",
  bought: "Bought",
  wrapped: "Wrapped",
  given: "Given",
};

/** What the one-tap button does next. Given is the end of the line. */
export const NEXT_STATUS: Record<GiftStatus, GiftStatus | null> = {
  idea: "bought",
  bought: "wrapped",
  wrapped: "given",
  given: null,
};

export const NEXT_STATUS_ACTION: Record<GiftStatus, string | null> = {
  idea: "Mark bought",
  bought: "Mark wrapped",
  wrapped: "Mark given",
  given: null,
};

export const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: "baby", label: "Baby (under 1)" },
  { value: "toddler", label: "Toddler (1–3)" },
  { value: "kid", label: "Kid (4–8)" },
  { value: "tween", label: "Tween (9–12)" },
  { value: "teen", label: "Teen (13–17)" },
  { value: "young_adult", label: "Young adult (18–25)" },
  { value: "adult", label: "Adult (26–64)" },
  { value: "senior", label: "Senior (65+)" },
];

export const RELATIONSHIPS = [
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Grandparent",
  "Grandchild",
  "In-law",
  "Aunt or uncle",
  "Niece or nephew",
  "Cousin",
  "Friend",
  "Coworker",
  "Teacher",
  "Neighbor",
] as const;

export const FREE_RECIPIENT_LIMIT = 5;
export const FREE_MEMBER_LIMIT = 1;
