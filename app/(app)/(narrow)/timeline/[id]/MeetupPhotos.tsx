"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadMeetupPhoto } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import { addMeetupPhotos, removeMeetupPhoto, setMainPhoto } from "../actions";

export type PhotoItem = { id: string; url: string | null; isMain: boolean; canRemove: boolean; by: string | null };

/** The main photo big, the rest in a strip; add more (up to the limit), pick the main one, take one down. */
export function MeetupPhotos({
  meetupId,
  groupId,
  photos,
  max,
}: {
  meetupId: string;
  groupId: string;
  photos: PhotoItem[];
  max: number;
}) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const input = useRef<HTMLInputElement>(null);
  const [shownId, setShownId] = useState<string | null>(null); // by id, so it stays put when the order changes
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null); // full-screen photo, by position
  const room = max - photos.length;
  const current = photos.find((p) => p.id === shownId) ?? photos[0];

  async function add(files: File[]) {
    if (!files.length) return;
    setError(null);
    const picked = files.slice(0, room);
    try {
      const paths: string[] = [];
      for (const [i, file] of picked.entries()) {
        setBusy(picked.length > 1 ? `Uploading ${i + 1} of ${picked.length}…` : "Uploading…");
        paths.push(await uploadMeetupPhoto(supabase, groupId, meetupId, file));
      }
      const { error } = await addMeetupPhotos(meetupId, paths);
      if (error) throw new Error(error);
      if (files.length > picked.length) setError(`Only ${picked.length} added: a meetup can have up to ${max} photos.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function run(label: string, action: () => Promise<{ error?: string }>) {
    setError(null);
    setBusy(label);
    const { error } = await action();
    setBusy(null);
    if (error) setError(error);
    else router.refresh();
  }

  return (
    <section className="space-y-3">
      {current && (
        <figure className="overflow-hidden rounded-[6px] bg-[#fffdf8] p-2 shadow-[0_1px_2px_rgb(42_38_34/0.1),0_14px_28px_-16px_rgb(42_38_34/0.5)] ring-1 ring-ink/10">
          <button
            type="button"
            onClick={() => setViewing(photos.indexOf(current))}
            aria-label="View full screen"
            className="flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-[3px] bg-paper-deep"
          >
            {current.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </button>
          <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-2 text-xs text-ink-soft">
            {current.by && <span>Added by {current.by}</span>}
            {current.isMain ? (
              <span className="font-medium text-ink">★ Main photo</span>
            ) : (
              <button
                type="button"
                className="font-medium text-ink hover:underline"
                disabled={!!busy}
                onClick={() => run("Saving…", () => setMainPhoto(meetupId, current.id))}
              >
                Make main photo
              </button>
            )}
            {current.canRemove && (
              <button
                type="button"
                className="ml-auto font-medium text-stamp hover:underline"
                disabled={!!busy}
                onClick={() => {
                  if (confirm("Take this photo down?")) {
                    setShownId(null);
                    run("Removing…", () => removeMeetupPhoto(current.id));
                  }
                }}
              >
                Remove
              </button>
            )}
          </figcaption>
        </figure>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setShownId(p.id)}
            aria-label={`Photo ${i + 1}`}
            className={`size-16 shrink-0 overflow-hidden rounded-[4px] ring-2 transition ${
              p.id === current?.id ? "ring-stamp" : "ring-transparent hover:ring-ink/30"
            }`}
          >
            {p.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
            )}
          </button>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={!!busy}
            className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[4px] border-[1.5px] border-dashed border-ink/30 text-xs text-ink-soft hover:border-ink/60 hover:text-ink"
          >
            <span className="text-xl leading-none">+</span>
            Photo
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add([...(e.target.files ?? [])])}
      />
      <p className="text-xs text-ink-soft">
        {busy ?? (photos.length ? `${photos.length} of ${max} photos` : `No photos yet: add up to ${max}.`)}
      </p>
      {error && <p className="error">{error}</p>}
      {viewing !== null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          onChange={setViewing}
          onClose={() => {
            setShownId(photos[Math.min(viewing, photos.length - 1)].id); // land on the photo you stopped at
            setViewing(null);
          }}
        />
      )}
    </section>
  );
}

/** Full screen, one photo at a time: arrows, arrow keys or a swipe to go through them, Esc to close. */
function Lightbox({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: PhotoItem[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const go = (step: number) => onChange((index + step + photos.length) % photos.length);
  const swipeFrom = useRef<number | null>(null);
  const swiped = useRef(false); // a swipe isn't also a tap that closes it
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stays put
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  const arrow = "absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/15 text-2xl text-paper hover:bg-paper/30";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1714]/95 p-4 sm:p-14"
      onClick={() => !swiped.current && onClose()}
      onPointerDown={(e) => (swipeFrom.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = swipeFrom.current === null ? 0 : e.clientX - swipeFrom.current;
        swipeFrom.current = null;
        swiped.current = Math.abs(dx) > 50;
        if (swiped.current) go(dx < 0 ? 1 : -1);
      }}
    >
      {photo.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt=""
          className="max-h-full max-w-full rounded-[3px] object-contain shadow-2xl select-none"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <p className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-sm text-paper/80 tabular-nums">
        {index + 1} / {photos.length}
      </p>
      <button
        type="button"
        aria-label="Close"
        className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-paper/15 text-xl text-paper hover:bg-paper/30"
        onClick={onClose}
      >
        ✕
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            className={`${arrow} left-3`}
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            className={`${arrow} right-3`}
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
