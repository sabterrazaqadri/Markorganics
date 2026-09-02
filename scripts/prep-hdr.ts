/**
 * Downsamples an equirectangular Radiance (.hdr) environment map in place.
 *
 *   npx tsx scripts/prep-hdr.ts [targetWidth]
 *
 * The source is studio_small_03_1k.hdr from pmndrs/drei-assets, which is the map
 * drei's <Environment preset="studio" /> resolves to. At 1k it is 1.6 MB, which
 * is far more than a single bottle needs, so we box-filter it down and re-encode
 * as flat (non-RLE) RGBE. three's RGBELoader reads flat RGBE directly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FloatType } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

const FILE = path.resolve(__dirname, "../public/hdr/studio.hdr");
const TARGET_W = Number(process.argv[2] ?? 512);

/** Split v into mantissa in [0.5,1) and exponent, the way frexp does. */
function frexp(v: number): [number, number] {
  let e = Math.floor(Math.log2(v)) + 1;
  let m = v / Math.pow(2, e);
  while (m >= 1) {
    m /= 2;
    e += 1;
  }
  while (m < 0.5) {
    m *= 2;
    e -= 1;
  }
  return [m, e];
}

function encodeRgbe(r: number, g: number, b: number, out: Uint8Array, at: number) {
  const v = Math.max(r, g, b);
  if (!(v > 1e-32)) {
    out[at] = 0;
    out[at + 1] = 0;
    out[at + 2] = 0;
    out[at + 3] = 0;
    return;
  }
  const [m, e] = frexp(v);
  const exp = e + 128;
  if (exp <= 0 || exp > 255) {
    out[at] = 0;
    out[at + 1] = 0;
    out[at + 2] = 0;
    out[at + 3] = 0;
    return;
  }
  const scale = (m * 256) / v;
  out[at] = Math.min(255, Math.max(0, Math.floor(r * scale)));
  out[at + 1] = Math.min(255, Math.max(0, Math.floor(g * scale)));
  out[at + 2] = Math.min(255, Math.max(0, Math.floor(b * scale)));
  out[at + 3] = exp;
}

function main() {
  const raw = readFileSync(FILE);
  const before = raw.byteLength;

  const loader = new HDRLoader();
  loader.type = FloatType;
  const tex = loader.parse(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)) as {
    width: number;
    height: number;
    data: Float32Array;
  };

  const { width: sw, height: sh, data } = tex;
  const comps = data.length / (sw * sh);
  if (comps !== 3 && comps !== 4) throw new Error(`Unexpected component count: ${comps}`);

  if (sw <= TARGET_W) {
    console.log(`Already ${sw}x${sh}, no downsample needed.`);
    return;
  }

  const dw = TARGET_W;
  const dh = Math.max(1, Math.round((sh / sw) * dw));
  const bx = sw / dw;
  const by = sh / dh;
  const out = new Uint8Array(dw * dh * 4);

  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * by);
    const y1 = Math.min(sh, Math.max(y0 + 1, Math.floor((y + 1) * by)));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * bx);
      const x1 = Math.min(sw, Math.max(x0 + 1, Math.floor((x + 1) * bx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * comps;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      encodeRgbe(r / n, g / n, b / n, out, (y * dw + x) * 4);
    }
  }

  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${dh} +X ${dw}\n`, "ascii");
  writeFileSync(FILE, Buffer.concat([header, Buffer.from(out)]));

  const after = readFileSync(FILE).byteLength;
  console.log(`${sw}x${sh} -> ${dw}x${dh}`);
  console.log(`${(before / 1024).toFixed(0)} kB -> ${(after / 1024).toFixed(0)} kB`);
}

main();
