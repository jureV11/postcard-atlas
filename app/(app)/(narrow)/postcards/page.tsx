import Link from "next/link";
import { Flag } from "@/components/Flag";
import { GroupStats } from "@/components/GroupStats";
import { PostcardTile } from "@/components/PostcardTile";
import { formatDate } from "@/lib/dates";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { groupStats } from "@/lib/stats";
import { signPaths } from "@/lib/storage";

export default async function PostcardsPage() {
  const { supabase, member } = await requireMember();
  const { postcards, members, membersById } = await loadGroupData(supabase, member);
  const stats = groupStats(postcards, members);

  // In transit: only ever your own (nobody else learns a card is coming).
  const myOnTheWay = postcards.filter((c) => c.status === "in_transit" && c.sender_id === member.id);
  const received = postcards.filter((c) => c.status === "received");
  const fronts = await signPaths(supabase, "postcards", received.map((c) => c.front_path));

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

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Received</h2>
        {received.length === 0 ? (
          <div className="card text-center text-ink-soft">
            <p>No postcards have been revealed yet.</p>
            <p className="mt-1 text-sm">
              Cards from a trip are revealed to everyone once every one of them has arrived.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {received.map((c) => (
              <PostcardTile
                key={c.id}
                card={c}
                frontUrl={c.front_path ? (fronts.get(c.front_path) ?? null) : null}
                sender={membersById.get(c.sender_id ?? "")}
                recipient={membersById.get(c.recipient_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
