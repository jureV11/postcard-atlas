import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { formatKm } from "@/lib/geo";
import { EARTH_KM, MOON_AND_BACK_KM, type Journey, type Passport } from "@/lib/passport";
import type { MemberWithAvatar } from "@/lib/types";
import { MonthlyBars } from "./MonthlyBars";

const WORLD_COUNTRIES = 195;

/** The group's stats as a passport: a stat grid, distance in space terms, months and pen pals. */
export function GroupPassport({ passport: p, membersById }: { passport: Passport; membersById: Map<string, MemberWithAvatar> }) {
  const laps = p.totalKm / EARTH_KM;
  const moon = p.totalKm / MOON_AND_BACK_KM; // there and back (#9)

  return (
    <div className="space-y-4">
      {/* Stat grid */}
      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <div className="px-5 pt-4 pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">Postcard passport</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Our group <span className="text-stamp">· all time</span>
          </h2>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-ink/10 bg-ink/10 sm:grid-cols-3">
          <Stat
            label="Postcards"
            value={String(p.delivered)}
            sub={p.delivered ? `≈ ${Math.round(p.totalKm / p.delivered).toLocaleString("en")} km each` : "delivered"}
          />
          <Stat
            label="Kilometres"
            value={Math.round(p.totalKm).toLocaleString("en")}
            sub={laps >= 0.05 ? `${laps.toFixed(laps < 10 ? 1 : 0)}× around the Earth` : "and counting"}
          />
          <Stat
            label="Countries"
            value={String(p.countries)}
            sub={`${Math.round((p.countries / WORLD_COUNTRIES) * 100)}% of the world`}
          />
          <Stat label="Towns" value={String(p.towns)} sub="sent from" />
          <Stat label="Days in the post" value={p.avgDays === null ? "—" : p.avgDays.toFixed(1)} sub="on average" />
          <Stat label="Friends" value={String(p.members)} sub="in the group" />
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Distance, in space terms */}
        <section className="rounded-2xl border border-ink/10 bg-white/75">
          <Header title="Distance" />
          <div className="px-5 pb-4 text-center">
            <p className="text-xs text-ink-soft">Total, all postcards</p>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(p.totalKm).toLocaleString("en")}
              <span className="ml-1 font-sans text-sm font-normal text-ink-soft">km</span>
            </p>
            <div className="mt-4 flex justify-center gap-10">
              <Ring progress={laps % 1 || (laps >= 1 ? 1 : 0)} badge={`${fmtTimes(laps)}×`} label="Around the Earth">
                <Earth />
              </Ring>
              <Ring progress={Math.min(1, moon)} badge={`${fmtTimes(moon)}×`} label="To the Moon & back">
                <Moon />
              </Ring>
            </div>
          </div>
          <JourneyRow title="Longest journey" journey={p.longest} />
          <JourneyRow title="Shortest journey" journey={p.shortest} />
        </section>

        {/* Months */}
        <section className="rounded-2xl border border-ink/10 bg-white/75">
          <Header title="Postcards by month" note="last 12 months" />
          <div className="px-5 pb-5">
            <MonthlyBars months={p.months} />
          </div>
        </section>
      </div>

      {/* Pen pals */}
      {p.penPals.length > 0 && (
        <section className="rounded-2xl border border-ink/10 bg-white/75">
          <Header title="Pen pals" note="cards swapped" />
          <ol>
            {p.penPals.map((pair, i) => {
              const a = membersById.get(pair.a);
              const b = membersById.get(pair.b);
              if (!a || !b) return null;
              return (
                <li key={`${pair.a}${pair.b}`} className="flex items-center gap-3 border-t border-ink/10 px-5 py-3">
                  <span className="w-4 shrink-0 font-mono text-sm text-ink-soft tabular-nums">{i + 1}</span>
                  <span className="flex shrink-0 -space-x-2">
                    <Avatar name={a.display_name} color={a.color} url={a.avatar_url} size={32} />
                    <Avatar name={b.display_name} color={b.color} url={b.avatar_url} size={32} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.display_name} &amp; {b.display_name}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {first(a.display_name)} sent {pair.aToB} · {first(b.display_name)} sent {pair.bToA}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">{pair.total}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-2 font-mono text-2xl font-semibold leading-none tabular-nums sm:text-3xl">{value}</dd>
      <dd className="mt-1.5 truncate text-xs text-ink-soft">{sub}</dd>
    </div>
  );
}

function Header({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {note && <span className="text-xs text-ink-soft">{note}</span>}
    </div>
  );
}

function JourneyRow({ title, journey: j }: { title: string; journey: Journey | null }) {
  if (!j) return null;
  return (
    <Link
      href={`/postcards/${j.card.id}`}
      className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-3 transition hover:bg-paper/50"
    >
      <span className="min-w-0">
        <span className="block text-xs text-ink-soft">{title}</span>
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          <Flag code={j.card.from_country_code} size={14} />
          {j.card.from_city}
          <span className="text-ink-soft">→</span>
          {j.toCity}
        </span>
      </span>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{formatKm(j.km)}</span>
    </Link>
  );
}

const first = (name: string) => name.trim().split(/\s+/)[0];

function fmtTimes(x: number): string {
  if (x >= 10) return String(Math.round(x));
  if (x >= 1) return x.toFixed(1);
  return x >= 0.01 ? x.toFixed(2) : x > 0 ? "<0.01" : "0";
}

/** A planet in a progress ring, with a "1.3×" badge on the ring's bottom edge. */
function Ring({ progress, badge, label, children }: { progress: number; badge: string; label: string; children: ReactNode }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <figure className="flex flex-col items-center">
      <div className="relative size-[104px]">
        <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="52" cy="52" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3" />
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            stroke="var(--color-stamp)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${c * Math.max(0.01, progress)} ${c}`}
          />
        </svg>
        <div className="absolute inset-[12px]">{children}</div>
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
          {badge}
        </span>
      </div>
      <figcaption className="mt-4 text-xs text-ink-soft">{label}</figcaption>
    </figure>
  );
}

function Earth() {
  return (
    <svg viewBox="0 0 80 80" className="size-full" aria-hidden="true">
      <defs>
        <clipPath id="earth-clip">
          <circle cx="40" cy="40" r="40" />
        </clipPath>
      </defs>
      <g clipPath="url(#earth-clip)">
        <rect width="80" height="80" fill="#8fbcd6" />
        <path d="M8 22c6-6 15-7 20-3 4 3 2 8 7 10 5 2 4 9-1 11-6 2-7 9-12 9-6 0-6-8-10-11-5-4-9-10-4-16z" fill="#a8c49a" />
        <path d="M44 10c7-3 16 0 21 6 3 4-2 7 1 11 3 5 9 4 10 10 1 5-5 7-9 5-5-3-9 1-13-2-4-3 0-9-4-13-4-4-12-3-12-8 0-4 3-7 6-9z" fill="#a8c49a" />
        <path d="M40 54c5-2 10 1 11 6 1 6-4 13-9 13-4 0-4-6-6-10-2-4 0-8 4-9z" fill="#a8c49a" />
        <ellipse cx="40" cy="78" rx="30" ry="6" fill="#eef3f5" opacity="0.8" />
        <circle cx="40" cy="40" r="40" fill="none" stroke="#2a2622" strokeOpacity="0.12" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 80 80" className="size-full" aria-hidden="true">
      <circle cx="40" cy="40" r="40" fill="#e3ddd0" />
      <circle cx="27" cy="27" r="8" fill="#d2c9b7" />
      <circle cx="52" cy="22" r="4.5" fill="#d2c9b7" />
      <circle cx="55" cy="48" r="10" fill="#d2c9b7" />
      <circle cx="30" cy="56" r="5" fill="#d2c9b7" />
      <circle cx="45" cy="66" r="3" fill="#d2c9b7" />
      <circle cx="16" cy="44" r="3.5" fill="#d2c9b7" />
      <circle cx="40" cy="40" r="40" fill="none" stroke="#2a2622" strokeOpacity="0.12" strokeWidth="1.5" />
    </svg>
  );
}
