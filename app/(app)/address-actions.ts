"use server";

import { revalidatePath } from "next/cache";
import type { City } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

/** The address as written on a postcard, plus the town it's in (for the map). */
export type AddressInput = { addressLine: string; town: City };

export async function addAddress(input: AddressInput, makeCurrent: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_address", {
    p_address_line: input.addressLine,
    p_city: input.town.name,
    p_country: input.town.country,
    p_country_code: input.town.countryCode,
    p_lat: input.town.lat,
    p_lng: input.town.lng,
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
    p_city: input.town.name,
    p_country: input.town.country,
    p_country_code: input.town.countryCode,
    p_lat: input.town.lat,
    p_lng: input.town.lng,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Hide an old address that postcards were sent to (it stays as their history). */
export async function retireAddress(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("retire_address", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function unretireAddress(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unretire_address", { p_id: id });
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
