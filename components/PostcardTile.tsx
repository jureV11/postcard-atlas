import Link from "next/link";
import { Flag } from "@/components/Flag";
import { MysteryGlobe } from "@/components/Mystery";
import { formatDate } from "@/lib/dates";
import type { MemberWithAvatar, Postcard } from "@/lib/types";

/** Grid tile for a postcard: front image, a placeholder, or a sealed mystery card. */
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
      className="group block overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[3/2] bg-paper-deep">
        {frontUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frontUrl} alt={`Postcard from ${card.from_city}`} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-ink-soft">
            {cc ? <Flag code={cc} size={28} /> : <MysteryGlobe size={30} />}
            <span className="text-xs">{card.revealed ? "No photo yet" : "Sealed until it arrives"}</span>
          </div>
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
      <div className="space-y-0.5 p-2.5">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {cc ? <Flag code={cc} size={14} /> : <MysteryGlobe size={14} />}
          {card.from_city ?? "Somewhere in the world"}
        </p>
        <p className="truncate text-xs text-ink-soft">
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
