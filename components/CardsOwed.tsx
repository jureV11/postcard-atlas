import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { CardBalance } from "@/lib/owe";
import type { MemberWithAvatar } from "@/lib/types";

const cards = (n: number) => (n === 1 ? "a card" : `${n} cards`);

/** "Your turn to write": the friends you owe a card, and who owes you one. Nothing when you're all square. */
export function CardsOwed({
  owe,
  owed,
  className = "",
}: {
  owe: CardBalance<MemberWithAvatar>[];
  owed: CardBalance<MemberWithAvatar>[];
  className?: string;
}) {
  if (!owe.length && !owed.length) return null;
  return (
    <section className={`card space-y-3 ${className}`}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">{owe.length ? "Your turn to write" : "Cards owed to you"}</h2>
      {owe.length > 0 && (
        <ul className="space-y-2.5">
          {owe.map(({ member: m, theySent, youSent }) => (
            <li key={m.id} className="flex items-center gap-2.5">
              <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={28} />
              <span className="min-w-0 flex-1 text-sm leading-tight">
                <span className="block truncate">
                  You owe <strong style={{ color: m.color }}>{m.display_name}</strong> {cards(theySent - youSent)}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  They sent {theySent}, you sent {youSent}
                </span>
              </span>
              <Link href={`/postcards/new?to=${m.id}`} className="shrink-0 text-xs font-medium text-stamp hover:underline">
                Log one →
              </Link>
            </li>
          ))}
        </ul>
      )}
      {owed.length > 0 && (
        <p className={`text-sm text-ink-soft ${owe.length ? "border-t border-ink/10 pt-2.5" : ""}`}>
          {owed.map(({ member: m, theySent, youSent }, i) => (
            <span key={m.id}>
              {i > 0 && " · "}
              <span className="font-medium" style={{ color: m.color }}>
                {m.display_name}
              </span>{" "}
              owes you {cards(youSent - theySent)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

/** On a friend's profile: where the two of you stand. */
export function CardBalanceLine({ balance }: { balance: CardBalance<MemberWithAvatar> }) {
  const { member: m, theySent, youSent } = balance;
  const name = m.display_name;
  if (!theySent && !youSent) return null;
  const diff = theySent - youSent;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-paper-deep px-4 py-3 text-sm">
      <span className="min-w-[14rem] flex-1">
        {diff > 0 ? (
          <>
            <strong>You owe {name} {cards(diff)}.</strong>{" "}
          </>
        ) : diff < 0 ? (
          <>
            <strong>{name} owes you {cards(-diff)}.</strong>{" "}
          </>
        ) : (
          <>
            <strong>All square.</strong>{" "}
          </>
        )}
        <span className="text-ink-soft">
          {name} sent you {theySent}, you sent {youSent}.
        </span>
      </span>
      {diff >= 0 && (
        <Link href={`/postcards/new?to=${m.id}`} className="shrink-0 font-medium text-stamp hover:underline">
          Log a card to {name} →
        </Link>
      )}
    </p>
  );
}
