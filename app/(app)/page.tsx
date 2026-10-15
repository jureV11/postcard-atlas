import Link from "next/link";
import { AddressesPanel } from "@/components/atlas/AddressesPanel";
import { Atlas } from "@/components/atlas/Atlas";
import { loadAddresses, loadMyAddressesInUse } from "@/lib/addresses";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import type { MapCard } from "@/lib/atlas";
import { formatDate } from "@/lib/dates";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { computeStats, groupCountries, rankMembers } from "@/lib/stats";
import { signPaths } from "@/lib/storage";
import { isLocated } from "@/lib/types";

const WORLD_COUNTRIES = 195;

export default async function MapPage() {
  const { supabase, member } = await requireMember();
  const [{ postcards, members, membersById }, addresses, addressesInUse] = await Promise.all([
    loadGroupData(supabase, member),
    loadAddresses(supabase),
    loadMyAddressesInUse(supabase),
  ]);

  // Hidden cards have null paths, so only revealed images get signed.
  const urls = await signPaths(supabase, "postcards", postcards.flatMap((c) => [c.front_path, c.back_path]));
  const cards: MapCard[] = postcards.map((c) => ({
    ...c,
    front_url: c.front_path ? (urls.get(c.front_path) ?? null) : null,
    back_url: c.back_path ? (urls.get(c.back_path) ?? null) : null,
  }));

  // No "a postcard is on its way" hints anywhere: the surprise is part of the fun.
  const countries = groupCountries(postcards);
  const ranking = rankMembers(members, computeStats(members, postcards));
  const topCountries = Math.max(1, ...ranking.map((r) => r.stats.countries.length));
  const recent = cards
    .filter((c) => c.status === "received" && c.is_public)
    .filter(isLocated)
    .sort((a, b) => (b.received_on ?? "").localeCompare(a.received_on ?? ""))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Atlas</h1>
        <Link href="/postcards/new" className="btn hidden shrink-0 sm:inline-flex">
          <span aria-hidden="true">＋</span> Log a postcard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_300px]">
        <div className="lg:pt-11">
          <AddressesPanel members={members} addresses={addresses} meId={member.id} inUse={addressesInUse} />
        </div>

        <Atlas cards={cards} members={members} />

        <aside className="space-y-4 lg:pt-11">
          {/* Countries tracker */}
          <section className="card space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Countries reached</h2>
              <span className="text-xs text-ink-soft">of {WORLD_COUNTRIES}</span>
            </div>
            <p className="font-display text-5xl font-semibold leading-none tabular-nums">{countries.length}</p>
            <div className="h-2 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={countries.length} aria-valuemax={WORLD_COUNTRIES}>
              <div
                className="h-full rounded-full bg-stamp"
                style={{ width: `${Math.max(countries.length ? 2 : 0, (countries.length / WORLD_COUNTRIES) * 100)}%` }}
              />
            </div>
            {countries.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {countries.map((c) => (
                  <li key={c.code} title={`${c.name}${c.count > 1 ? ` · ${c.count} cards` : ""}`}>
                    <Flag code={c.code} size={20} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Countries light up here as postcards arrive.</p>
            )}
          </section>

          {/* Mini leaderboard */}
          <section className="card space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Leaderboard</h2>
              <Link href="/leaderboard" className="text-xs font-medium text-stamp hover:underline">
                See all
              </Link>
            </div>
            <ol className="space-y-2.5">
              {ranking.map(({ member: m, stats, rank }) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex items-center gap-2.5 rounded-lg hover:bg-paper/60">
                    <span className="w-4 text-center text-sm font-semibold text-ink-soft tabular-nums">{rank}</span>
                    <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{m.display_name}</span>
                        <span className="shrink-0 tabular-nums">
                          <strong>{stats.countries.length}</strong>
                          <span className="text-xs text-ink-soft"> {stats.countries.length === 1 ? "country" : "countries"}</span>
                        </span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper-deep">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(stats.countries.length / topCountries) * 100}%`, background: m.color }}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Latest arrivals */}
          {recent.length > 0 && (
            <section className="card space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Latest arrivals</h2>
              <ul className="space-y-2">
                {recent.map((c) => {
                  const s = membersById.get(c.sender_id);
                  const r = membersById.get(c.recipient_id);
                  return (
                    <li key={c.id}>
                      <Link href={`/postcards/${c.id}`} className="flex items-center gap-2.5 rounded-lg hover:bg-paper/60">
                        <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-deep">
                          {c.front_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.front_url} alt="" className="size-full object-cover" />
                          ) : (
                            <Flag code={c.from_country_code} size={20} />
                          )}
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="flex items-center gap-1.5 truncate font-medium">
                            <Flag code={c.from_country_code} size={14} />
                            {c.from_city}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            <span style={{ color: s?.color }}>{s?.display_name}</span> →{" "}
                            <span style={{ color: r?.color }}>{r?.display_name}</span>
                            {c.received_on && ` · ${formatDate(c.received_on)}`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
