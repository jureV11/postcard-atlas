"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CitySearch } from "@/components/CitySearch";
import { MemberPicker } from "@/components/MemberPicker";
import type { City } from "@/lib/geo";
import type { MemberWithAvatar } from "@/lib/types";
import { deleteMeetup, saveMeetup } from "./actions";

export type PostcardOption = { id: string; label: string };

export type MeetupFormValues = {
  id?: string;
  title: string;
  startsOn: string;
  endsOn: string;
  place: City | null;
  memberIds: string[];
  postcardId: string;
};

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
      place: v.place,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="starts" className="label">
            When
          </label>
          <input id="starts" type="date" className="input" value={v.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
        </div>
        <div>
          <label htmlFor="ends" className="label">
            Until <span className="font-normal text-ink-soft">(if it was more than a day)</span>
          </label>
          <input
            id="ends"
            type="date"
            className="input"
            value={v.endsOn}
            min={v.startsOn || undefined}
            onChange={(e) => set("endsOn", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="place" className="label">
          Where
        </label>
        <CitySearch id="place" value={v.place} onChange={(c) => set("place", c)} />
        <p className="hint">Shown with a pin on a little map.</p>
      </div>

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
