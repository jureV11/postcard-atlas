"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CitySearch } from "@/components/CitySearch";
import { DateField } from "@/components/DateField";
import { Flag } from "@/components/Flag";
import { MemberPicker } from "@/components/MemberPicker";
import type { City } from "@/lib/geo";
import { MAX_STOPS, pickedFlags } from "@/lib/meetups";
import type { MemberWithAvatar } from "@/lib/types";
import { deleteMeetup, saveMeetup } from "./actions";

export type PostcardOption = { id: string; label: string };

export type MeetupFormValues = {
  id?: string;
  title: string;
  startsOn: string;
  endsOn: string;
  places: (City | null)[]; // in the order you went; an empty one is a search still to fill in
  memberIds: string[];
  postcardId: string;
  flagCodes: string[]; // picked by hand (#65); empty = the first place's flag
};

/**
 * A trip through several countries: which flags it shows on the timeline (#65), so a
 * quick stop on the way doesn't stand for the whole trip. At least one stays on.
 */
function Flags({ places, picked, onChange }: { places: City[]; picked: string[]; onChange: (codes: string[]) => void }) {
  const countries = [...new Map(places.map((p) => [p.countryCode, p.country])).entries()];
  if (countries.length < 2) return null;
  const on = pickedFlags(
    countries.map(([code]) => code),
    picked,
  );
  const toggle = (code: string) => {
    const next = on.includes(code) ? on.filter((c) => c !== code) : [...on, code];
    if (next.length) onChange(countries.map(([c]) => c).filter((c) => next.includes(c))); // keep the order you went
  };

  return (
    <div>
      <p className="label">Flags on the timeline</p>
      <div className="flex flex-wrap gap-2">
        {countries.map(([code, name]) => {
          const active = on.includes(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(code)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
                active ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink-soft hover:border-ink/40 hover:text-ink"
              }`}
            >
              <Flag code={code} size={14} />
              {name || code}
              {active && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      <p className="hint">
        Tap the countries the trip was really about. Only these count in the Countries stat, so a quick stop on the way
        can stay off.
      </p>
    </div>
  );
}

/**
 * Where it was: one city, or a trip through several in the order you went (#45).
 * Each gets a pin, and a trip's are joined up on the maps.
 */
function Places({ places, onChange }: { places: (City | null)[]; onChange: (places: (City | null)[]) => void }) {
  const rows = places.length ? places : [null];
  const trip = rows.length > 1;
  const update = (i: number, city: City | null) => onChange(rows.map((p, j) => (j === i ? city : p)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const moveUp = (i: number) => onChange(rows.map((p, j) => (j === i - 1 ? rows[i] : j === i ? rows[i - 1] : p)));

  return (
    <div>
      <label htmlFor="place-0" className="label">
        Where
      </label>
      <ol className="space-y-2">
        {rows.map((city, i) => (
          <li key={i} className="flex items-center gap-2">
            {trip && (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper tabular-nums">
                {i + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <CitySearch
                id={`place-${i}`}
                value={city}
                onChange={(c) => update(i, c)}
                placeholder={i ? "Then where?" : "Search for a city…"}
                compact={trip}
              />
            </div>
            {trip && (
              <span className="flex shrink-0">
                {i > 0 && (
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink"
                    aria-label={`Move place ${i + 1} earlier`}
                    onClick={() => moveUp(i)}
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep hover:text-stamp"
                  aria-label={`Remove place ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  ✕
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {rows[rows.length - 1] && rows.length <= MAX_STOPS && (
        <button type="button" className="mt-2 text-left text-sm font-medium text-ink hover:underline" onClick={() => onChange([...rows, null])}>
          + {trip ? "Add the next place" : "Add another place (a trip through several)"}
        </button>
      )}
      <p className="hint">
        {trip ? "In the order you went. Each gets a pin, joined up on the map." : "Shown with a pin on a little map."}
      </p>
    </div>
  );
}

/** Add a meetup, or change one. Photos and write-ups go on the meetup's own page. */
export function MeetupForm({
  initial,
  members,
  postcards,
  canDelete = false,
}: {
  initial: MeetupFormValues;
  members: MemberWithAvatar[];
  postcards: PostcardOption[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MeetupFormValues>(key: K, value: MeetupFormValues[K]) => setV((old) => ({ ...old, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.title.trim()) return setError("Give the meetup a name.");
    if (!v.startsOn) return setError("When was it?");
    if (v.endsOn && v.endsOn < v.startsOn) return setError("It can't end before it starts.");
    if (new Set(v.memberIds).size < 2) return setError("Add who else was there: a meetup needs at least two people.");
    setBusy(true);
    const { id, error } = await saveMeetup({
      id: v.id,
      title: v.title,
      startsOn: v.startsOn,
      endsOn: v.endsOn || null,
      places: v.places.filter((p): p is City => !!p),
      memberIds: v.memberIds,
      postcardId: v.postcardId || null,
      flagCodes: v.flagCodes,
      hadFlags: initial.flagCodes.length > 0,
    });
    setBusy(false);
    if (error) return setError(error);
    router.push(`/timeline/${id}`);
    router.refresh();
  }

  async function remove() {
    if (!v.id || !confirm("Delete this meetup, with its photos and write-ups? This can't be undone.")) return;
    setBusy(true);
    const { error } = await deleteMeetup(v.id);
    setBusy(false);
    if (error) return setError(error);
    router.push("/timeline");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div>
        <label htmlFor="title" className="label">
          What was it?
        </label>
        <input
          id="title"
          className="input"
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Summer trip to Lisbon"
          maxLength={120}
        />
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="starts" className="label">
            When
          </label>
          <DateField id="starts" value={v.startsOn} onChange={(d) => set("startsOn", d)} />
        </div>
        <div>
          <label htmlFor="ends" className="label">
            Until <span className="font-normal text-ink-soft">(if it was more than a day)</span>
          </label>
          <DateField id="ends" value={v.endsOn} onChange={(d) => set("endsOn", d)} clearable />
        </div>
      </div>

      <Places places={v.places} onChange={(places) => set("places", places)} />
      <Flags places={v.places.filter((p): p is City => !!p)} picked={v.flagCodes} onChange={(codes) => set("flagCodes", codes)} />

      <div>
        <p className="label">Who was there</p>
        <MemberPicker multiple members={members} value={v.memberIds} onChange={(ids) => set("memberIds", ids)} />
        <p className="hint">At least two people. Anyone who was there can take down photos of the meetup.</p>
      </div>

      {postcards.length > 0 && (
        <div>
          <label htmlFor="postcard" className="label">
            A postcard about it <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <select id="postcard" className="input" value={v.postcardId} onChange={(e) => set("postcardId", e.target.value)}>
            <option value="">None</option>
            {postcards.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : v.id ? "Save changes" : "Add to the timeline"}
        </button>
        {canDelete && (
          <button type="button" onClick={remove} disabled={busy} className="ml-auto text-sm font-medium text-stamp hover:underline">
            Delete meetup
          </button>
        )}
      </div>
    </form>
  );
}
