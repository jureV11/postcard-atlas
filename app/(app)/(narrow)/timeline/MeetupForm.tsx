"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CitySearch } from "@/components/CitySearch";
import { DateField } from "@/components/DateField";
import { MemberPicker } from "@/components/MemberPicker";
import type { City } from "@/lib/geo";
import { MAX_STOPS } from "@/lib/meetups";
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
};

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
