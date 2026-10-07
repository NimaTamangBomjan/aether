// Draws the GiftLedger app icon (a gift box) and writes the PNG sizes the PWA and phones need.
// Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = "#b4472f";
const CREAM = "#fcf8f3";

function svg(size, { padding = 0.18, rounded = true } = {}) {
  const p = size * padding;
  const box = size - 2 * p;
  const lidH = box * 0.24;
  const bodyY = p + box * 0.3;
  const ribbon = box * 0.14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${BG}"/>
  <rect x="${p + box * 0.06}" y="${bodyY}" width="${box * 0.88}" height="${box * 0.7}" rx="${box * 0.05}" fill="${CREAM}"/>
  <rect x="${p}" y="${bodyY - lidH * 0.55}" width="${box}" height="${lidH}" rx="${box * 0.05}" fill="${CREAM}"/>
  <rect x="${size / 2 - ribbon / 2}" y="${bodyY - lidH * 0.55}" width="${ribbon}" height="${box * 0.95}" fill="${BG}" opacity="0.85"/>
  <path d="M ${size / 2} ${bodyY - lidH * 0.55}
           C ${size / 2 - box * 0.05} ${p - box * 0.02}, ${size / 2 - box * 0.36} ${p + box * 0.02}, ${size / 2 - box * 0.22} ${bodyY - lidH * 0.6}
           Z M ${size / 2} ${bodyY - lidH * 0.55}
           C ${size / 2 + box * 0.05} ${p - box * 0.02}, ${size / 2 + box * 0.36} ${p + box * 0.02}, ${size / 2 + box * 0.22} ${bodyY - lidH * 0.6} Z"
        fill="none" stroke="${CREAM}" stroke-width="${box * 0.07}" stroke-linejoin="round"/>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("src/app/icon.svg", svg(64));
const jobs = [
  ["public/icons/icon-192.png", 192, {}],
  ["public/icons/icon-512.png", 512, {}],
  // Maskable icons need extra safe space and no rounded corners (the phone shapes them).
  ["public/icons/maskable-512.png", 512, { padding: 0.26, rounded: false }],
  ["src/app/apple-icon.png", 180, { rounded: false }],
];
for (const [file, size, opts] of jobs) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file);
  console.log("wrote", file);
}
