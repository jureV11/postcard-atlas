"use client";

import type { Address } from "@/lib/types";

/** Which of someone's addresses a card went to. Current one first. */
export function AddressSelect({
  id,
  addresses,
  value,
  onChange,
}: {
  id?: string;
  addresses: Address[];
  value: string | null;
  onChange: (addressId: string) => void;
}) {
  // Retired addresses stay hidden, unless this card already went to one.
  const sorted = addresses
    .filter((a) => !a.retired_at || a.id === value)
    .sort((a, b) => Number(b.is_current) - Number(a.is_current));
  if (sorted.length === 0) return null;
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {sorted.map((a) => (
        <option key={a.id} value={a.id}>
          {a.is_current ? "Current — " : a.retired_at ? "Retired — " : "Previous — "}
          {a.address_line}
        </option>
      ))}
    </select>
  );
}

/** The address a new card defaults to: the person's current one. */
export function currentAddressId(addresses: Address[]): string | null {
  return (addresses.find((a) => a.is_current) ?? addresses[0])?.id ?? null;
}
