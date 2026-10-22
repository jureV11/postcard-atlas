import Link from "next/link";
import { Flag } from "@/components/Flag";
import { PostcardsHero } from "@/components/PostcardsHero";
import { WallPostcard } from "@/components/WallPostcard";
import { PostcardsBrowser, type BrowserGroup } from "@/components/PostcardsBrowser";
import { formatDate, monthName } from "@/lib/dates";
import { groupByMonth, loadGroupData, type SortOrder } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { groupCountries, groupStats } from "@/lib/stats";
import { signPaths } from "@/lib/storage";
import { fold } from "@/lib/utils";

export default async function PostcardsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort: SortOrder = (await searchParams).sort === "oldest" ? "oldest" : "newest";
  const { supabase, member } = await requireMember();
  const { postcards, members, membersById } = await loadGroupData(supabase, member);
  const stats = groupStats(postcards, members);

  // In transit: only ever your own (nobody else learns a card is coming).
  const myOnTheWay = postcards.filter((c) => c.status === "in_transit" && c.sender_id === member.id);
  const received = postcards.filter((c) => c.status === "received");
  const lostCards = postcards.filter((c) => c.status === "lost");
  const fronts = await signPaths(supabase, "postcards", [...received, ...lostCards].map((c) => c.front_path));
  const months = groupByMonth(received, sort);
  // Everything a card can be searched by — only what this viewer can already see.
  const groups: BrowserGroup[] = months.map((g) => ({
    key: g.key,
    items: g.cards.map((c) => {
      const sender = membersById.get(c.sender_id ?? "");
      const recipient = membersById.get(c.recipient_id);
      return {
        card: c,
        frontUrl: c.front_path ? (fronts.get(c.front_path) ?? null) : null,
        sender,
        recipient,
        search: fold(
          [
            c.from_city,
            c.from_country,
            c.from_country_code,
            sender?.display_name,
            recipient?.display_name,
            monthName(c.sent_on),
            c.sent_on.slice(0, 4),
            c.message,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      };
    }),
  }));

  return (
    <div className="space-y-8">
      <PostcardsHero stats={stats} countries={groupCountries(postcards).length} membersById={membersById} />

      {myOnTheWay.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Your postcards on the way</h2>
            <p className="text-sm text-ink-soft">Only you can see these — nobody else knows they&apos;re coming.</p>
          </div>
          <div className="airmail">
          <ul className="paper divide-y divide-ink/10 overflow-hidden">
            {myOnTheWay.map((c) => {
              const recipient = membersById.get(c.recipient_id);
              return (
                <li key={c.id}>
                  <Link href={`/postcards/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper/60">
                    {c.from_country_code && <Flag code={c.from_country_code} size={20} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-hand text-xl leading-tight">
                        To <span style={{ color: recipient?.color }}>{recipient?.display_name}</span>
                      </span>
                      <span className="block truncate text-xs text-ink-soft">
                        From {c.from_city}, {c.from_country} · posted {formatDate(c.sent_on)}
                      </span>
                    </span>
                    <span className="text-xs text-ink-soft">View →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Received</h2>
          {received.length > 1 && (
            <nav aria-label="Sort postcards" className="flex rounded-full border border-ink/10 bg-white/70 p-0.5 text-sm font-medium">
              {(["newest", "oldest"] as const).map((s) => (
                <Link
                  key={s}
                  href={s === "newest" ? "/postcards" : "/postcards?sort=oldest"}
                  aria-current={sort === s ? "true" : undefined}
                  scroll={false}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    sort === s ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {s === "newest" ? "Newest first" : "Oldest first"}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {received.length === 0 ? (
          <div className="card text-center text-ink-soft">
            <p>No postcards have been revealed yet.</p>
            <p className="mt-1 text-sm">
              Cards from a trip are revealed to everyone once every one of them has arrived.
            </p>
          </div>
        ) : (
          <PostcardsBrowser groups={groups} total={received.length} />
        )}
      </section>

      {lostCards.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold">Lost in the post</h2>
            <span className="font-hand text-xl text-ink-soft">
              {lostCards.length} {lostCards.length === 1 ? "card" : "cards"} that never made it
            </span>
            <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
            {lostCards.map((c) => (
              <WallPostcard
                key={c.id}
                card={c}
                frontUrl={c.front_path ? (fronts.get(c.front_path) ?? null) : null}
                sender={membersById.get(c.sender_id ?? "")}
                recipient={membersById.get(c.recipient_id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
