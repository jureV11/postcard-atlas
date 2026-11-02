import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/StatTile";
import { YearlyBars } from "@/components/passport/YearlyBars";
import type { MeetupStats as Stats } from "@/lib/meetupStats";
import type { MemberWithAvatar } from "@/lib/types";

/** Under the map: how often we meet up (in all and per year), who comes to the most, and who goes together. */
export function MeetupStats({ stats, avatars }: { stats: Stats; avatars: Map<string, MemberWithAvatar> }) {
  if (!stats.past) return null;
  const top = Math.max(1, ...stats.attendance.map((a) => a.count));
  const least = Math.min(...stats.attendance.map((a) => a.count));
  const fewest = least < top ? stats.attendance.filter((a) => a.count === least).map((a) => a.member.display_name) : [];
  const names = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]);
  const face = (id: string, size = 28) => {
    const m = avatars.get(id);
    return m ? <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={size} /> : null;
  };

  return (
    <section className="mx-auto mt-10 max-w-5xl space-y-5">
      <h2 className="font-display text-xl font-semibold">Meetups in numbers</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile primary label="Meetups" value={stats.past} hint={stats.upcoming ? `+ ${stats.upcoming} coming up` : "so far"} />
        <StatTile label="Days together" value={stats.days} hint="every day of every meetup" />
        <StatTile label="Countries" value={stats.countries} hint={stats.places === 1 ? "1 place" : `${stats.places} places`} />
        <StatTile
          label="Busiest year"
          value={stats.busiest?.year ?? "–"}
          hint={stats.busiest ? (stats.busiest.count === 1 ? "1 meetup" : `${stats.busiest.count} meetups`) : undefined}
        />
      </div>

      <div className="card">
        <h3 className="mb-3 font-display text-lg font-semibold">Meetups by year</h3>
        <YearlyBars years={stats.years} noun={["meetup", "meetups"]} what="Meetups" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="font-display text-lg font-semibold">Who comes to the most</h3>
          <ol className="space-y-2.5">
            {stats.attendance.map(({ member, count }) => (
              <li key={member.id} className="flex items-center gap-3">
                {/* Same count, same place */}
                <span className="w-5 shrink-0 text-right font-mono text-xs text-ink-soft tabular-nums">
                  {1 + stats.attendance.filter((a) => a.count > count).length}
                </span>
                {face(member.id)}
                <Link href={`/members/${member.id}`} className="w-24 shrink-0 truncate text-sm font-medium hover:underline sm:w-32">
                  {member.display_name}
                </Link>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                  <span className="block h-full rounded-full bg-stamp/70" style={{ width: `${(count / top) * 100}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums">{count}</span>
              </li>
            ))}
          </ol>
          {fewest.length > 0 && (
            <p className="rounded-xl bg-paper-deep px-3 py-2 text-sm">
              <span className="font-medium">Hardest to get on a trip:</span> {names(fewest)}, at{" "}
              {least === 1 ? "1 meetup" : `${least} meetups`}. Time to invite them along? 👀
            </p>
          )}
        </div>

        <div className="card space-y-3">
          <h3 className="font-display text-lg font-semibold">Travel buddies</h3>
          {stats.pairs.length ? (
            <ol className="space-y-3">
              {stats.pairs.map(({ a, b, count }) => (
                <li key={`${a.id}-${b.id}`} className="flex items-center gap-3">
                  <span className="flex shrink-0 -space-x-2">
                    {face(a.id, 32)}
                    {face(b.id, 32)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {a.display_name} &amp; {b.display_name}
                  </span>
                  <span className="shrink-0 text-sm text-ink-soft">{count === 1 ? "1 meetup" : `${count} meetups`} together</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">Once two of you have been on a meetup together, they show up here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
