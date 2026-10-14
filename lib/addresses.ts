import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "@/lib/types";

/** Everyone's addresses in your group (the database only returns your group's). */
export async function loadAddresses(supabase: SupabaseClient): Promise<Address[]> {
  const { data } = await supabase
    .from("member_addresses")
    .select("*")
    .order("is_current", { ascending: false })
    .order("created_at");
  return (data ?? []) as Address[];
}

export function addressesByMember(addresses: Address[]): Map<string, Address[]> {
  const map = new Map<string, Address[]>();
  for (const a of addresses) map.set(a.member_id, [...(map.get(a.member_id) ?? []), a]);
  return map;
}
