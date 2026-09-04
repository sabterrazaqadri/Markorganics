import "server-only";
import { formatPKR } from "@/lib/money";
import { courierName } from "./index";
import type { ShipmentWithOrder } from "./shipments";

/**
 * A day's bookings as a printable loadsheet, generated here rather than
 * fetched from a courier — every courier's loadsheet endpoint is different,
 * and the rider only needs one page they can sign.
 *
 * Written by hand as PDF 1.4 so the app takes no PDF dependency: this is a
 * text table, and a text table does not justify 2 MB of node_modules.
 */

interface TextRun {
  x: number;
  y: number;
  size: number;
  text: string;
  bold?: boolean;
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const ROW_HEIGHT = 16;
const ROWS_PER_PAGE = 38;

/** PDF strings are Latin-1; anything outside it is transliterated away. */
function escapePdfText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function contentStream(runs: TextRun[]): string {
  return runs
    .map(
      (run) =>
        `BT /${run.bold ? "F2" : "F1"} ${run.size} Tf ${run.x.toFixed(2)} ${run.y.toFixed(2)} Td (${escapePdfText(run.text)}) Tj ET`,
    )
    .join("\n");
}

function buildPdf(pages: TextRun[][]): Buffer {
  const objects: string[] = [];
  const pageCount = Math.max(1, pages.length);
  // 1 catalog, 2 pages tree, 3 F1, 4 F2, then (content, page) per page.
  const firstPageObj = 5;
  const pageIds = Array.from({ length: pageCount }, (_, i) => firstPageObj + i * 2 + 1);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  for (let i = 0; i < pageCount; i++) {
    const contentId = firstPageObj + i * 2;
    const pageId = contentId + 1;
    const stream = contentStream(pages[i] ?? []);
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

export interface LoadsheetInput {
  provider: string;
  day: Date;
  storeName: string;
  shipments: ShipmentWithOrder[];
}

const COLUMNS = [
  { x: MARGIN, label: "#", width: 3 },
  { x: MARGIN + 24, label: "Tracking", width: 18 },
  { x: MARGIN + 130, label: "Order", width: 12 },
  { x: MARGIN + 205, label: "Customer", width: 20 },
  { x: MARGIN + 320, label: "City", width: 14 },
  { x: MARGIN + 400, label: "COD", width: 12 },
];

export function buildLoadsheet(input: LoadsheetInput): Buffer {
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(input.day);

  const totalPaisa = input.shipments.reduce((n, s) => n + s.codAmountPaisa, 0);
  const chunks: ShipmentWithOrder[][] = [];
  for (let i = 0; i < Math.max(1, input.shipments.length); i += ROWS_PER_PAGE) {
    chunks.push(input.shipments.slice(i, i + ROWS_PER_PAGE));
  }

  const pages: TextRun[][] = chunks.map((chunk, pageIndex) => {
    const runs: TextRun[] = [];
    let y = PAGE_HEIGHT - MARGIN;

    runs.push({ x: MARGIN, y, size: 14, text: `${input.storeName} — ${courierName(input.provider)} loadsheet`, bold: true });
    y -= 18;
    runs.push({
      x: MARGIN,
      y,
      size: 9,
      text: `${dayLabel} · ${input.shipments.length} parcel${input.shipments.length === 1 ? "" : "s"} · COD total ${formatPKR(totalPaisa)} · page ${pageIndex + 1} of ${chunks.length}`,
    });
    y -= 22;

    for (const col of COLUMNS) runs.push({ x: col.x, y, size: 9, text: col.label, bold: true });
    y -= 4;
    runs.push({ x: MARGIN, y, size: 8, text: "-".repeat(110) });
    y -= ROW_HEIGHT;

    chunk.forEach((shipment, i) => {
      const n = pageIndex * ROWS_PER_PAGE + i + 1;
      const cells = [
        String(n),
        truncate(shipment.trackingNumber, 18),
        truncate(shipment.orderNumber, 12),
        truncate(shipment.customerName, 20),
        truncate(shipment.city, 14),
        formatPKR(shipment.codAmountPaisa),
      ];
      cells.forEach((text, c) => runs.push({ x: COLUMNS[c].x, y, size: 9, text }));
      y -= ROW_HEIGHT;
    });

    if (pageIndex === chunks.length - 1) {
      y -= 10;
      runs.push({ x: MARGIN, y, size: 10, text: `Total COD to collect: ${formatPKR(totalPaisa)}`, bold: true });
      y -= 40;
      runs.push({ x: MARGIN, y, size: 9, text: "Rider name: ______________________     CNIC: ______________________" });
      y -= 24;
      runs.push({ x: MARGIN, y, size: 9, text: "Signature: _______________________     Date & time: _________________" });
    }

    return runs;
  });

  return buildPdf(pages);
}
