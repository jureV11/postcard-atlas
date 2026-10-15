import { countryKeyFromAlpha2 } from "@/lib/countries";
import { isLocated, type LocatedPostcard, type MemberWithAvatar, type Postcard } from "@/lib/types";

/** A postcard plus signed image URLs (null while hidden). */
export type MapCard = Postcard & { front_url: string | null; back_url: string | null };
/** A card whose origin the viewer may see — the only kind drawn on the map. */
export type LocatedMapCard = MapCard & LocatedPostcard;

export type CityGroup = {
  key: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  cards: LocatedMapCard[];
};

/** An address someone used to live at, shown because a delivered card went there. */
export type OldHome = {
  key: string;
  member: MemberWithAvatar;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
  cards: number;
};

export type Selection =
  | { kind: "card"; id: string }
  | { kind: "city"; key: string }
  | { kind: "member"; id: string };

export function cityKey(c: { from_city: string; from_lat: number; from_lng: number }): string {
  return `${c.from_city}|${c.from_lat.toFixed(3)}|${c.from_lng.toFixed(3)}`;
}

/** A card's role when one person is selected: they sent it, received it, or neither. */
export type RouteRole = "out" | "in" | "other";

/**
 * Everything the map and globe draw, derived from the cards and the selected
 * person. With a person selected, nothing is removed: their cards are tagged
 * "out"/"in" (highlighted) and everyone else's "other" (faded).
 */
export function deriveAtlas(
  cards: MapCard[],
  members: MemberWithAvatar[],
  filterId: string | null,
  /** With a person selected: whether to highlight the cards they sent and/or received. */
  directions: { sent: boolean; received: boolean } = { sent: true, received: true },
) {
  const involves = (c: MapCard) =>
    !filterId ||
    (directions.sent && c.sender_id === filterId) ||
    (directions.received && c.recipient_id === filterId);
  const visibleCards = cards.filter(involves); // the selected person's cards (all cards if nobody's selected)

  // Received cards, plus the viewer's own cards in transit (they know where they sent them from).
  const located = cards.filter(isLocated);
  // Mystery cards: in transit, origin unknown to the viewer.
  const brewing = visibleCards.filter((c) => c.status === "in_transit");

  const roles = new Map<string, RouteRole>();
  const involvedMembers = new Set<string>();
  let sentCount = 0;
  let receivedCount = 0;
  if (filterId) {
    involvedMembers.add(filterId);
    for (const c of located) {
      if (c.sender_id === filterId) sentCount++;
      if (c.recipient_id === filterId) receivedCount++;
      const role: RouteRole =
        directions.sent && c.sender_id === filterId
          ? "out"
          : directions.received && c.recipient_id === filterId
            ? "in"
            : "other";
      roles.set(c.id, role);
      if (role !== "other") {
        involvedMembers.add(c.sender_id);
        involvedMembers.add(c.recipient_id);
      }
    }
  }

  const focusCities = new Set<string>(); // cities the selected person's routes touch
  const cityMap = new Map<string, CityGroup>();
  for (const c of located) {
    if (involves(c)) focusCities.add(cityKey(c));
    const key = cityKey(c);
    let group = cityMap.get(key);
    if (!group) {
      group = {
        key,
        name: c.from_city,
        country: c.from_country,
        countryCode: c.from_country_code,
        lat: c.from_lat,
        lng: c.from_lng,
        cards: [],
      };
      cityMap.set(key, group);
    }
    group.cards.push(c);
  }

  // Countries highlighted as "sent from" — arrived cards only (the selected person's, if any).
  const sentFrom = new Set<string>();
  const arrivedCountries = new Set<string>();
  for (const c of located) {
    if (c.status !== "received" || !involves(c)) continue;
    arrivedCountries.add(c.from_country_code);
    const k = countryKeyFromAlpha2(c.from_country_code);
    if (k) sentFrom.add(k);
  }

  // Home countries: first member listed wins if two share a country.
  const homes = new Map<string, MemberWithAvatar>();
  for (const m of members) {
    const k = countryKeyFromAlpha2(m.home_country_code);
    if (k && !homes.has(k)) homes.set(k, m);
  }

  // Old addresses that a delivered card went to (current addresses are the homes above).
  const membersById = new Map(members.map((m) => [m.id, m]));
  const oldHomeMap = new Map<string, OldHome>();
  for (const c of located) {
    if (c.status !== "received" || c.to_lat == null || c.to_lng == null || !c.to_country_code) continue;
    const m = membersById.get(c.recipient_id);
    if (!m || (Math.abs(c.to_lat - m.home_lat) < 1e-6 && Math.abs(c.to_lng - m.home_lng) < 1e-6)) continue;
    const key = `${m.id}|${c.to_lat.toFixed(4)}|${c.to_lng.toFixed(4)}`;
    const old = oldHomeMap.get(key);
    if (old) old.cards++;
    else
      oldHomeMap.set(key, {
        key,
        member: m,
        city: c.to_city ?? "",
        countryCode: c.to_country_code,
        lat: c.to_lat,
        lng: c.to_lng,
        cards: 1,
      });
  }
  const oldHomes = [...oldHomeMap.values()];
  // Striped countries: an old address's country, unless it's someone's current home country.
  const oldHomeCountries = new Map<string, MemberWithAvatar>();
  for (const o of oldHomes) {
    const k = countryKeyFromAlpha2(o.countryCode);
    if (k && !homes.has(k) && !oldHomeCountries.has(k)) oldHomeCountries.set(k, o.member);
  }

  // Members with something on its way to them (pulsing rings).
  const awaiting = new Set(brewing.map((c) => c.recipient_id));

  return {
    visibleCards,
    located,
    brewing,
    awaiting,
    roles,
    involvedMembers,
    focusCities,
    sentCount, // routes on the map the selected person sent / received
    receivedCount,
    cities: [...cityMap.values()],
    sentFrom,
    homes,
    oldHomes,
    oldHomeCountries,
    countryCount: arrivedCountries.size,
  };
}
