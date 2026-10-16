import Link from "next/link";
import type { CSSProperties } from "react";
import { Flag } from "@/components/Flag";
import { MysteryGlobe } from "@/components/Mystery";
import { formatDate } from "@/lib/dates";
import type { MemberWithAvatar, Postcard } from "@/lib/types";

/** A small, steady tilt per card (from its id), so the grid looks like prints laid on a table. */
function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.6; // -1.8° … 1.8°
}

/** A postcard as a photo print: white border, a flag stamp in the corner, a handwritten caption. */
export function PostcardTile({
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
  return (
    <Link
      href={`/postcards/${card.id}`}
      style={{ "--tilt": `${tiltOf(card.id)}deg` } as CSSProperties}
      className="group block rotate-[var(--tilt)] rounded-[3px] bg-white p-1.5 pb-0 shadow-[0_1px_2px_rgb(42_38_34/0.12),0_10px_24px_-14px_rgb(42_38_34/0.45)] transition duration-200 hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_2px_4px_rgb(42_38_34/0.12),0_18px_32px_-14px_rgb(42_38_34/0.5)] focus-visible:rotate-0"
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-[2px] bg-paper-deep">
        {frontUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frontUrl}
            alt={`Postcard from ${card.from_city}`}
            className={`size-full object-cover ${card.status === "lost" ? "grayscale" : ""}`}
            loading="lazy"
          />
        ) : (
          <div className="paper flex size-full flex-col items-center justify-center gap-1 text-ink-soft">
            {cc ? <Flag code={cc} size={28} /> : <MysteryGlobe size={30} />}
            <span className="font-hand text-lg leading-none">
              {card.status === "lost" ? "never arrived" : card.revealed ? "photo coming soon" : "sealed until it arrives"}
            </span>
          </div>
        )}
        {cc && frontUrl && (
          // The country as a tiny perforated stamp in the corner
          <span className="absolute right-1.5 top-1.5 rotate-6 rounded-[1px] bg-white p-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.3)] outline outline-1 outline-dashed outline-offset-[-2px] outline-ink/20">
            <Flag code={cc} size={18} />
          </span>
        )}
        {card.status === "lost" && (
          <span className="absolute inset-0 flex items-center justify-center bg-paper/55">
            <span className="date-stamp bg-white/70 !text-sm">Lost</span>
          </span>
        )}
        {card.status === "in_transit" && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-medium text-paper">
            In transit
          </span>
        )}
        {card.status === "received" && !card.is_public && (
          <span
            className="absolute inset-x-2 bottom-2 rounded-full bg-ink/75 px-2 py-0.5 text-center text-[11px] font-medium text-paper"
            title="The rest of this trip's postcards haven't all arrived yet"
          >
            Only you can see this for now
          </span>
        )}
      </div>
      <div className="px-1 pb-2 pt-1.5">
        <p className="flex items-center gap-1.5 truncate font-hand text-[1.3rem] leading-tight">
          {!frontUrl && (cc ? <Flag code={cc} size={13} /> : <MysteryGlobe size={13} />)}
          {card.from_city ?? "Somewhere in the world"}
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
