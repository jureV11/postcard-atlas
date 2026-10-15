"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAddress,
  deleteAddress,
  searchAddress,
  setCurrentAddress,
  updateAddress,
  type FoundAddress,
} from "@/app/(app)/address-actions";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { isFormer } from "@/lib/members";
import type { Address, MemberWithAvatar } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const MAX_ADDRESSES = 3;
const OPEN_KEY = "atlas-addresses-open";

/** Collapsible list of everyone's addresses. You can manage only your own. */
export function AddressesPanel({
  members,
  addresses,
  meId,
}: {
  members: MemberWithAvatar[];
  addresses: Address[];
  meId: string;
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
          <span className="lg:hidden">▾</span>
          <span className="hidden lg:inline">›</span>
        </span>
      </button>
    );
  }

  return (
    <section className="card space-y-4 lg:max-h-[calc(100dvh-10rem)] lg:w-[300px] lg:overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Addresses</h2>
        <button type="button" onClick={toggle} aria-expanded="true" className="text-sm text-ink-soft hover:text-ink">
          <span className="lg:hidden">Hide ▴</span>
          <span className="hidden lg:inline">‹ Hide</span>
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        Only your group can see these. Postcards are drawn to the address they were sent to.
      </p>
      {ordered.map((m) => (
        <MemberAddresses
          key={m.id}
          member={m}
          isMe={m.id === meId}
          addresses={addresses.filter((a) => a.member_id === m.id)}
        />
      ))}
    </section>
  );
}

function MemberAddresses({ member, isMe, addresses }: { member: MemberWithAvatar; isMe: boolean; addresses: Address[] }) {
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
    <div className="space-y-2 border-t border-ink/10 pt-3 first-of-type:border-0 first-of-type:pt-0">
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
                initial={a.address_line}
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
                <span className="min-w-0">{a.address_line}</span>
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
                {isMe && !a.is_current && (
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
              </div>
            </li>
          ),
        )}
      </ul>

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
          <p className="text-xs text-ink-soft">That&apos;s the maximum of 3 — delete an old one to add another.</p>
        ))}
    </div>
  );
}

/** Type a full address → "Find" (OpenStreetMap) → pick the right match → save. */
function AddressForm({
  initial = "",
  allowMakeCurrent = false,
  onSave,
  onCancel,
}: {
  initial?: string;
  allowMakeCurrent?: boolean;
  onSave: (input: { addressLine: string; found: FoundAddress }, makeCurrent: boolean) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<FoundAddress[] | null>(null);
  const [chosen, setChosen] = useState<FoundAddress | null>(null);
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setBusy(true);
    setError(null);
    setChosen(null);
    const r = await searchAddress(query);
    setBusy(false);
    if (r.error) {
      setResults(null);
      setError(r.error);
      return;
    }
    setResults(r.results ?? []);
    if (r.results?.length === 1) setChosen(r.results[0]);
  }

  async function save() {
    if (!chosen) return setError("Pick the matching address from the list.");
    setBusy(true);
    setError(null);
    const r = await onSave({ addressLine: query.trim(), found: chosen }, makeCurrent);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink/15 bg-white p-3">
      <label className="label !mb-1 text-xs" htmlFor="addr">
        Full address
      </label>
      <div className="flex gap-2">
        <input
          id="addr"
          className="input min-h-10 py-2 text-sm"
          placeholder="Corso Novara, 135, 10153 Torino TO, Italy"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults(null);
            setChosen(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
        />
        <button type="button" onClick={find} disabled={busy} className="btn-ghost min-h-10 shrink-0 px-3">
          {busy && !results ? "…" : "Find"}
        </button>
      </div>

      {results && results.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs text-ink-soft">Which one is it?</legend>
          {results.map((r, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-xs hover:bg-paper">
              <input type="radio" name="addr-match" checked={chosen === r} onChange={() => setChosen(r)} className="mt-0.5" />
              <span>
                <Flag code={r.countryCode} size={12} /> {r.label}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {allowMakeCurrent && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
          Make this my current address (where I receive postcards now)
        </label>
      )}

      {error && <p className="error text-xs">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || !chosen} className="btn min-h-9 px-4">
          {busy && results ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost min-h-9 px-4">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-ink-soft">Address lookup by OpenStreetMap.</p>
    </div>
  );
}
