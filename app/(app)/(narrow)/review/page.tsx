import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { StatTile } from "@/components/StatTile";
import { formatDate } from "@/lib/dates";
import { formatKm } from "@/lib/geo";
import { meetupDates } from "@/lib/meetups";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import type { LocatedPostcard, MemberWithAvatar } from "@/lib/types";
import { reviewYears, yearReview, type ReviewMeetup } from "@/lib/yearReview";

const EARTH_KM = 40_075;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function YearInReviewPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { supabase, member } = await requireMember();
  const [{ postcards, members, membersById }, { data: group }, { data: meetupRows }] = await Promise.all([
    loadGroupData(supabase, member),
    supabase.from("groups").select("name").eq("id", member.group_id).single(),
    supabase.from("meetups").select("id, title, starts_on, ends_on, city, country, country_code, lat, lng, stops, meetup_members(member_id)"),
  ]);
  const meetups: ReviewMeetup[] = ((meetupRows ?? []) as (Omit<ReviewMeetup, "memberIds"> & { meetup_members: { member_id: string }[] })[]).map(
    ({ meetup_members, ...m }) => ({ ...m, memberIds: meetup_members.map((x) => x.member_id) }),
  );

  const thisYear = new Date().getFullYear();
  const years = reviewYears(postcards, meetups, thisYear);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : thisYear;
  const r = yearReview(year, postcards, members, meetups);
  const empty = r.cards.length === 0 && r.meetups.length === 0;
  const name = (id: string | null) => (id ? membersById.get(id) : undefined);
  const peak = Math.max(1, ...r.byMonth);
  // One card can be the farthest and the fastest too: show it once
  const fastest = r.fastest && r.fastest.card.id !== r.farthest?.card.id ? r.fastest : null;
  const slowest = r.slowest && r.slowest.card.id !== r.farthest?.card.id ? r.slowest : null;

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Link href="/leaderboard" className="text-sm text-ink-soft hover:text-ink">
          ← Leaderboard
        </Link>
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{year} in review</h1>
          {group?.name && <p className="font-hand text-2xl leading-tight text-ink-soft">{group.name}</p>}
        </div>
        {years.length > 1 && (
          <nav className="flex flex-wrap gap-1.5" aria-label="Other years">
            {years.map((y) => (
              <Link
                key={y}
                href={`/review?year=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium tabular-nums transition ${
                  y === year ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white/70 text-ink-soft hover:text-ink"
                }`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {empty ? (
        <div className="card text-center">
          <p className="font-display text-xl font-semibold">Nothing from {year} yet</p>
          <p className="mt-1 text-ink-soft">Postcards show up here once they&apos;ve arrived, and meetups once they&apos;re on the timeline.</p>
        </div>
      ) : (
        <>
          {/* The year in numbers */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile primary label="Postcards" value={r.cards.length} hint="sent and arrived" />
            <StatTile
              label="Kilometres"
              value={Math.round(r.totalKm).toLocaleString("en")}
              hint={r.totalKm >= EARTH_KM / 10 ? `${(r.totalKm / EARTH_KM).toFixed(1)}× around the Earth` : "by post"}
            />
            <StatTile label="Countries" value={r.countries.length} hint={r.newCountries.length ? `${r.newCountries.length} new for the group` : "sent from"} />
            <StatTile
              label="Days in the post"
              value={r.avgDays !== null ? r.avgDays.toFixed(1) : "—"}
              hint="on average"
            />
            <StatTile label="Meetups" value={r.meetups.length} hint={r.daysTogether ? `${r.daysTogether} ${r.daysTogether === 1 ? "day" : "days"} together` : "on the timeline"} />
            <StatTile
              label="Busiest month"
              value={r.busiest !== null ? MONTHS[r.busiest] : "—"}
              hint={r.busiest !== null ? `${r.byMonth[r.busiest]} ${r.byMonth[r.busiest] === 1 ? "card" : "cards"} sent` : "no cards yet"}
            />
          </section>

          {/* Month by month */}
          {r.cards.length > 0 && (
            <section className="card space-y-3">
              <SectionTitle title="Month by month" subtitle="Cards sent each month (the ones that arrived)." />
              <div className="flex h-36 items-end gap-1 sm:gap-2" role="img" aria-label={MONTH_NAMES.map((m, i) => `${m}: ${r.byMonth[i]}`).join(", ")}>
                {r.byMonth.map((n, i) => (
                  <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    {n > 0 && <span className="text-xs font-medium tabular-nums text-ink-soft">{n}</span>}
                    <div
                      className={`w-full rounded-t-[4px] ${i === r.busiest ? "bg-stamp" : "bg-ink/20"}`}
                      style={{ height: n ? `${Math.max(6, (n / peak) * 100)}%` : "2px" }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 sm:gap-2" aria-hidden="true">
                {MONTHS.map((m) => (
                  <span key={m} className="min-w-0 flex-1 text-center text-[11px] text-ink-soft">
                    <span className="sm:hidden">{m[0]}</span>
                    <span className="hidden sm:inline">{m}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Standout cards */}
          {(r.farthest || fastest || slowest) && (
            <section className="space-y-3">
              <SectionTitle title="Standout cards" subtitle="The long hauls and the speedy ones." />
              <div className="grid gap-3 sm:grid-cols-3">
                {r.farthest && (
                  <CardHighlight label="Farthest" card={r.farthest.card} detail={formatKm(r.farthest.km)} from={name(r.farthest.card.sender_id)} to={name(r.farthest.card.recipient_id)} />
                )}
                {fastest && (
                  <CardHighlight
                    label="Fastest"
                    card={fastest.card}
                    detail={`${formatKm(fastest.km)} in ${fastest.days} ${fastest.days === 1 ? "day" : "days"}`}
                    from={name(fastest.card.sender_id)}
                    to={name(fastest.card.recipient_id)}
                  />
                )}
                {slowest && (
                  <CardHighlight
                    label="Slowest"
                    card={slowest.card}
                    detail={`${slowest.days} days for ${formatKm(slowest.km)}`}
                    from={name(slowest.card.sender_id)}
                    to={name(slowest.card.recipient_id)}
                  />
                )}
              </div>
            </section>
          )}

          {/* Awards */}
          {(r.mostSent || r.mostReceived || r.mostCountries || r.penPals) && (
            <section className="space-y-3">
              <SectionTitle title="This year's awards" subtitle={`Who made ${year} what it was.`} />
              <div className="grid gap-3 sm:grid-cols-2">
                {r.mostSent && <Award title="Busiest pen" member={r.mostSent.member} value={`${r.mostSent.sent} ${r.mostSent.sent === 1 ? "card" : "cards"} sent`} />}
                {r.mostCountries && (
                  <Award title="Globetrotter" member={r.mostCountries.member} value={`${r.mostCountries.countries} ${r.mostCountries.countries === 1 ? "country" : "countries"}`} />
                )}
                {r.mostReceived && (
                  <Award title="Fullest mailbox" member={r.mostReceived.member} value={`${r.mostReceived.received} ${r.mostReceived.received === 1 ? "card" : "cards"} received`} />
                )}
                {r.penPals?.a && r.penPals.b && (
                  <div className="card flex items-center gap-3 p-4">
                    <span className="flex shrink-0 -space-x-2">
                      <Avatar name={r.penPals.a.display_name} color={r.penPals.a.color} url={r.penPals.a.avatar_url} size={40} />
                      <Avatar name={r.penPals.b.display_name} color={r.penPals.b.color} url={r.penPals.b.avatar_url} size={40} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">Pen pals of the year</span>
                      <span className="block truncate font-medium">
                        {r.penPals.a.display_name} & {r.penPals.b.display_name}
                      </span>
                      <span className="block text-sm text-ink-soft">{r.penPals.count} cards between them</span>
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Countries */}
          {r.countries.length > 0 && (
            <section className="card space-y-3">
              <SectionTitle
                title={`${r.countries.length} ${r.countries.length === 1 ? "country" : "countries"}`}
                subtitle={r.newCountries.length ? `New for the group this year are marked with a star.` : "Where this year's cards came from."}
              />
              <ul className="flex flex-wrap gap-2">
                {r.countries.map((c) => {
                  const isNew = r.newCountries.some((n) => n.code === c.code);
                  return (
                    <li
                      key={c.code}
                      className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm ${isNew ? "border-stamp/40 bg-stamp/5" : "border-ink/10 bg-white/70"}`}
                    >
                      <Flag code={c.code} size={18} />
                      {c.name}
                      {c.count > 1 && <span className="text-xs text-ink-soft">×{c.count}</span>}
                      {isNew && (
                        <span className="text-stamp" title="New for the group">
                          ★<span className="sr-only"> new</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Everyone's year */}
          {r.people.length > 0 && (
            <section className="space-y-3">
              <SectionTitle title="Everyone's year" subtitle="Cards that arrived, by who sent them." />
              <ul className="card divide-y divide-ink/10 p-0">
                {r.people.map((p) => (
                  <li key={p.member.id}>
                    <Link href={`/members/${p.member.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper/60">
                      <Avatar name={p.member.display_name} color={p.member.color} url={p.member.avatar_url} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.member.display_name}</span>
                        <span className="block truncate text-xs text-ink-soft">
                          {p.countries} {p.countries === 1 ? "country" : "countries"} · {Math.round(p.km).toLocaleString("en")} km
                        </span>
                      </span>
                      <span className="grid shrink-0 grid-cols-2 gap-3 text-center text-xs text-ink-soft sm:gap-5">
                        <span>
                          <strong className="block font-display text-xl text-ink tabular-nums">{p.sent}</strong>
                          sent
                        </span>
                        <span>
                          <strong className="block font-display text-xl text-ink tabular-nums">{p.received}</strong>
                          received
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Meetups */}
          {r.meetups.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                title={`${r.meetups.length} ${r.meetups.length === 1 ? "meetup" : "meetups"}`}
                subtitle={`${r.daysTogether} ${r.daysTogether === 1 ? "day" : "days"} together in ${r.placesTogether.length} ${r.placesTogether.length === 1 ? "place" : "places"}.`}
              />
              <ul className="space-y-2">
                {r.meetups.map((m) => (
                  <li key={m.id}>
                    <Link href={`/timeline/${m.id}`} className="card flex items-center gap-3 p-4 transition hover:bg-white">
                      {m.places[0] ? <Flag code={m.places[0].countryCode} size={22} /> : <span aria-hidden="true">✶</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.title}</span>
                        <span className="block truncate text-xs text-ink-soft">
                          {meetupDates(m)}
                          {m.places.length > 0 && ` · ${m.places.map((p) => p.name).join(" → ")}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 -space-x-1.5">
                        {m.memberIds.slice(0, 4).map((id) => {
                          const who = membersById.get(id);
                          return who && <Avatar key={id} name={who.display_name} color={who.color} url={who.avatar_url} size={24} />;
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-sm text-ink-soft">{subtitle}</p>
    </div>
  );
}

function CardHighlight({
  label,
  card,
  detail,
  from,
  to,
}: {
  label: string;
  card: LocatedPostcard;
  detail: string;
  from?: MemberWithAvatar;
  to?: MemberWithAvatar;
}) {
  return (
    <Link href={`/postcards/${card.id}`} className="card block space-y-1 p-4 transition hover:bg-white">
      <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        <Flag code={card.from_country_code} size={18} />
        <span className="truncate">{card.from_city}</span>
      </span>
      <span className="block text-sm">{detail}</span>
      <span className="block truncate text-xs text-ink-soft">
        <span style={{ color: from?.color }}>{from?.display_name ?? "Someone"}</span> →{" "}
        <span style={{ color: to?.color }}>{to?.display_name ?? "someone"}</span> · {formatDate(card.sent_on)}
      </span>
    </Link>
  );
}

function Award({ title, member, value }: { title: string; member: MemberWithAvatar; value: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <Avatar name={member.display_name} color={member.color} url={member.avatar_url} size={40} />
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</span>
        <span className="block truncate font-medium">{member.display_name}</span>
        <span className="block text-sm text-ink-soft">{value}</span>
      </span>
    </div>
  );
}
