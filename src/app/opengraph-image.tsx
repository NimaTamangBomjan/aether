import { ImageResponse } from "next/og";

// The preview card shown when someone shares a GiftLedger link.
export const alt = "GiftLedger: stop overspending on holiday gifts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#fcf8f3",
          color: "#2b2622",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 700, color: "#b4472f" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#b4472f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 40, height: 32, borderRadius: 4, background: "#fcf8f3", display: "flex", justifyContent: "center" }}>
              <div style={{ width: 8, height: 32, background: "#b4472f" }} />
            </div>
          </div>
          GiftLedger
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 40, lineHeight: 1.1 }}>Stop overspending on holiday gifts.</div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#6b625b" }}>
          Budgets for everyone · gift ideas · one family list · return reminders
        </div>
      </div>
    ),
    size,
  );
}
