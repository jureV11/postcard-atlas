"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { PostcardFlip } from "@/components/PostcardFlip";
import type { CityGroup, LocatedMapCard, Selection } from "@/lib/atlas";
import { formatDate } from "@/lib/dates";
import { formatKm, haversineKm } from "@/lib/geo";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";

/** Floating detail panel for whatever is selected on the map/globe. */
export function AtlasPanel({
  selection,
  onSelect,
  onClose,
  cards,
  cities,
  membersById,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  onClose: () => void;
  cards: LocatedMapCard[]; // only cards drawn on the map can be selected
  cities: CityGroup[];
  membersById: Map<string, MemberWithAvatar>;
}) {
  let body: React.ReactNode = null;

  if (selection.kind === "card") {
    const card = cards.find((c) => c.id === selection.id);
    if (card) body = <CardDetails key={card.id} card={card} membersById={membersById} />;
  } else if (selection.kind === "city") {
    const city = cities.find((c) => c.key === selection.key);
    if (city) {
      body = (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Flag code={city.countryCode} size={22} />
            {city.name}
          </h3>
          <p className="text-sm text-ink-soft">
            {city.country} · {city.cards.length} {city.cards.length === 1 ? "postcard" : "postcards"}
          </p>
          <CardList cards={city.cards} membersById={membersById} onSelect={onSelect} />
        </div>
      );
    }
  } else {
    const m = membersById.get(selection.id);
    if (m) {
      const received = cards.filter((c) => c.recipient_id === m.id && c.status === "received");
      const sent = cards.filter((c) => c.sender_id === m.id);
      body = (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={44} />
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl font-semibold">{m.display_name}</h3>
              <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                <Flag code={m.home_country_code} size={14} />
                {m.home_city}, {m.home_country}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-soft">
            {sent.length} sent · {received.length} received
          </p>
          {received.length > 0 && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Received here</p>
              <CardList cards={received} membersById={membersById} onSelect={onSelect} />
            </>
          )}
          <Link href={`/members/${m.id}`} className="btn-ghost w-full">
            View profile
          </Link>
        </div>
      );
    }
  }

  if (!body) return null;

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 max-h-[75%] overflow-y-auto rounded-2xl border border-ink/10 bg-white/95 p-4 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-80">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
      >
        ✕
      </button>
      {body}
    </div>
  );
}

function CardList({
  cards,
  membersById,
  onSelect,
}: {
  cards: LocatedMapCard[];
  membersById: Map<string, MemberWithAvatar>;
  onSelect: (s: Selection) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {cards.map((c) => {
        const s = membersById.get(c.sender_id);
        const r = membersById.get(c.recipient_id);
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: "card", id: c.id })}
              className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-paper"
            >
              <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-deep">
                {c.front_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.front_url} alt="" className="size-full object-cover" />
                ) : (
                  <Flag code={c.from_country_code} size={20} />
                )}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium">
                  <span style={{ color: s?.color }}>{s?.display_name}</span> →{" "}
                  <span style={{ color: r?.color }}>{r?.display_name}</span>
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {c.from_city} · {c.status === "in_transit" ? "in transit" : formatDate(c.sent_on)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CardDetails({
  card,
  membersById,
}: {
  card: LocatedMapCard;
  membersById: Map<string, MemberWithAvatar>;
}) {
  const sender = membersById.get(card.sender_id);
  const recipient = membersById.get(card.recipient_id);
  const to = destinationOf(card, recipient);
  const distance = to ? haversineKm(card.from_lat, card.from_lng, to.lat, to.lng) : null;

  return (
    <div className="space-y-3">
      {(card.front_url || card.back_url) && (
        <div className="pt-6">
          <PostcardFlip
            frontUrl={card.front_url}
            backUrl={card.back_url}
            alt={`Postcard from ${card.from_city}`}
            size="sm"
            postmark={
              card.status === "received"
                ? { city: card.from_city, country: card.from_country, date: card.sent_on }
                : undefined
            }
          />
        </div>
      )}
      <h3 className="flex items-center gap-2 pr-8 font-display text-xl font-semibold">
        <Flag code={card.from_country_code} size={22} />
        {card.from_city}
      </h3>
      <p className="text-sm">
        <span className="font-medium" style={{ color: sender?.color }}>
          {sender?.display_name}
        </span>{" "}
        →{" "}
        <span className="font-medium" style={{ color: recipient?.color }}>
          {recipient?.display_name}
        </span>
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-ink-soft">Sent</dt>
          <dd>{formatDate(card.sent_on)}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">{card.received_on ? "Received" : "Status"}</dt>
          <dd>{card.received_on ? formatDate(card.received_on) : "In transit"}</dd>
        </div>
        {distance !== null && (
          <div>
            <dt className="text-ink-soft">Distance</dt>
            <dd>{formatKm(distance)}</dd>
          </div>
        )}
      </dl>
      {card.message && (
        <p className="line-clamp-4 whitespace-pre-line font-display italic text-ink/80">“{card.message}”</p>
      )}
      <Link href={`/postcards/${card.id}`} className="btn-ghost w-full">
        Open postcard
      </Link>
    </div>
  );
}
