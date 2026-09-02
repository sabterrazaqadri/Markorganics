/**
 * Minimal, safe rich text.
 *
 * The editor stores Markdown-ish plain text and this renders headings, lists,
 * links, bold and italics. Everything is escaped first, so nothing an editor
 * pastes can inject markup. No "server-only" here: the admin preview renders
 * the same function in the browser, and both must agree exactly.
 */
export function renderRichText(source: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g, (_m, text, href) => {
        const external = String(href).startsWith("http");
        const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${href}"${rel}>${text}</a>`;
      });

  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      out.push(`<ul>${listBuffer.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join("\n");
}

/** Same function, named for the admin preview so the intent is obvious. */
export const renderRichTextClient = renderRichText;

/** Strips markup for excerpts and meta descriptions. */
export function toPlainText(source: string, max = 180): string {
  const plain = source
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
