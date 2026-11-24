/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** For text placed inside HTML strings (e.g. globe tooltips) — names are user input. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * **bold** and *italic* in written text (#56): on one line, and only when the stars hug
 * the words, so "5 * 3 * 2" stays as it is. Shown by `components/Linkify.tsx`.
 */
export const TEXT_STYLE = /\*\*(?=\S)([^\n]*?\S)\*\*|\*(?=[^\s*])([^*\n]*?[^\s*])\*/g;

/** Written text without its bold and italic stars, for short previews. */
export function plainText(s: string): string {
  return s.replace(TEXT_STYLE, (_, bold, italic) => plainText(bold ?? italic));
}

/** Pull a readable message from errors that are not `Error` instances. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return "Something went wrong";
}

/** 1234 → "1.2k", 56789 → "57k", 2100000 → "2.1M". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** For searching: ignore accents and case, so "reykjavik" finds "Reykjavík". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
