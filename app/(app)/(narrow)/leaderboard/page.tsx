import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { formatKm } from "@/lib/geo";
import { nicheLeaders, nicheScores, type NicheScore } from "@/lib/niche";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { computeStats, rankMembers } from "@/lib/stats";
import type { MemberWithAvatar } from "@/lib/types";

const MEDALS: Record<number, string> = { 1: "#d4a017", 2: "#9aa3a8", 3: "#b07a4a" };
const MAX_FLAGS = 10;

export default async function LeaderboardPage() {
  const { supabase, member: me } = await requireMember();
  const { postcards, members } = await loadGroupData(supabase, me);
  const stats = computeStats(members, postcards);
  const ranking = rankMembers(members, stats);
  const niche = nicheLeaders(members, await nicheScores(postcards, members));

  const byKm = [...ranking].sort((a, b) => b.stats.postcardKm - a.stats.postcardKm);
  const nicheByMember = new Map(niche.map((n) => [n.member.id, n.best]));

  const topCountries = ranking[0];
  const topKm = byKm[0];
  const topNiche = niche[0];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-ink-soft">Three ways to win. Cards only count once they&apos;ve arrived.</p>
      </div>

      {/* Category winners */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Champion
          title="Most countries"
          member={topCountries?.stats.countries.length ? topCountries.member : null}
          value={topCountries ? `${topCountries.stats.countries.length} countries` : ""}
        />
        <Champion
          title="Farthest travelled"
          member={topKm?.stats.postcardKm ? topKm.member : null}
          value={topKm ? `${Math.round(topKm.stats.postcardKm).toLocaleString("en")} km` : ""}
        />
        <Champion
          title="Most niche postcard"
          member={topNiche?.best ? topNiche.member : null}
          value={topNiche?.best ? `${topNiche.best.card.from_city} · ${topNiche.best.score}/100` : ""}
        />
      </section>

      {/* Main ranking: countries */}
      <section className="space-y-3">
        <SectionTitle title="Countries" subtitle="The main event — how many countries you've sent postcards from." />
        <ol className="space-y-3">
          {ranking.map(({ member: m, stats: s, rank }) => {
            const extraFlags = s.countries.length - MAX_FLAGS;
            const best = nicheByMember.get(m.id);
            return (
              <li key={m.id}>
                <Link
                  href={`/members/${m.id}`}
                  className={`block rounded-2xl border bg-white/75 p-3 transition hover:bg-white sm:p-4 ${
                    m.id === me.id ? "border-ink/30" : "border-ink/10"
                  }`}
                >
                  <span className="flex items-center gap-3 sm:gap-4">
                    <RankBadge rank={rank} />
                    <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {m.display_name}
                        {m.id === me.id && <span className="ml-1.5 text-xs font-normal text-ink-soft">(you)</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {s.countries.slice(0, MAX_FLAGS).map((c) => (
                          <span key={c.code} title={c.name}>
                            <Flag code={c.code} size={16} />
                          </span>
                        ))}
                        {extraFlags > 0 && <span className="text-xs text-ink-soft">+{extraFlags}</span>}
                        {s.countries.length === 0 && <span className="text-xs text-ink-soft">No cards delivered yet</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-3xl font-semibold leading-none tabular-nums">
                        {s.countries.length}
                      </span>
                      <span className="text-xs text-ink-soft">{s.countries.length === 1 ? "country" : "countries"}</span>
                    </span>
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-center">
                    <MiniStat label="km travelled" value={Math.round(s.postcardKm).toLocaleString("en")} />
                    <MiniStat label="cards delivered" value={String(s.arrived.length)} />
                    <MiniStat label="niche score" value={best ? String(best.score) : "—"} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-ink-soft">Ties are broken by km travelled, then cards delivered.</p>
      </section>

      {/* Distance */}
      <section className="space-y-3">
        <SectionTitle
          title="Kilometres travelled"
          subtitle="Straight-line distance from where each card was posted to the recipient's home, added up."
        />
        <ol className="overflow-hidden rounded-2xl border border-ink/10 bg-white/75">
          {byKm.map(({ member: m, stats: s }, i) => (
            <li key={m.id} className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-b-0">
              <RankBadge rank={s.postcardKm > 0 ? i + 1 : 0} small />
              <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.display_name}</span>
                {s.farthest && (
                  <span className="block truncate text-xs text-ink-soft">
                    Farthest: {s.farthest.card.from_city} · {formatKm(s.farthest.km)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right font-display text-xl font-semibold tabular-nums">
                {Math.round(s.postcardKm).toLocaleString("en")}
                <span className="ml-1 font-sans text-xs font-normal text-ink-soft">km</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Nicheness */}
      <section className="space-y-3">
        <SectionTitle
          title="Most niche postcard"
          subtitle="Everyone's single most off-the-beaten-path card, scored out of 100."
        />
        <ol className="space-y-2">
          {niche.map(({ member: m, best }, i) => (
            <li key={m.id}>
              {best ? (
                <Link
                  href={`/postcards/${best.card.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/75 px-4 py-3 transition hover:bg-white"
                >
                  <RankBadge rank={i + 1} small />
                  <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <Flag code={best.card.from_country_code} size={14} />
                      {best.card.from_city}, {best.card.from_country}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{m.display_name} · {nicheReason(best)}</span>
                  </span>
                  <NicheBadge score={best.score} />
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-ink-soft">
                  <RankBadge rank={0} small />
                  <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={32} />
                  <span className="flex-1 text-sm">{m.display_name} · no cards delivered yet</span>
                </div>
              )}
            </li>
          ))}
        </ol>
        <details className="rounded-xl bg-paper-deep/60 px-4 py-3 text-sm text-ink-soft">
          <summary className="cursor-pointer font-medium text-ink">How is nicheness scored?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-ink">Small place — up to 40.</strong> Villages beat capitals: a town of ~10,000 scores
              about 24, a city of a million about 8.
            </li>
            <li>
              <strong className="text-ink">Rare country — up to 30.</strong> Full points if it&apos;s the group&apos;s only card
              from that country, half if there are two, and so on.
            </li>
            <li>
              <strong className="text-ink">Far from home — up to 30.</strong> Distance to the nearest member&apos;s home city;
              8,000 km or more scores full.
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}

function nicheReason(s: NicheScore): string {
  const bits: string[] = [];
  if (s.population !== null) bits.push(`~${formatPopulation(s.population)} people`);
  bits.push(s.countryCards === 1 ? `only card from ${s.card.from_country}` : `${s.countryCards} cards from ${s.card.from_country}`);
  bits.push(`${formatKm(s.nearestHomeKm)} from the nearest home`);
  return bits.join(" · ");
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-sm text-ink-soft">{subtitle}</p>
    </div>
  );
}

function RankBadge({ rank, small }: { rank: number; small?: boolean }) {
  const medal = MEDALS[rank];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${
        small ? "size-7 text-sm" : "size-9 text-lg"
      }`}
      style={medal ? { background: medal, color: "#fff" } : { color: "var(--color-ink-soft)" }}
    >
      {rank || "–"}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="block font-semibold tabular-nums">{value}</span>
      <span className="block text-[11px] text-ink-soft">{label}</span>
    </span>
  );
}

function NicheBadge({ score }: { score: number }) {
  return (
    <span className="flex shrink-0 flex-col items-center rounded-xl bg-ink px-2.5 py-1 text-paper">
      <span className="font-display text-lg font-semibold leading-tight tabular-nums">{score}</span>
      <span className="text-[10px] leading-tight text-paper/70">/ 100</span>
    </span>
  );
}

function Champion({ title, member, value }: { title: string; member: MemberWithAvatar | null; value: string }) {
  return (
    <div className="card flex items-center gap-3">
      {member ? (
        <>
          <Avatar name={member.display_name} color={member.color} url={member.avatar_url} size={44} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</p>
            <p className="truncate font-display text-lg font-semibold">{member.display_name}</p>
            <p className="truncate text-sm text-ink-soft">{value}</p>
          </div>
        </>
      ) : (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</p>
          <p className="text-sm text-ink-soft">Up for grabs</p>
        </div>
      )}
    </div>
  );
}
