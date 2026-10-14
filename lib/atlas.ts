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
export function deriveAtlas(cards: MapCard[], members: MemberWithAvatar[], filterId: string | null) {
  const involves = (c: MapCard) => !filterId || c.sender_id === filterId || c.recipient_id === filterId;
  const visibleCards = cards.filter(involves); // the selected person's cards (all cards if nobody's selected)

  // Received cards, plus the viewer's own cards in transit (they know where they sent them from).
  const located = cards.filter(isLocated);
  // Mystery cards: in transit, origin unknown to the viewer.
  const brewing = visibleCards.filter((c) => c.status === "in_transit");

  const roles = new Map<string, RouteRole>();
  const involvedMembers = new Set<string>();
  if (filterId) {
    involvedMembers.add(filterId);
    for (const c of located) {
      const role: RouteRole = c.sender_id === filterId ? "out" : c.recipient_id === filterId ? "in" : "other";
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
    cities: [...cityMap.values()],
    sentFrom,
    homes,
    countryCount: arrivedCountries.size,
  };
}
