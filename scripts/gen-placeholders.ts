/**
 * Generates lightweight placeholder images so the site builds before real
 * photography exists. Every file this writes is listed in README "Placeholders".
 *
 *   npx tsx scripts/gen-placeholders.ts
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SEED_PRODUCTS } from "../lib/db/seed-data";
import { FAMILIES } from "../lib/catalog";

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const PAPER = "#FCFBF8";
const INK = "#17150F";
const RULE = "#E3DFD4";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A simple bottle silhouette with a coloured label band. */
function bottleSvg(opts: {
  w: number;
  h: number;
  band: string;
  name: string;
  sub: string;
  variant?: number;
  bg?: string;
}) {
  const { w, h, band, name, sub, variant = 1, bg = "#FFFFFF" } = opts;
  const cx = w / 2;
  const bw = Math.round(w * 0.34);
  const bh = Math.round(h * 0.62);
  const top = Math.round(h * 0.2);
  const capH = Math.round(h * 0.07);
  const capW = Math.round(bw * 0.42);
  const bandY = top + Math.round(bh * 0.34);
  const bandH = Math.round(bh * 0.3);
  const shadowY = top + bh + Math.round(h * 0.015);
  const rotate = variant === 2 ? -8 : 0;
  const labelFont = Math.round(w * 0.045);
  const subFont = Math.round(w * 0.028);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <ellipse cx="${cx}" cy="${shadowY}" rx="${Math.round(bw * 0.7)}" ry="${Math.round(h * 0.02)}" fill="${INK}" opacity="0.08"/>
  <g transform="rotate(${rotate} ${cx} ${top + bh / 2})">
    <rect x="${cx - capW / 2}" y="${top - capH}" width="${capW}" height="${capH + 8}" rx="6" fill="${INK}"/>
    <rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${bh}" rx="${Math.round(bw * 0.18)}" fill="#F4F1EA" stroke="${RULE}" stroke-width="3"/>
    <rect x="${cx - bw / 2}" y="${bandY}" width="${bw}" height="${bandH}" fill="${band}"/>
    <text x="${cx}" y="${bandY + bandH / 2 - subFont * 0.2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${labelFont}" fill="#FFFFFF">${esc(name)}</text>
    <text x="${cx}" y="${bandY + bandH / 2 + subFont * 1.4}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${subFont}" fill="#FFFFFF" opacity="0.9">${esc(sub)}</text>
    <rect x="${cx - bw / 2 + Math.round(bw * 0.12)}" y="${top + Math.round(bh * 0.08)}" width="${Math.round(bw * 0.06)}" height="${Math.round(bh * 0.2)}" rx="6" fill="#FFFFFF" opacity="0.6"/>
  </g>
</svg>`;
}

async function toJpg(svg: string, file: string) {
  await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
}

async function main() {
  await mkdir(path.join(PUBLIC, "products"), { recursive: true });
  await mkdir(path.join(PUBLIC, "models"), { recursive: true });

  // Product photos: 1200x1200 JPG, two per product.
  for (const p of SEED_PRODUCTS) {
    const band = FAMILIES[p.family].hex;
    for (const [i, img] of p.images.entries()) {
      const svg = bottleSvg({
        w: 1200,
        h: 1200,
        band,
        name: p.name.toUpperCase(),
        sub: p.variants[0]?.label ?? "",
        variant: i + 1,
      });
      await toJpg(svg, path.join(PUBLIC, img));
    }
  }

  // Hero visual: 1000x1200 (5:6) PNG, the LCP element.
  // Only written when missing, so re-running this script never overwrites real artwork.
  const heroPath = path.join(PUBLIC, "hero-bottle.png");
  if (existsSync(heroPath)) {
    console.log("hero-bottle.png already exists, left untouched.");
  } else {
    const hero = bottleSvg({
      w: 1000,
      h: 1200,
      band: FAMILIES.oils.hex,
      name: "MARK",
      sub: "MUSTARD OIL",
      bg: PAPER,
    });
    await sharp(Buffer.from(hero)).png().toFile(heroPath);
  }

  // Brand story image: 1200x800.
  const story = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#F4F1EA"/>
    <g>${[0, 1, 2].map((i) => {
      const fams = ["oils", "relief", "home"] as const;
      const x = 260 + i * 340;
      return `<rect x="${x - 60}" y="240" width="120" height="360" rx="24" fill="#FFFFFF" stroke="${RULE}" stroke-width="3"/><rect x="${x - 60}" y="360" width="120" height="110" fill="${FAMILIES[fams[i]].hex}"/><rect x="${x - 26}" y="200" width="52" height="46" rx="6" fill="${INK}"/>`;
    }).join("")}</g>
  </svg>`;
  await toJpg(story, path.join(PUBLIC, "brand-story.jpg"));

  // Logo wordmark SVG.
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="32" viewBox="0 0 180 32" role="img" aria-label="MARKORGANIC">
  <rect x="0" y="4" width="6" height="24" fill="${FAMILIES.oils.hex}"/>
  <rect x="8" y="4" width="6" height="24" fill="${FAMILIES.relief.hex}"/>
  <rect x="16" y="4" width="6" height="24" fill="${FAMILIES.home.hex}"/>
  <text x="30" y="23" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="19" letter-spacing="-0.5" fill="${INK}">MARKORGANIC</text>
</svg>`;
  await writeFile(path.join(PUBLIC, "logo.svg"), logo);

  // Favicons (app/icon.png + app/apple-icon.png) from a 3-band mark.
  const mark = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${PAPER}"/>
  <rect x="5" y="6" width="6" height="20" fill="${FAMILIES.oils.hex}"/>
  <rect x="13" y="6" width="6" height="20" fill="${FAMILIES.relief.hex}"/>
  <rect x="21" y="6" width="6" height="20" fill="${FAMILIES.home.hex}"/>
</svg>`;
  await sharp(Buffer.from(mark(64))).png().toFile(path.join(ROOT, "app", "icon.png"));
  await sharp(Buffer.from(mark(180))).resize(180, 180).png().toFile(path.join(ROOT, "app", "apple-icon.png"));
  // Browsers still request /favicon.ico directly; a 32px PNG served under that name satisfies them.
  await sharp(Buffer.from(mark(32))).png().toFile(path.join(ROOT, "app", "favicon.ico"));

  console.log("Placeholders written to /public and /app.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
