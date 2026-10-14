import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CountryOutline } from "@/components/CountryOutline";
import { Flag } from "@/components/Flag";
import { MysteryGlobe } from "@/components/Mystery";
import { PostcardFlip } from "@/components/PostcardFlip";
import { daysBetween, formatDate, todayLocal } from "@/lib/dates";
import { formatKm, haversineKm } from "@/lib/geo";
import { withFormerLabel } from "@/lib/members";
import { visibleTo } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { signAvatarUrls, signPaths } from "@/lib/storage";
import { isLocated, type Member, type Postcard } from "@/lib/types";
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
  const today = todayLocal();

  // Anyone who can see a card (visibleTo above) sees all of it.
  if (!isLocated(card)) notFound();
  const urls = await signPaths(supabase, "postcards", [card.front_path, card.back_path]);
  const frontUrl = card.front_path ? (urls.get(card.front_path) ?? null) : null;
  const backUrl = card.back_path ? (urls.get(card.back_path) ?? null) : null;
  const distance = recipient ? haversineKm(card.from_lat, card.from_lng, recipient.home_lat, recipient.home_lng) : null;
  const travelDays = card.received_on ? daysBetween(card.sent_on, card.received_on) : daysBetween(card.sent_on, today);
  const canEditPhotos = isRecipient && !inTransit; // photos are the recipient's job

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/postcards" className="text-sm text-ink-soft hover:text-ink">
          ← Postcards
        </Link>
        {(isSender || (isRecipient && !inTransit)) && (
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

      {inTransit && isSender && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <strong>In transit.</strong> Only you can see this — nobody else knows it&apos;s coming, not even{" "}
          {recipient?.display_name}. When it lands, {recipient?.display_name} photographs the front and back.
        </p>
      )}

      {!inTransit && !card.is_public && (
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
            postmark={inTransit ? undefined : { city: card.from_city, country: card.from_country, date: card.sent_on }}
          />
        </div>
      ) : (
        !inTransit &&
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
              to {recipient?.home_city}, {recipient?.home_country}
            </span>
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-ink-soft">Sent</dt>
            <dd className="font-medium">{formatDate(card.sent_on)}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">{card.received_on ? "Received" : "Status"}</dt>
            <dd className="font-medium">{card.received_on ? formatDate(card.received_on) : "In transit"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Distance</dt>
            <dd className="font-medium">{distance !== null ? formatKm(distance) : "—"}</dd>
          </div>
        </dl>
        {travelDays > 0 && (
          <p className="text-sm text-ink-soft sm:col-span-2">
            {card.received_on ? `Took ${travelDays} days to arrive.` : `${travelDays} days in transit so far.`}
          </p>
        )}
      </section>

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
