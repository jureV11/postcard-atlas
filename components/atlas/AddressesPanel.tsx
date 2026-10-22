"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAddress,
  deleteAddress,
  retireAddress,
  setCurrentAddress,
  unretireAddress,
  updateAddress,
  type AddressInput,
} from "@/app/(app)/address-actions";
import { Avatar } from "@/components/Avatar";
import { CitySearch } from "@/components/CitySearch";
import { Flag } from "@/components/Flag";
import { isFormer } from "@/lib/members";
import type { City } from "@/lib/geo";
import type { Address, MemberWithAvatar } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const MAX_ADDRESSES = 5; // matches address_limit() in migration 0014
const OPEN_KEY = "atlas-addresses-open";

/** Collapsible list of everyone's addresses. You can manage only your own. */
export function AddressesPanel({
  members,
  addresses,
  meId,
  inUse = [],
}: {
  members: MemberWithAvatar[];
  addresses: Address[];
  meId: string;
  /** Your own addresses that postcards were sent to: retire instead of delete. */
  inUse?: string[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);
  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  }

  // You first, then current members, then former members.
  const ordered = [...members].sort(
    (a, b) => Number(b.id === meId) - Number(a.id === meId) || Number(isFormer(a)) - Number(isFormer(b)),
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded="false"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-white/75 px-4 py-3 text-sm font-medium whitespace-nowrap transition hover:bg-white lg:w-auto"
      >
        <span>Addresses</span>
        <span aria-hidden="true" className="text-ink-soft">
          ▾
        </span>
      </button>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Addresses</h2>
        <button type="button" onClick={toggle} aria-expanded="true" className="text-sm text-ink-soft hover:text-ink">
          Hide ▴
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        Only your group can see these. Postcards are drawn to the address they were sent to.
      </p>
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((m) => (
          <MemberAddresses
            key={m.id}
            member={m}
            isMe={m.id === meId}
            addresses={addresses.filter((a) => a.member_id === m.id)}
            inUse={inUse}
          />
        ))}
      </div>
    </section>
  );
}

