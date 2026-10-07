// A stand-in for the Resend email API, used only by browser tests. It records what would
// have been sent. GET /emails lists them. A recipient containing "bounce" gets an error.
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_EMAIL_PORT ?? 4011);
const emails = [];
const keys = new Map();

function reply(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/emails") return reply(res, 200, emails);
  if (req.method !== "POST" || req.url !== "/emails") return reply(res, 404, { message: "not found" });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const to = [].concat(body.to);
  if (to.some((t) => t.includes("bounce"))) {
    return reply(res, 422, { statusCode: 422, name: "validation_error", message: "Invalid recipient" });
  }
  const key = req.headers["idempotency-key"];
  if (key && keys.has(key)) return reply(res, 200, { id: keys.get(key) });
  const id = `email_${emails.length + 1}`;
  if (key) keys.set(key, id);
  emails.push({ id, to, from: body.from, subject: body.subject, html: body.html, text: body.text, headers: body.headers ?? {}, at: Date.now() });
  return reply(res, 200, { id });
}).listen(PORT, "127.0.0.1", () => console.log(`fake email listening on ${PORT}`));
