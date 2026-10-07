import { describe, expect, it } from "vitest";
import { generateIdeas } from "@/lib/ai/generate";
import { buildProfile } from "@/lib/ai/ideas";
import type { AgeRange } from "@/lib/types";

// Calls the real AI with 10 sample profiles (CLAUDE.md §19). Costs about 5 cents in total.
// Run with: npm run test:ai-live   (needs ANTHROPIC_API_KEY; skipped otherwise)

type Sample = {
  name: string;
  relationship: string;
  age_range: AgeRange | null;
  interests: string[];
  notes: string;
  dont_buy_notes: string;
  budget: number;
};

const SAMPLES: Sample[] = [
  { name: "Lily", relationship: "Child", age_range: "toddler", interests: ["dinosaurs", "bath time"], notes: "Just turned 2", dont_buy_notes: "No toys with small parts", budget: 3000 },
  { name: "Ethan", relationship: "Child", age_range: "teen", interests: ["gaming", "basketball"], notes: "Plays on a Nintendo Switch", dont_buy_notes: "Already has AirPods", budget: 8000 },
  { name: "Ms. Patel", relationship: "Teacher", age_range: "adult", interests: ["coffee", "reading"], notes: "Second grade teacher", dont_buy_notes: "No more mugs", budget: 2000 },
  { name: "Dana", relationship: "Coworker", age_range: "adult", interests: [], notes: "Secret office swap, keep it neutral", dont_buy_notes: "", budget: 1500 },
  { name: "Grandma Rose", relationship: "Grandparent", age_range: "senior", interests: ["birds", "gardening", "mystery novels"], notes: "Lives alone, loves calls from the grandkids", dont_buy_notes: "Already has a Kindle, no scarves", budget: 5000 },
  { name: "Chris", relationship: "Partner", age_range: "adult", interests: ["hiking", "cooking", "jazz"], notes: "We never get date nights", dont_buy_notes: "No clothes", budget: 15000 },
  { name: "Frank", relationship: "In-law", age_range: "senior", interests: ["golf", "history"], notes: "Has everything, hard to shop for", dont_buy_notes: "No golf balls, no ties", budget: 7500 },
  { name: "Mateo", relationship: "Niece or nephew", age_range: "kid", interests: ["Lego", "space"], notes: "9 years old, builds everything", dont_buy_notes: "Already has the Lego Saturn V", budget: 4000 },
  { name: "Priya", relationship: "Cousin", age_range: "young_adult", interests: ["plants", "thrifting"], notes: "College student in a tiny dorm room", dont_buy_notes: "", budget: 3000 },
  { name: "Mr. Lee", relationship: "Neighbor", age_range: "senior", interests: ["baking"], notes: "Watches our cat when we travel", dont_buy_notes: "", budget: 1000 },
];

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("real AI prompt on 10 sample profiles", () => {
  it.each(SAMPLES)("$relationship ($age_range), $$budget cents: 5 valid ideas", async (sample) => {
    const profile = buildProfile(sample, ["Maria"], sample.budget);
    const result = await generateIdeas({ profile, kind: "initial" });
    if (!result.ok) throw new Error(`failed: ${result.reason}`);
    expect(result.ideas).toHaveLength(5);
    const cost = (result.inputTokens * 1 + result.outputTokens * 5) / 1_000_000;
    console.log(
      `\n${sample.relationship}, budget $${sample.budget / 100} (tokens in ${result.inputTokens}, out ${result.outputTokens}, ~$${cost.toFixed(4)})\n` +
        result.ideas.map((i) => `  - [${i.category}] ${i.title}: $${i.estimated_price_usd}. ${i.why_it_fits}`).join("\n"),
    );
  }, 60_000);
});
