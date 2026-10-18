"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/PhotoPicker";
import { todayLocal } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { uploadPostcardPhoto } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import { ArrivalDateField } from "@/components/ArrivalDateField";
import { markReceived, setPostcardPhotos } from "../actions";

export function ReceiveForm({
  cardId,
  groupId,
  sentOn,
  needsMessage,
}: {
  cardId: string;
  groupId: string;
  sentOn: string;
  needsMessage: boolean;
}) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [receivedOn, setReceivedOn] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [today, setToday] = useState<string | undefined>(undefined);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToday(todayLocal());
    setReceivedOn(todayLocal());
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!receivedOn && !dateUnknown) return setError("When did it arrive? (Or tick “I don’t know”.)");
    if (!front && !back && !confirm("Reveal it without photos? You can still add them afterwards.")) return;

    try {
      if (front || back) {
        setStatus("Uploading photos…");
        const [frontPath, backPath] = await Promise.all([
          front ? uploadPostcardPhoto(supabase, groupId, cardId, "front", front) : null,
          back ? uploadPostcardPhoto(supabase, groupId, cardId, "back", back) : null,
        ]);
        const photos = await setPostcardPhotos(cardId, frontPath, backPath);
        if (photos.error) throw new Error(photos.error);
      }

      setStatus("Revealing…");
      const result = await markReceived(cardId, dateUnknown ? null : receivedOn, message);
      if (result.error) throw new Error(result.error);
      router.push(`/postcards/${cardId}`); // the big reveal
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setStatus(null);
    }
  }


  return (
    <form onSubmit={submit} className="space-y-5">
      <ArrivalDateField
        value={receivedOn}
        onChange={setReceivedOn}
        unknown={dateUnknown}
        onUnknownChange={setDateUnknown}
        min={sentOn}
        max={today}
      />

      <div>
        <p className="label">Photos</p>
        <p className="mb-3 text-sm text-ink-soft">
          Snap the front and back — this is how everyone gets to see the card.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoPicker label="Front" file={front} onChange={setFront} />
          <PhotoPicker label="Back" file={back} onChange={setBack} />
        </div>
      </div>

      {needsMessage && (
        <div>
          <label className="label" htmlFor="message">
            Message <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="message"
            className="input min-h-24"
            placeholder="Type out what they wrote…"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn w-full" disabled={status !== null}>
        {status ?? "Mark as received"}
      </button>
    </form>
  );
}
