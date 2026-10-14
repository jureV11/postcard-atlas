"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FoundAddress = {
  label: string; // full address as OpenStreetMap writes it
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
};

type Result = { error?: string };

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string | undefined>;
};

/**
 * Look up a full street address with OpenStreetMap's free geocoder (Nominatim).
 * Called once per "Find" click — their usage policy asks for no autocomplete and
 * an identifying User-Agent.
 */
export async function searchAddress(query: string): Promise<{ results?: FoundAddress[]; error?: string }> {
  const q = query.trim();
  if (q.length < 4) return { error: "Type the full address, e.g. “Corso Novara, 135, 10153 Torino, Italy”." };

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "en");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PostcardAtlas/1.0 (private postcard map for a group of friends)" },
      cache: "no-store",
    });
    if (!res.ok) return { error: "The address lookup is busy — try again in a moment." };
    const json = (await res.json()) as NominatimResult[];
    const results = json
      .map((r): FoundAddress | null => {
        const a = r.address ?? {};
        const countryCode = a.country_code?.toUpperCase();
        if (!countryCode) return null;
        return {
          label: r.display_name,
          city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.county ?? a.state ?? "",
          country: a.country ?? countryCode,
          countryCode,
          lat: Number(r.lat),
          lng: Number(r.lon),
        };
      })
      .filter((r): r is FoundAddress => r !== null && r.city !== "");
    if (!results.length) return { error: "Couldn't find that address. Try adding the city and country." };
    return { results };
  } catch {
    return { error: "The address lookup isn't reachable right now." };
  }
}

type AddressInput = { addressLine: string; found: FoundAddress };

export async function addAddress(input: AddressInput, makeCurrent: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_address", {
    p_address_line: input.addressLine,
    p_city: input.found.city,
    p_country: input.found.country,
    p_country_code: input.found.countryCode,
    p_lat: input.found.lat,
    p_lng: input.found.lng,
    p_make_current: makeCurrent,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function updateAddress(id: string, input: AddressInput): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_address", {
    p_id: id,
    p_address_line: input.addressLine,
    p_city: input.found.city,
    p_country: input.found.country,
    p_country_code: input.found.countryCode,
    p_lat: input.found.lat,
    p_lng: input.found.lng,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function setCurrentAddress(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_current_address", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteAddress(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_address", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Which of the recipient's addresses a postcard went to. */
export async function setPostcardAddress(cardId: string, addressId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_postcard_address", { p_id: cardId, p_address_id: addressId });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
