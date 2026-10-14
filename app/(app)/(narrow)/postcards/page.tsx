import Link from "next/link";
import { Flag } from "@/components/Flag";
import { GroupStats } from "@/components/GroupStats";
import { PostcardTile } from "@/components/PostcardTile";
import { formatDate } from "@/lib/dates";
import { groupByMonth, loadGroupData, type SortOrder } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { groupStats } from "@/lib/stats";
import { signPaths } from "@/lib/storage";

export default async function PostcardsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort: SortOrder = (await searchParams).sort === "oldest" ? "oldest" : "newest";
  const { supabase, member } = await requireMember();
  const { postcards, members, membersById } = await loadGroupData(supabase, member);
  const stats = groupStats(postcards, members);

  // In transit: only ever your own (nobody else learns a card is coming).
  const myOnTheWay = postcards.filter((c) => c.status === "in_transit" && c.sender_id === member.id);
  const received = postcards.filter((c) => c.status === "received");
  const fronts = await signPaths(supabase, "postcards", received.map((c) => c.front_path));
  const months = groupByMonth(received, sort);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Postcards</h1>
          <p className="mt-1 text-ink-soft">{received.filter((c) => c.is_public).length} delivered and revealed</p>
        </div>
        <div className="flex gap-2">
          <Link href="/postcards/arrived" className="btn-ghost shrink-0">
            ✉ A postcard arrived!
          </Link>
          <Link href="/postcards/new" className="btn shrink-0">
            <span aria-hidden="true">＋</span> Log a postcard
          </Link>
        </div>
      </div>

      <GroupStats stats={stats} membersById={membersById} />

      {myOnTheWay.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Your postcards on the way</h2>
            <p className="text-sm text-ink-soft">Only you can see these — nobody else knows they&apos;re coming.</p>
          </div>
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/75">
            {myOnTheWay.map((c) => {
              const recipient = membersById.get(c.recipient_id);
              return (
                <li key={c.id}>
                  <Link href={`/postcards/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper/60">
                    {c.from_country_code && <Flag code={c.from_country_code} size={20} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
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
          months.map((g) => (
            <div key={g.key} className="space-y-3">
              <h3 className="flex items-baseline gap-2 border-b border-ink/10 pb-1.5 font-display text-lg font-semibold">
                {g.label}
                <span className="font-sans text-xs font-normal text-ink-soft">
                  {g.cards.length} {g.cards.length === 1 ? "postcard" : "postcards"} sent
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.cards.map((c) => (
                  <PostcardTile
                    key={c.id}
                    card={c}
                    frontUrl={c.front_path ? (fronts.get(c.front_path) ?? null) : null}
                    sender={membersById.get(c.sender_id ?? "")}
                    recipient={membersById.get(c.recipient_id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
