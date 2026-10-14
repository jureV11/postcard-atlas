export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  color: string;
  home_city: string;
  home_country: string;
  home_country_code: string;
  home_lat: number;
  home_lng: number;
  created_at: string;
};

export type MemberWithAvatar = Member & { avatar_url: string | null };

export type PostcardStatus = "in_transit" | "received";

/**
 * A row of the `postcard_feed` view. While a card is in transit, who sent it
 * and where from are null for everyone but the sender.
 */
export type Postcard = {
  id: string;
  group_id: string;
  sender_id: string | null;
  recipient_id: string;
  from_city: string | null;
  from_country: string | null;
  from_country_code: string | null;
  from_lat: number | null;
  from_lng: number | null;
  sent_on: string; // YYYY-MM-DD
  received_on: string | null;
  status: PostcardStatus;
  created_at: string;
  revealed: boolean;
  front_path: string | null;
  back_path: string | null;
  message: string | null;
  note: string | null;
  has_front: boolean;
  has_back: boolean;
  has_message: boolean;
  /**
   * Arrived, and so has every other card from the same trip (same sender, posted
   * within 10 days). Only public cards count in stats and are seen by everyone.
   */
  is_public: boolean;
};

/** A card whose origin is known to the viewer (received, or sent by them). */
export type LocatedPostcard = Postcard & {
  sender_id: string;
  from_city: string;
  from_country: string;
  from_country_code: string;
  from_lat: number;
  from_lng: number;
};

export function isLocated<T extends Postcard>(c: T): c is T & LocatedPostcard {
  return c.sender_id !== null && c.from_lat !== null && c.from_lng !== null && c.from_country_code !== null;
}
