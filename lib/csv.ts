function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  // BOM so Excel opens UTF-8 correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
