// A stand-in for PostHog, used only by browser tests. It accepts whatever the PostHog
// browser library and our server send, and records events. GET /events lists them.
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";

const PORT = Number(process.env.FAKE_POSTHOG_PORT ?? 4012);
const events = [];

function decode(raw, url) {
  let buf = raw;
  if (url.includes("compression=gzip") || (buf[0] === 0x1f && buf[1] === 0x8b)) buf = gunzipSync(buf);
  let text = buf.toString("utf8");
  if (text.startsWith("data=")) text = Buffer.from(decodeURIComponent(text.slice(5)), "base64").toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const cors = {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "content-type": "application/json",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, cors);
    return res.end(JSON.stringify(events));
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? decode(Buffer.concat(chunks), req.url ?? "") : null;
  if (body) {
    const list = Array.isArray(body) ? body : body.batch ?? [body];
    for (const e of list) if (e && e.event) events.push({ event: e.event, distinct_id: e.distinct_id ?? e.properties?.distinct_id, properties: e.properties ?? {} });
  }
  res.writeHead(200, cors);
  res.end(req.url?.startsWith("/flags") || req.url?.startsWith("/decide") ? JSON.stringify({ featureFlags: {}, flags: {} }) : JSON.stringify({ status: 1 }));
}).listen(PORT, "127.0.0.1", () => console.log(`fake posthog listening on ${PORT}`));
