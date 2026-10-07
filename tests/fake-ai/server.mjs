// A stand-in for the Anthropic Messages API, used only by browser tests.
// It answers like the real API so the app's real SDK code path is exercised.
// Words in the request switch behaviors: FAKE_ERROR, FAKE_SLOW, FAKE_BAD, FAKE_BAD_ONCE.
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_AI_PORT ?? 4010);
const requests = [];
const seen = new Map();
let counter = 0;

const BASE = [
  ["Hummingbird feeder with window mount", "item", "A cheerful way to enjoy birds every morning."],
  ["Botanical garden day passes", "experience", "A relaxing outing among the plants they love."],
  ["Custom photo calendar", "personal", "Family photos to enjoy all year."],
  ["Gourmet tea sampler", "consumable", "Something cozy to sip on winter afternoons."],
  ["Hardcover mystery novel", "item", "A page-turner for quiet evenings."],
];

function reply(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "request-id": `req_fake_${++counter}` });
  res.end(JSON.stringify(body));
}

function message(text) {
  return {
    id: `msg_fake_${counter}`,
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 700, output_tokens: 450 },
  };
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/requests") return reply(res, 200, requests);
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) return reply(res, 404, { error: "not found" });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const user = body.messages?.[0]?.content ?? "";
  requests.push({ system: body.system, user, model: body.model, max_tokens: body.max_tokens, at: Date.now() });
  if (requests.length > 500) requests.shift();

  if (user.includes("FAKE_ERROR")) {
    return reply(res, 500, { type: "error", error: { type: "api_error", message: "Internal server error" } });
  }
  if (user.includes("FAKE_SLOW")) await new Promise((r) => setTimeout(r, 10_000));

  const budget = Number(user.match(/Remaining budget: \$([\d.]+)/)?.[1] ?? 50);
  const n = ++counter;
  const ideas = BASE.map(([title, category, why], i) => ({
    title: `${title} ${n}-${i + 1}`,
    estimated_price_usd: Math.max(1, Math.round(budget * [0.2, 0.35, 0.5, 0.7, 0.9][i] * 100) / 100),
    why_it_fits: why,
    category,
  }));

  if (user.includes("FAKE_BAD_ONCE")) {
    const times = (seen.get(user) ?? 0) + 1;
    seen.set(user, times);
    if (times === 1) return reply(res, 200, message('{"ideas": [ broken json'));
  } else if (user.includes("FAKE_BAD")) {
    return reply(res, 200, message(JSON.stringify({ ideas: ideas.slice(0, 4) })));
  }
  return reply(res, 200, message(JSON.stringify({ ideas })));
}).listen(PORT, "127.0.0.1", () => console.log(`fake AI listening on ${PORT}`));
