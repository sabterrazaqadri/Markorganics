/**
 * Pakistani mobile numbers: 03XXXXXXXXX (11 digits) or +923XXXXXXXXX.
 * Also tolerates spaces, dashes and a leading 0092 / 92.
 */
const PK_MOBILE = /^(?:\+?92|0092|0)?(3\d{9})$/;

export function normalizePkPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, "");
  const m = cleaned.match(PK_MOBILE);
  if (!m) return null;
  return `+92${m[1]}`;
}

export function isPkPhone(input: string): boolean {
  return normalizePkPhone(input) !== null;
}

/** +923001234567 -> 0300 1234567 for display. */
export function displayPkPhone(e164: string): string {
  const m = e164.match(/^\+92(3\d{2})(\d{7})$/);
  return m ? `0${m[1]} ${m[2]}` : e164;
}

/** +923001234567 -> 923001234567 for wa.me links. */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
