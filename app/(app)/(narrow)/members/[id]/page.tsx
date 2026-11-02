import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileMap } from "@/components/atlas/ProfileMap";
import { Achievements } from "@/components/Achievements";
import { Avatar } from "@/components/Avatar";
import { FlagBurst } from "@/components/Confetti";
import { profileFlag } from "@/lib/flags";
import { Flag } from "@/components/Flag";
import { Passport } from "@/components/Passport";
import { PostcardTile } from "@/components/PostcardTile";
import { StatTile } from "@/components/StatTile";
import { achievementsFor } from "@/lib/achievements";
import type { MapCard } from "@/lib/atlas";
import { formatDate } from "@/lib/dates";
import { formatKm } from "@/lib/geo";
import { recentAchievements } from "@/lib/inbox";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { computeStats, rankMembers } from "@/lib/stats";
import { signPaths } from "@/lib/storage";
import type { LocatedPostcard, MemberWithAvatar, Postcard } from "@/lib/types";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ achievement?: string }>;
}) {
  const { id } = await params;
  const { achievement } = await searchParams; // from an inbox message: unfold and highlight it
  const { supabase, member: me } = await requireMember();
  const { postcards, members, membersById } = await loadGroupData(supabase, me);

  const person = membersById.get(id);
  if (!person) notFound();

  const allStats = computeStats(members, postcards);
  const stats = allStats.get(person.id)!;
  const ranking = rankMembers(members, allStats);
  const rank = ranking.find((r) => r.member.id === person.id)!.rank;
  const isMe = person.id === me.id;
  // Only your own: when each was unlocked is private to you
  const recent = isMe ? await recentAchievements(supabase, me.id) : undefined;

  const shown = [...stats.sent, ...stats.received];
  const urls = await signPaths(supabase, "postcards", shown.flatMap((c) => [c.front_path, c.back_path]));
  const withUrls = (c: Postcard): MapCard => ({
    ...c,
    front_url: c.front_path ? (urls.get(c.front_path) ?? null) : null,
    back_url: c.back_path ? (urls.get(c.back_path) ?? null) : null,
  });
  const sentCards = stats.sent.map(withUrls);
  const firstName = person.display_name.split(" ")[0];
  // Lost cards go public like arrived ones; until then (trip still travelling) only the sender sees them
  const lost = stats.lost.filter((c) => isMe || c.is_public).length;
  const arrivedCount = stats.sent.filter((c) => c.status === "received").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex items-center gap-4">
        <FlagBurst flag={profileFlag(person.display_name, person.home_country_code)} label="Throw some flags">
          <Avatar name={person.display_name} color={person.color} url={person.avatar_url} size={72} />
        </FlagBurst>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{person.display_name}</h1>
          <p className="flex items-center gap-1.5 text-ink-soft">
            <Flag code={person.home_country_code} size={16} />
            {person.home_city}, {person.home_country}
          </p>
        </div>
        {isMe && (
          <Link href="/settings" className="btn-ghost shrink-0 px-4">
            Edit
          </Link>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          primary
          className="col-span-2 lg:col-span-1"
          label="Countries"
          value={stats.countries.length}
          hint={members.length > 1 ? `#${rank} of ${members.length} in the group` : "sent from"}
        />
        <StatTile
          label="Postcard km"
          value={Math.round(stats.postcardKm).toLocaleString("en")}
          hint="All their delivered cards, added up"
        />
        <StatTile
          label="Explorer km"
          value={Math.round(stats.explorerKm).toLocaleString("en")}
          hint="Home → farthest place, once per country"
        />
        <StatTile
          label="Sent"
          value={stats.sent.length}
          hint={[
            `${arrivedCount} arrived`,
            lost ? `${lost} lost in the post` : "",
            isMe && stats.inTransit ? `${stats.inTransit} on the way` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <StatTile label="Received" value={stats.received.length} hint="from friends in the group" />
      </section>

      {/* Highlights */}
      {(stats.farthest || stats.mostRecent) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {stats.farthest && (
            <Highlight
              label="Farthest card"
              card={stats.farthest.card}
              detail={formatKm(stats.farthest.km)}
              recipient={membersById.get(stats.farthest.card.recipient_id)}
            />
          )}
          {stats.mostRecent && (
            <Highlight
              label="Most recent card"
              card={stats.mostRecent}
              detail={formatDate(stats.mostRecent.sent_on)}
              recipient={membersById.get(stats.mostRecent.recipient_id)}
            />
          )}
        </section>
      )}

      <Achievements
        foldable
        highlight={isMe ? achievement : undefined}
        recent={recent}
        title={isMe ? "Your achievements" : `${firstName}'s achievements`}
        items={achievementsFor(person, stats, postcards, membersById)}
      />

      {/* Passport: one ink stamp per country */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{isMe ? "Your passport" : `${firstName}'s passport`}</h2>
          <p className="text-sm text-ink-soft">A stamp for every country a postcard has arrived from.</p>
        </div>
        <Passport cards={stats.arrived} filterId={person.id} />
      </section>

      {/* Personal map */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          {isMe ? "Where you've sent from" : `Where ${firstName} has sent from`}
        </h2>
        <ProfileMap cards={sentCards} member={person} members={members} />
      </section>

      <CardGrid title="Sent" cards={sentCards} membersById={membersById} empty="Nothing sent yet." />
      <CardGrid
        title="Received"
        cards={stats.received.map(withUrls)}
        membersById={membersById}
        empty="Nothing received yet."
      />
    </div>
  );
}

function Highlight({
  label,
  card,
  detail,
  recipient,
}: {
  label: string;
  card: LocatedPostcard;
  detail: string;
  recipient?: MemberWithAvatar;
}) {
  return (
    <Link
      href={`/postcards/${card.id}`}
      className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/75 p-4 transition hover:bg-white"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep">
        <Flag code={card.from_country_code} size={28} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</span>
        <span className="block truncate font-medium">
          {card.from_city} → {recipient?.display_name ?? "?"}
        </span>
        <span className="block text-sm text-ink-soft">{detail}</span>
      </span>
    </Link>
  );
}

function CardGrid({
  title,
  cards,
  membersById,
  empty,
}: {
  title: string;
  cards: MapCard[];
  membersById: Map<string, MemberWithAvatar>;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">
        {title} <span className="text-base font-normal text-ink-soft">({cards.length})</span>
      </h2>
      {cards.length === 0 ? (
        <p className="text-ink-soft">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <PostcardTile
              key={c.id}
              card={c}
              frontUrl={c.front_url}
              sender={membersById.get(c.sender_id ?? "")}
              recipient={membersById.get(c.recipient_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
