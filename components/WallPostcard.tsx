import Link from "next/link";
import type { CSSProperties } from "react";
import { Flag } from "@/components/Flag";
import { MysteryGlobe } from "@/components/Mystery";
import { formatDate } from "@/lib/dates";
import type { MemberWithAvatar, Postcard } from "@/lib/types";

/** A small, steady tilt per card (from its id), like prints pinned to a wall. */
function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.5; // -1.5° … 1.5°
}

/**
 * A postcard on the wall: the photo on the front, and on devices that can
 * hover (or when focused with the keyboard) it turns over to show its back —
 * the message, a postmark, the stamp and who it was for.
 */
export function WallPostcard({
  card,
  frontUrl,
  sender,
  recipient,
}: {
  card: Postcard;
  frontUrl: string | null;
  sender?: MemberWithAvatar;
  recipient?: MemberWithAvatar;
}) {
  const cc = card.from_country_code;
  const lost = card.status === "lost";
  const city = card.from_city ?? "Somewhere in the world";
  return (
    <Link
      href={`/postcards/${card.id}`}
      style={{ "--tilt": `${tiltOf(card.id)}deg` } as CSSProperties}
      className="group block rotate-[var(--tilt)] transition duration-300 hover:z-10 hover:rotate-0 focus-visible:rotate-0 focus-visible:outline-none"
      aria-label={`Postcard from ${city}${sender ? `, ${sender.display_name} to ${recipient?.display_name ?? "?"}` : ""}`}
    >
      <div className="[perspective:1400px]">
        <div className="relative aspect-[3/2] transition-transform duration-500 ease-[cubic-bezier(.3,.7,.2,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)] motion-reduce:duration-0">
          {/* Front: the photo as a print */}
          <div className="absolute inset-0 rounded-[3px] bg-white p-1.5 shadow-[0_1px_2px_rgb(42_38_34/0.12),0_14px_28px_-16px_rgb(42_38_34/0.5)] [backface-visibility:hidden]">
            <div className="relative size-full overflow-hidden rounded-[2px] bg-paper-deep">
              {frontUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frontUrl}
                  alt=""
                  className={`size-full object-cover ${lost ? "grayscale" : ""}`}
                  loading="lazy"
                />
              ) : (
                <div className="paper flex size-full flex-col items-center justify-center gap-1 text-ink-soft">
                  {cc ? <Flag code={cc} size={28} /> : <MysteryGlobe size={30} />}
                  <span className="font-hand text-lg leading-none">{lost ? "never arrived" : "photo coming soon"}</span>
                </div>
              )}
              {cc && frontUrl && (
                <span className="absolute right-1.5 top-1.5 rotate-6 rounded-[1px] bg-white p-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.3)] outline outline-1 outline-dashed outline-offset-[-2px] outline-ink/20">
                  <Flag code={cc} size={18} />
                </span>
              )}
              {lost && (
                <span className="absolute inset-0 flex items-center justify-center bg-paper/50">
                  <span className="date-stamp bg-white/70 !text-sm">Lost</span>
                </span>
              )}
              {card.status === "received" && !card.is_public && (
                <span className="absolute inset-x-2 bottom-2 rounded-full bg-ink/75 px-2 py-0.5 text-center text-[11px] font-medium text-paper">
                  Only you can see this for now
                </span>
              )}
            </div>
          </div>

          {/* Back: message, postmark, stamp, address */}
          <div className="paper absolute inset-0 grid grid-cols-[1fr_1px_1fr] gap-2 rounded-[3px] border border-ink/10 p-2.5 shadow-[0_14px_28px_-16px_rgb(42_38_34/0.5)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="line-clamp-5 font-hand text-[15px] leading-[1.15] text-ink/80">
              {card.message ? card.message : <span className="text-ink-soft">No message written down.</span>}
            </p>
            <span className="bg-ink/15" aria-hidden="true" />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-1">
                {/* Postmark */}
                <span className="flex size-11 shrink-0 -rotate-12 flex-col items-center justify-center rounded-full border-[1.5px] border-[#24345e]/70 text-center font-mono text-[6.5px] font-bold uppercase leading-tight text-[#24345e]/80">
                  {card.hand_delivered ? (
                    <>
                      <span>By</span>
                      <span>hand</span>
                    </>
                  ) : (
                    <>
                      <span className="max-w-[38px] truncate">{city}</span>
                      <span>{card.sent_on.slice(0, 4)}</span>
                    </>
                  )}
                </span>
                {cc && (
                  <span className="rotate-3 bg-white p-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.25)] outline outline-1 outline-dashed outline-offset-[-2px] outline-ink/20">
                    <Flag code={cc} size={20} />
                  </span>
                )}
              </div>
              <div className="mt-auto space-y-0.5 text-[11px] leading-tight">
                <p className="truncate border-b border-ink/20 pb-0.5 font-hand text-[15px]">
                  To <span style={{ color: recipient?.color }}>{recipient?.display_name ?? "?"}</span>
                </p>
                <p className="truncate border-b border-ink/20 pb-0.5 text-ink-soft">
                  from <span style={{ color: sender?.color }}>{sender?.display_name ?? "?"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption (always there — phones can't hover) */}
      <div className="mt-2 px-0.5">
        <p className="flex items-center gap-1.5 truncate font-hand text-[1.35rem] leading-tight">
          {!frontUrl && cc && <Flag code={cc} size={13} />}
          {city}
        </p>
        <p className="truncate text-[11px] text-ink-soft">
          <span style={{ color: sender?.color }}>{sender?.display_name ?? "?"}</span>
          {" → "}
          <span style={{ color: recipient?.color }}>{recipient?.display_name ?? "?"}</span>
          {" · "}
          {formatDate(card.sent_on)}
        </p>
      </div>
    </Link>
  );
}
