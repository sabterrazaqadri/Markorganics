/** Format integer paisa as a PKR string, e.g. 175000 -> "Rs 1,750". */
export function formatPKR(paisa: number): string {
  const rupees = Math.round(paisa) / 100;
  const whole = Math.floor(rupees);
  const frac = Math.round((rupees - whole) * 100);
  const text = whole.toLocaleString("en-PK");
  return frac ? `Rs ${text}.${String(frac).padStart(2, "0")}` : `Rs ${text}`;
}

/** Paisa -> decimal rupee string for feeds and JSON-LD, e.g. 175000 -> "1750.00". */
export function paisaToDecimal(paisa: number): string {
  return (Math.round(paisa) / 100).toFixed(2);
}

export function rupeesToPaisa(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paisaToRupees(paisa: number): number {
  return Math.round(paisa) / 100;
}