function MemberAddresses({
  member,
  isMe,
  addresses: all,
  inUse,
}: {
  member: MemberWithAvatar;
  isMe: boolean;
  addresses: Address[];
  inUse: string[];
}) {
  // Retired ones are history only: hidden, except in your own "Retired" list.
  const addresses = all.filter((a) => !a.retired_at);
  const retired = all.filter((a) => a.retired_at);
  const used = (a: Address) => inUse.includes(a.id);
  const router = useRouter();
  const [mode, setMode] = useState<{ kind: "add" } | { kind: "edit"; id: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...addresses].sort((a, b) => Number(b.is_current) - Number(a.is_current));

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setBusy(key);
    setError(null);
    try {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 border-t border-ink/10 pt-3">
      <div className="flex items-center gap-2">
        <Avatar name={member.display_name} color={member.color} url={member.avatar_url} size={24} />
        <p className="min-w-0 truncate text-sm font-medium">
          {member.display_name}
          {isMe && <span className="ml-1 text-xs font-normal text-ink-soft">(you)</span>}
        </p>
      </div>

      <ul className="space-y-2">
        {sorted.map((a) =>
          mode?.kind === "edit" && mode.id === a.id ? (
            <li key={a.id}>
              <AddressForm
                initial={a}
                note={
                  used(a)
                    ? "Postcards were sent here, so you can only correct it nearby. Moved? Add a new address instead."
                    : undefined
                }
                onCancel={() => setMode(null)}
                onSave={async (input) => {
                  const r = await updateAddress(a.id, input);
                  if (!r.error) {
                    setMode(null);
                    router.refresh();
                  }
                  return r;
                }}
              />
            </li>
          ) : (
            <li key={a.id} className="rounded-xl bg-paper/70 px-3 py-2">
              <p className="flex items-start gap-1.5 text-sm">
                <span className="mt-0.5">
                  <Flag code={a.country_code} size={14} />
                </span>
                <span className="min-w-0 whitespace-pre-line">{a.address_line}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {a.is_current ? (
                  <span className="rounded-full bg-ink px-2 py-0.5 font-medium text-paper">Current</span>
                ) : (
                  <span className="text-ink-soft">Previous</span>
                )}
                {isMe && !a.is_current && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`cur-${a.id}`, () => setCurrentAddress(a.id))}
                    className="font-medium text-stamp hover:underline disabled:opacity-50"
                  >
                    {busy === `cur-${a.id}` ? "Saving…" : "Make current"}
                  </button>
                )}
                {isMe && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setMode({ kind: "edit", id: a.id })}
                    className="font-medium text-ink-soft hover:text-ink"
                  >
                    Edit
                  </button>
                )}
                {isMe && !a.is_current && !used(a) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (confirm("Delete this address?")) run(`del-${a.id}`, () => deleteAddress(a.id));
                    }}
                    className="font-medium text-ink-soft hover:text-stamp"
                  >
                    {busy === `del-${a.id}` ? "Deleting…" : "Delete"}
                  </button>
                )}
                {isMe && !a.is_current && used(a) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    title="Hide it from your list and free up a slot. Postcards sent here stay on the map."
                    onClick={() => run(`ret-${a.id}`, () => retireAddress(a.id))}
                    className="font-medium text-ink-soft hover:text-ink"
                  >
                    {busy === `ret-${a.id}` ? "Retiring…" : "Retire"}
                  </button>
                )}
                {isMe && used(a) && <span className="text-ink-soft">· postcards sent here</span>}
              </div>
            </li>
          ),
        )}
      </ul>

      {isMe && retired.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-soft hover:text-ink">Retired ({retired.length})</summary>
          <ul className="mt-1.5 space-y-1.5">
            {retired.map((a) => (
              <li key={a.id} className="rounded-xl border border-dashed border-ink/15 px-3 py-2">
                <p className="flex items-start gap-1.5 text-ink-soft">
                  <span className="mt-0.5">
                    <Flag code={a.country_code} size={12} />
                  </span>
                  <span className="min-w-0 whitespace-pre-line">{a.address_line}</span>
                </p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`unret-${a.id}`, () => unretireAddress(a.id))}
                  className="mt-1 font-medium text-stamp hover:underline disabled:opacity-50"
                >
                  {busy === `unret-${a.id}` ? "Bringing back…" : "Bring back"}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-ink-soft">Retired addresses stay on the map for the postcards sent there.</p>
        </details>
      )}

      {error && <p className="error text-xs">{error}</p>}

      {isMe &&
        (mode?.kind === "add" ? (
          <AddressForm
            allowMakeCurrent
            onCancel={() => setMode(null)}
            onSave={async (input, makeCurrent) => {
              const r = await addAddress(input, makeCurrent);
              if (!r.error) {
                setMode(null);
                router.refresh();
              }
              return r;
            }}
          />
        ) : addresses.length < MAX_ADDRESSES ? (
          <button
            type="button"
            onClick={() => setMode({ kind: "add" })}
            className="text-sm font-medium text-stamp hover:underline"
          >
            ＋ Add an address
          </button>
        ) : (
          <p className="text-xs text-ink-soft">
            That&apos;s the maximum of {MAX_ADDRESSES} — delete or retire an old one to add another.
          </p>
        ))}
    </div>
  );
}

/**
 * The address exactly as you'd write it on a postcard (free text, any lines),
 * plus the town it's in — the town is all the map needs.
 */
function AddressForm({
  initial,
  note,
  allowMakeCurrent = false,
  onSave,
  onCancel,
}: {
  initial?: Address;
  /** Shown above the fields, e.g. why only small corrections are allowed. */
  note?: string;
  allowMakeCurrent?: boolean;
  onSave: (input: AddressInput, makeCurrent: boolean) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [line, setLine] = useState(initial?.address_line ?? "");
  const [town, setTown] = useState<City | null>(
    initial
      ? { name: initial.city, country: initial.country, countryCode: initial.country_code, lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!line.trim()) return setError("Write the address.");
    if (!town) return setError("Pick the town it's in, for the map.");
    setBusy(true);
    setError(null);
    const r = await onSave({ addressLine: line.trim(), town }, makeCurrent);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink/15 bg-white p-3">
      {note && <p className="text-[11px] text-ink-soft">{note}</p>}
      <div>
        <label className="label !mb-1 text-xs" htmlFor="addr-line">
          Address
        </label>
        <textarea
          id="addr-line"
          rows={3}
          maxLength={300}
          className="input py-2 text-sm"
          placeholder={"Corso Novara 135\n10153 Torino TO\nItaly"}
          value={line}
          onChange={(e) => setLine(e.target.value)}
        />
        <p className="hint !mt-1 text-[11px]">Exactly as you&apos;d write it on a postcard.</p>
      </div>
      <div>
        <label className="label !mb-1 text-xs" htmlFor="addr-town">
          Town, for the map
        </label>
        <CitySearch id="addr-town" value={town} onChange={setTown} placeholder="Which town is it in?" />
      </div>

      {allowMakeCurrent && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
          Make this my current address (where I receive postcards now)
        </label>
      )}

      {error && <p className="error text-xs">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn min-h-9 px-4">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost min-h-9 px-4">
          Cancel
        </button>
      </div>
    </div>
  );
}
