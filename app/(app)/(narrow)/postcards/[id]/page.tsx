import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CountryOutline } from "@/components/CountryOutline";
import { Flag } from "@/components/Flag";
import { MysteryGlobe } from "@/components/Mystery";
import { NicheCard } from "@/components/NicheBreakdown";
import { PostcardFlip } from "@/components/PostcardFlip";
import { daysBetween, formatDate, todayLocal } from "@/lib/dates";
import { formatKm, haversineKm } from "@/lib/geo";
import { withFormerLabel } from "@/lib/members";
import { nicheScores } from "@/lib/niche";
import { visibleTo } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { signAvatarUrls, signPaths } from "@/lib/storage";
import { destinationOf, isLocated, type Member, type Postcard } from "@/lib/types";
import { LostButton } from "./LostButton";
import { PhotosEditor } from "./PhotosEditor";

export default async function PostcardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photoError?: string }>;
}) {
  const { id } = await params;
  const { photoError } = await searchParams;
  const { supabase, member } = await requireMember();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("postcard_feed").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const card = data as Postcard;
  if (!visibleTo(card, member.id)) notFound();

  const { data: memberRows } = await supabase
    .from("members")
    .select("*")
    .in("id", [card.sender_id, card.recipient_id].filter((x): x is string => !!x));
  const people = (await signAvatarUrls(supabase, (memberRows ?? []) as Member[])).map(withFormerLabel);
  const sender = people.find((m) => m.id === card.sender_id);
  const recipient = people.find((m) => m.id === card.recipient_id);

  const isSender = card.sender_id === member.id;
  const isRecipient = card.recipient_id === member.id;
  const inTransit = card.status === "in_transit";
  const lost = card.status === "lost";
  const arrived = card.status === "received";
  const today = todayLocal();

  // Anyone who can see a card (visibleTo above) sees all of it.
  if (!isLocated(card)) notFound();
  const urls = await signPaths(supabase, "postcards", [card.front_path, card.back_path]);
  const frontUrl = card.front_path ? (urls.get(card.front_path) ?? null) : null;
  const backUrl = card.back_path ? (urls.get(card.back_path) ?? null) : null;
  const to = destinationOf(card, recipient);
  const distance = to ? haversineKm(card.from_lat, card.from_lng, to.lat, to.lng) : null;
  const travelDays = card.received_on ? daysBetween(card.sent_on, card.received_on) : daysBetween(card.sent_on, today);
  // Photos are the recipient's job — except for a lost card, which never reaches them.
  const canEditPhotos = (isRecipient && arrived) || (isSender && lost);
  // Nicheness: only for delivered, public cards — the same ones the leaderboard scores.
  const [niche] = await nicheScores([card]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/postcards" className="text-sm text-ink-soft hover:text-ink">
          ← Postcards
        </Link>
        {(isSender || (isRecipient && arrived)) && (
          <Link href={`/postcards/${card.id}/edit`} className="btn-ghost min-h-9 px-4">
            ✎ Edit
          </Link>
        )}
      </div>

      {photoError && (
        <p className="error">
          The postcard was saved, but the photos didn&apos;t upload ({photoError}). You can add them below.
        </p>
      )}

      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-semibold tracking-tight">
            <Flag code={card.from_country_code} size={32} />
            {card.from_city}
          </h1>
          <p className="mt-1 text-ink-soft">{card.from_country}</p>
        </div>
        {/* Where in the country it came from */}
        <CountryOutline
          countryCode={card.from_country_code}
          countryName={card.from_country}
          city={card.from_city}
          lat={card.from_lat}
          lng={card.from_lng}
        />
      </div>

      {lost && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-stamp/50 bg-stamp/5 px-4 py-3 text-sm">
          <span className="date-stamp !text-xs">Lost</span>
          <p className="min-w-0 flex-1">
            <strong>Lost in the post.</strong> Sent {formatDate(card.sent_on)}
            {card.lost_on && <>, given up on {formatDate(card.lost_on)}</>}. It never reached {recipient?.display_name}.
            {isRecipient && " If it turns up after all, use “A postcard arrived!” as usual."}
          </p>
          {isSender && <LostButton id={card.id} lost sentOn={card.sent_on} lostOn={card.lost_on} />}
        </div>
      )}

      {inTransit && isSender && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <strong>In transit.</strong> Only you can see this — nobody else knows it&apos;s coming, not even{" "}
          {recipient?.display_name}. When it lands, {recipient?.display_name} photographs the front and back.
          <span className="mt-2 block">
            <LostButton id={card.id} lost={false} sentOn={card.sent_on} />
          </span>
        </p>
      )}

      {arrived && !card.is_public && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <strong>Only {isSender ? `you and ${recipient?.display_name}` : `you and ${sender?.display_name}`} can see this for now.</strong>{" "}
          {isSender ? "Your" : `${sender?.display_name}'s`} other postcards from the same trip haven&apos;t all arrived yet — the
          moment the last one lands, they&apos;re all revealed to everyone.
        </p>
      )}

      {frontUrl || backUrl ? (
        <div className="mx-auto max-w-2xl">
          <PostcardFlip
            frontUrl={frontUrl}
            backUrl={backUrl}
            alt={`Postcard from ${card.from_city}`}
            postmark={inTransit || card.hand_delivered ? undefined : { city: card.from_city, country: card.from_country, date: card.sent_on }}
          />
        </div>
      ) : (
        arrived &&
        !isRecipient && (
          <div className="mx-auto flex aspect-[3/2] max-w-2xl flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 text-ink-soft">
            <Flag code={card.from_country_code} size={36} />
            <p className="text-sm">Waiting for {recipient?.display_name ?? "the recipient"} to add photos</p>
          </div>
        )
      )}

      <section className="card grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          {sender && <Avatar name={sender.display_name} color={sender.color} url={sender.avatar_url} size={40} />}
          <span className="text-ink-soft">→</span>
          {recipient && (
            <Avatar name={recipient.display_name} color={recipient.color} url={recipient.avatar_url} size={40} />
          )}
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">
              {sender?.display_name} → {recipient?.display_name}
            </span>
            <span className="block truncate text-ink-soft">
              to {card.to_address_line?.replace(/\s*\n\s*/g, ", ") ?? `${recipient?.home_city}, ${recipient?.home_country}`}
            </span>
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-ink-soft">Sent</dt>
            <dd className="font-medium">{formatDate(card.sent_on)}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">{arrived ? "Received" : "Status"}</dt>
            <dd className="font-medium">
              {card.received_on ? formatDate(card.received_on) : arrived ? "Date unknown" : lost ? "Lost" : "In transit"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Distance</dt>
            <dd className="font-medium">{distance !== null ? formatKm(distance) : "—"}</dd>
          </div>
        </dl>
        {travelDays > 0 && !lost && (card.received_on || inTransit) && (
          <p className="text-sm text-ink-soft sm:col-span-2">
            {card.hand_delivered
              ? "Hand delivered — given in person, no post involved."
              : card.received_on
                ? `Took ${travelDays} days to arrive.`
                : `${travelDays} days in transit so far.`}
          </p>
        )}
      </section>

      {niche && niche.score !== null && (
        <NicheCard score={niche.score} factors={niche.factors} facts={niche.facts} country={card.from_country} />
      )}

      {(card.message || card.note) && (
        <section className="card space-y-4">
          {card.message && (
            <blockquote className="whitespace-pre-line font-display text-lg italic leading-relaxed">
              “{card.message}”
            </blockquote>
          )}
          {card.note && (
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">Note:</span> {card.note}
            </p>
          )}
        </section>
      )}

      {canEditPhotos && (
        <details className="card group" open={!frontUrl && !backUrl}>
          <summary className="cursor-pointer list-none font-medium">
            {frontUrl || backUrl ? "Change photos" : "Add photos"}
            <span className="ml-1 text-ink-soft group-open:hidden">▸</span>
          </summary>
          <div className="mt-4">
            <PhotosEditor cardId={card.id} groupId={card.group_id} frontUrl={frontUrl} backUrl={backUrl} />
          </div>
        </details>
      )}
    </div>
  );
}
