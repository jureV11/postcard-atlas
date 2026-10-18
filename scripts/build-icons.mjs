// Renders the app icons (the stamp-and-globe from app/icon.svg) as PNGs for
// "Add to Home Screen": public/icons/*.png and app/apple-icon.png.
// Run: node scripts/build-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const PAPER = "#f6f0e4";
const STAMP = "#c2503a";

/** The stamp drawn in a 32×32 box; `pad` shrinks it towards the centre (safe zone for masked icons). */
function svg({ rounded, pad }) {
  const s = 32 - 2 * pad;
  const k = s / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" ${rounded ? 'rx="6"' : ""} fill="${PAPER}"/>
  <g transform="translate(${pad} ${pad}) scale(${k})">
    <path d="M4 4h24v24H4z" fill="${STAMP}" stroke="${PAPER}" stroke-width="2.5" stroke-dasharray="2.2 1.8"/>
    <circle cx="16" cy="16" r="6.5" fill="none" stroke="${PAPER}" stroke-width="1.6"/>
    <path d="M9.5 16h13M16 9.5c-2.6 3.6-2.6 9.4 0 13M16 9.5c2.6 3.6 2.6 9.4 0 13" fill="none" stroke="${PAPER}" stroke-width="1.2"/>
  </g>
</svg>`;
}

const out = [
  // Regular icons (browsers round or frame them as they like)
  { file: "public/icons/icon-192.png", size: 192, rounded: false, pad: 0 },
  { file: "public/icons/icon-512.png", size: 512, rounded: false, pad: 0 },
  // Android "maskable": the launcher crops to a circle/squircle, so keep the stamp in the middle 80%
  { file: "public/icons/maskable-512.png", size: 512, rounded: false, pad: 4 },
  // iPhone home screen: square, no transparency (iOS rounds the corners itself)
  { file: "app/apple-icon.png", size: 180, rounded: false, pad: 1.5 },
];

await mkdir("public/icons", { recursive: true });
for (const o of out) {
  const png = await sharp(Buffer.from(svg(o)), { density: (o.size / 32) * 72 })
    .resize(o.size, o.size)
    .flatten({ background: PAPER })
    .png()
    .toBuffer();
  await writeFile(o.file, png);
  console.log(`${o.file} (${o.size}px)`);
}
