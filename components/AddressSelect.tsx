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
  const sorted = [...addresses].sort((a, b) => Number(b.is_current) - Number(a.is_current));
  if (sorted.length === 0) return null;
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {sorted.map((a) => (
        <option key={a.id} value={a.id}>
          {a.is_current ? "Current — " : "Previous — "}
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
