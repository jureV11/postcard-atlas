import { Fragment } from "react";
import { TEXT_STYLE } from "@/lib/utils";

// [text](https://…), or a bare https://… / www.… link. Only web links, never javascript: and the like.
const LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"])/gi;

/** Bold and italic inside a stretch of plain text. */
function styled(text: string, key: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TEXT_STYLE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      m[1] !== undefined ? (
        <strong key={`${key}-${start}`} className="font-semibold">
          {styled(m[1], `${key}-${start}`)}
        </strong>
      ) : (
        <em key={`${key}-${start}`}>{m[2]}</em>
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Text with its links made clickable (they open in a new tab), and **bold** and *italic* shown. */
export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(...styled(text.slice(last, start), `t${last}`));
    const href = m[2] ?? (m[3].toLowerCase().startsWith("www.") ? `https://${m[3]}` : m[3]);
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-medium text-stamp underline underline-offset-2 break-words hover:text-ink"
      >
        {m[1] ?? m[3]}
      </a>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(...styled(text.slice(last), `t${last}`));
  return <Fragment>{parts}</Fragment>;
}
