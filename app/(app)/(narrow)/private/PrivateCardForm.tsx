"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CitySearch } from "@/components/CitySearch";
import { PhotoPicker } from "@/components/PhotoPicker";
import { todayLocal } from "@/lib/dates";
import type { City } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { uploadPrivatePhoto } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import { deletePrivateCard, savePrivateCard, setPrivatePhotos } from "./actions";

export type PrivateCardValues = {
  id?: string;
  direction: "sent" | "received";
  person: string;
  from: City | null;
  sentOn: string;
  receivedOn: string;
  message: string;
  note: string;
  frontUrl: string | null;
  backUrl: string | null;
};

/** One private postcard: sent to, or received from, someone outside the group. */
export function PrivateCardForm({ initial, userId }: { initial: PrivateCardValues; userId: string }) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [v, setV] = useState(initial);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PrivateCardValues>(key: K, value: PrivateCardValues[K]) => setV((old) => ({ ...old, [key]: value }));
  const sent = v.direction === "sent";

  // A new card defaults to today, in the person's own timezone
  useEffect(() => {
    if (!initial.id) setV((old) => ({ ...old, sentOn: old.sentOn || todayLocal() }));
  }, [initial.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.sentOn) return setError("When was it sent?");
    if (v.receivedOn && v.receivedOn < v.sentOn) return setError("It can't arrive before it was sent.");
    try {
      setBusy("Saving…");
      const { id, error } = await savePrivateCard({
        id: v.id,
        direction: v.direction,
        person: v.person,
        from: v.from,
        sentOn: v.sentOn,
        receivedOn: v.receivedOn || null,
        message: v.message,
        note: v.note,
      });
      if (error || !id) throw new Error(error ?? "Couldn't save the postcard");
      if (front || back) {
        setBusy("Uploading photos…");
        const [frontPath, backPath] = await Promise.all([
          front ? uploadPrivatePhoto(supabase, userId, id, "front", front) : null,
          back ? uploadPrivatePhoto(supabase, userId, id, "back", back) : null,
        ]);
        const r = await setPrivatePhotos(id, frontPath, backPath);
        if (r.error) throw new Error(`Saved, but the photos didn't: ${r.error}`);
      }
      router.push("/private");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function remove() {
    if (!v.id || !confirm("Delete this postcard and its photos? This can't be undone.")) return;
    setBusy("Deleting…");
    const { error } = await deletePrivateCard(v.id);
    if (error) {
      setBusy(null);
      return setError(error);
    }
    router.push("/private");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sent or received">
        {(["sent", "received"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={v.direction === d}
            onClick={() => set("direction", d)}
            className={`min-h-11 rounded-[6px] border-[1.5px] text-sm font-semibold transition ${
              v.direction === d ? "border-ink bg-ink text-paper" : "border-ink/20 bg-[#fffdf8] hover:border-ink/50"
            }`}
          >
            {d === "sent" ? "I sent it" : "I received it"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoPicker label="Front" file={front} onChange={setFront} currentUrl={v.frontUrl} />
        <PhotoPicker label="Back" file={back} onChange={setBack} currentUrl={v.backUrl} />
      </div>

      <div>
        <label htmlFor="person" className="label">
          {sent ? "Sent to" : "From"} <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <input
          id="person"
          className="input"
          value={v.person}
          onChange={(e) => set("person", e.target.value)}
          placeholder={sent ? "Grandma" : "My cousin"}
          maxLength={120}
        />
      </div>

      <div>
        <label htmlFor="from" className="label">
          {sent ? "Sent from" : "Posted from"}
        </label>
        <CitySearch id="from" value={v.from} onChange={(c) => set("from", c)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sent" className="label">
            Date sent
          </label>
          <input id="sent" type="date" className="input" value={v.sentOn} onChange={(e) => set("sentOn", e.target.value)} />
        </div>
        <div>
          <label htmlFor="received" className="label">
            Date received <span className="font-normal text-ink-soft">(if known)</span>
          </label>
          <input
            id="received"
            type="date"
            className="input"
            value={v.receivedOn}
            min={v.sentOn || undefined}
            onChange={(e) => set("receivedOn", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="label">
          What it says <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea
          id="message"
          className="input min-h-28 font-display italic"
          value={v.message}
          onChange={(e) => set("message", e.target.value)}
          maxLength={4000}
          placeholder="Greetings from…"
        />
      </div>

      <div>
        <label htmlFor="note" className="label">
          Notes for yourself
        </label>
        <textarea id="note" className="input min-h-28" value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={4000} />
      </div>

      {error && <p className="error">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={!!busy}>
          {busy ?? (v.id ? "Save changes" : "Save postcard")}
        </button>
        {v.id && (
          <button type="button" onClick={remove} disabled={!!busy} className="ml-auto text-sm font-medium text-stamp hover:underline">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
