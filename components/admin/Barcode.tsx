/**
 * Code 39 barcode as inline SVG.
 *
 * Code 39 needs no check digit and every courier scanner in Pakistan reads it,
 * which matters more here than density. Rendering it ourselves avoids shipping
 * a barcode library into the admin bundle.
 */
const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

export function Barcode({
  value,
  height = 44,
  narrow = 1.6,
}: {
  value: string;
  height?: number;
  narrow?: number;
}) {
  const text = value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "");
  const chars = `*${text}*`.split("");
  const wide = narrow * 2.6;

  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const [index, char] of chars.entries()) {
    const pattern = PATTERNS[char];
    if (!pattern) continue;
    for (const [i, size] of [...pattern].entries()) {
      const w = size === "w" ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    if (index < chars.length - 1) x += narrow; // inter-character gap
  }

  return (
    <svg
      width={x}
      height={height}
      viewBox={`0 0 ${x} ${height}`}
      role="img"
      aria-label={`Barcode for ${text}`}
      shapeRendering="crispEdges"
    >
      <rect width={x} height={height} fill="#fff" />
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={0} width={bar.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}
