"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Linkify } from "@/components/Linkify";
import { createClient } from "@/lib/supabase/client";
import { uploadMeetupPhoto } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import {
  addMeetupPhotos,
  moveMeetupPhoto,
  removeMeetupPhoto,
  reorderMeetupPhotos,
  setMainPhoto,
  setPhotoCaption,
  setPhotoFocus,
} from "../actions";

export type PhotoItem = {
  id: string;
  url: string | null;
  isMain: boolean;
  canRemove: boolean;
  by: string | null;
  caption: string | null;
  focusX: number | null; // which part shows where it's cropped, in % (empty = the middle)
  focusY: number | null;
};

const focusOf = (p: { focusX: number | null; focusY: number | null }) => `${p.focusX ?? 50}% ${p.focusY ?? 50}%`;

/**
 * The photo you picked big, all of them in a strip in their order; add more (up to
 * the limit), caption them, move them (one step, or drag them all into order),
 * pick the main one and which part of it shows on the timeline, take one down.
 */
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
  const current = photos.find((p) => p.id === shownId) ?? photos.find((p) => p.isMain) ?? photos[0];
  const at = current ? photos.indexOf(current) : -1;
  const [captioning, setCaptioning] = useState(false);
  const [caption, setCaption] = useState("");
  const [framing, setFraming] = useState<{ x: number; y: number } | null>(null); // choosing the part shown on the timeline
  const [order, setOrder] = useState<string[] | null>(null); // while reordering: the photo ids, in their new order
  const [dragging, setDragging] = useState<string | null>(null);
  const grid = useRef<HTMLOListElement>(null);
  const press = useRef<{ x: number; y: number; timer?: number } | null>(null);
  const drag = useRef<string | null>(null);
  const arranging = order !== null;

  // Dragging photos into order. A mouse drags straight away; a finger holds a moment
  // first, so a quick swipe still scrolls the page. While a photo is held, the page
  // doesn't scroll, unless you take it near the top or bottom edge.
  useEffect(() => {
    if (!arranging) return;
    const stop = () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
      press.current = null;
      drag.current = null;
      setDragging(null);
    };
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      const id = drag.current;
      if (!p) return;
      if (!id) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) stop(); // moved before the hold: a scroll
        return;
      }
      // The slot nearest the finger is where it goes
      const slots = [...(grid.current?.children ?? [])].map((el) => el.getBoundingClientRect());
      const to = slots.reduce(
        (best, r, i) => {
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          return d < best.d ? { i, d } : best;
        },
        { i: -1, d: Infinity },
      ).i;
      setOrder((o) => {
        if (!o || to < 0 || o.indexOf(id) === to) return o;
        const next = o.filter((x) => x !== id);
        next.splice(to, 0, id);
        return next;
      });
      if (e.clientY < 80) scrollBy(0, -14);
      else if (e.clientY > innerHeight - 110) scrollBy(0, 14); // above the tab bar on phones
    };
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current) e.preventDefault();
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", stop);
    addEventListener("pointercancel", stop);
    addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", stop);
      removeEventListener("pointercancel", stop);
      removeEventListener("touchmove", onTouchMove);
      stop();
    };
  }, [arranging]);

  function pickUp(e: React.PointerEvent, id: string) {
    if (e.button > 0) return;
    const begin = () => {
      drag.current = id;
      setDragging(id);
      navigator.vibrate?.(12);
    };
    press.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "mouse") {
      e.preventDefault();
      begin();
    } else press.current.timer = window.setTimeout(begin, 250);
  }

  function saveOrder() {
    const ids = order;
    setOrder(null);
    if (ids && ids.some((id, i) => photos[i]?.id !== id)) run("Saving the order…", () => reorderMeetupPhotos(meetupId, ids));
  }

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
      {current && !arranging && (
        <figure className="overflow-hidden rounded-[6px] bg-[#fffdf8] p-2 shadow-[0_1px_2px_rgb(42_38_34/0.1),0_14px_28px_-16px_rgb(42_38_34/0.5)] ring-1 ring-ink/10">
          {framing ? (
            <div className="space-y-3">
              <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[3px] bg-paper-deep">
                {current.url && (
                  <span className="relative inline-flex max-h-full max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.url}
                      alt=""
                      draggable={false}
                      className="max-h-full max-w-full cursor-crosshair object-contain select-none"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setFraming({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgb(194_80_58),0_2px_8px_rgb(0_0_0/0.4)]"
                      style={{ left: `${framing.x}%`, top: `${framing.y}%` }}
                    />
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 px-1">
                <div className="w-36 shrink-0 rounded-[3px] bg-[#fffdf8] p-1.5 shadow ring-1 ring-ink/10">
                  <div className="aspect-[4/3] overflow-hidden rounded-[2px] bg-paper-deep">
                    {current.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.url} alt="" className="size-full object-cover" style={{ objectPosition: `${framing.x}% ${framing.y}%` }} />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p className="text-ink-soft">Tap the faces (or whatever matters most): the timeline keeps that part in view.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn min-h-9 px-4"
                      disabled={!!busy}
                      onClick={() => {
                        const f = framing;
                        setFraming(null);
                        run("Saving…", () => setPhotoFocus(current.id, f.x, f.y));
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="btn-ghost min-h-9 px-4" onClick={() => setFraming(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setViewing(at)}
              aria-label="View full screen"
              className="flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-[3px] bg-paper-deep"
            >
              {current.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt="" className="max-h-full max-w-full object-contain" />
              )}
            </button>
          )}
          {captioning ? (
            <form
              className="flex gap-2 px-1 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                setCaptioning(false);
                run("Saving…", () => setPhotoCaption(current.id, caption));
              }}
            >
              <input
                className="input min-h-9 flex-1 py-1.5 text-sm"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                placeholder="What's happening here?"
                aria-label="Caption"
                autoFocus
              />
              <button type="submit" className="btn min-h-9 px-4" disabled={!!busy}>
                Save
              </button>
              <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => setCaptioning(false)}>
                Cancel
              </button>
            </form>
          ) : (
            current.caption && (
              <p className="px-1 pt-2 font-hand text-xl leading-snug">
                <Linkify text={current.caption} />
              </p>
            )
          )}
          <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-2 text-xs text-ink-soft">
            {current.by && <span>Added by {current.by}</span>}
            {!captioning && (
              <button
                type="button"
                className="font-medium text-ink hover:underline"
                onClick={() => {
                  setCaption(current.caption ?? "");
                  setCaptioning(true);
                }}
              >
                {current.caption ? "Edit caption" : "Add a caption"}
              </button>
            )}
            {current.isMain ? (
              <>
                <span className="font-medium text-ink">★ Main photo</span>
                {!framing && (
                  <button
                    type="button"
                    className="font-medium text-ink hover:underline"
                    onClick={() => setFraming({ x: current.focusX ?? 50, y: current.focusY ?? 50 })}
                  >
                    Choose what shows on the timeline
                  </button>
                )}
              </>
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
            {photos.length > 1 && (
              <span className="-my-1.5 flex items-center">
                <button
                  type="button"
                  aria-label="Move this photo earlier"
                  className="flex size-8 items-center justify-center rounded-full text-sm font-medium text-ink hover:bg-paper-deep disabled:opacity-30"
                  disabled={!!busy || at === 0}
                  onClick={() => run("Moving…", () => moveMeetupPhoto(meetupId, current.id, -1))}
                >
                  ◂
                </button>
                Move
                <button
                  type="button"
                  aria-label="Move this photo later"
                  className="flex size-8 items-center justify-center rounded-full text-sm font-medium text-ink hover:bg-paper-deep disabled:opacity-30"
                  disabled={!!busy || at === photos.length - 1}
                  onClick={() => run("Moving…", () => moveMeetupPhoto(meetupId, current.id, 1))}
                >
                  ▸
                </button>
              </span>
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

      {order ? (
        <div className="space-y-3 rounded-[6px] border-[1.5px] border-dashed border-ink/25 p-3">
          <p className="text-sm text-ink-soft">
            Drag the photos into the order you want. On a phone, press and hold one for a moment, then drag.
          </p>
          <ol ref={grid} className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {order.map((id, i) => {
              const p = photos.find((x) => x.id === id);
              if (!p) return null;
              return (
                <li
                  key={id}
                  onPointerDown={(e) => pickUp(e, id)}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`relative aspect-square cursor-grab overflow-hidden rounded-[4px] bg-paper-deep select-none [-webkit-touch-callout:none] ${
                    dragging === id ? "z-10 scale-110 cursor-grabbing shadow-xl ring-2 ring-stamp" : "transition-transform"
                  }`}
                >
                  {p.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" draggable={false} className="pointer-events-none size-full object-cover" style={{ objectPosition: focusOf(p) }} />
                  )}
                  <span className="absolute bottom-0.5 left-0.5 rounded-full bg-ink/70 px-1.5 font-mono text-[10px] leading-4 text-paper tabular-nums">
                    {p.isMain ? "★ " : ""}
                    {i + 1}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex gap-2">
            <button type="button" className="btn min-h-10 px-5" onClick={saveOrder}>
              Done
            </button>
            <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => setOrder(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setShownId(p.id)}
              aria-label={`Photo ${i + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-[4px] ring-2 transition ${
                p.id === current?.id ? "ring-stamp" : "ring-transparent hover:ring-ink/30"
              }`}
            >
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="size-full object-cover" style={{ objectPosition: focusOf(p) }} loading="lazy" />
              )}
              {p.isMain && (
                <span className="absolute top-0.5 left-0.5 rounded-full bg-ink/70 px-1 text-[10px] leading-4 text-paper" aria-label="Main photo">
                  ★
                </span>
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
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add([...(e.target.files ?? [])])}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">
          {busy ?? (photos.length ? `${photos.length} of ${max} photos` : `No photos yet: add up to ${max}.`)}
        </p>
        {photos.length > 1 && !arranging && (
          <button
            type="button"
            className="text-sm font-medium text-ink hover:underline"
            disabled={!!busy}
            onClick={() => {
              setFraming(null);
              setOrder(photos.map((p) => p.id));
            }}
          >
            ⇄ Reorder photos
          </button>
        )}
      </div>
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

const ZOOM = 2.5;

/**
 * Full screen, one photo at a time: arrows, arrow keys or a swipe to go through them,
 * Esc to close. Tap the photo to zoom in there; move the mouse (or drag) to look
 * around, tap again to zoom out.
 */
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
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null); // the zoomed-in point, 0–1 across and down
  const img = useRef<HTMLImageElement>(null);
  const base = useRef<DOMRect | null>(null); // the photo's size before zooming
  const down = useRef<{ x: number; y: number; zoom: { x: number; y: number } | null } | null>(null);
  const go = (step: number) => {
    setZoom(null);
    onChange((index + step + photos.length) % photos.length);
  };
  const photo = photos[index];
  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (zoom ? setZoom(null) : onClose());
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

  function onPointerMove(e: React.PointerEvent) {
    const b = base.current;
    if (!zoom || !b) return;
    const start = down.current;
    if (start?.zoom) {
      // Dragging: the photo follows the finger
      const k = ZOOM - 1;
      setZoom({ x: clamp(start.zoom.x - (e.clientX - start.x) / (b.width * k)), y: clamp(start.zoom.y - (e.clientY - start.y) / (b.height * k)) });
    } else if (e.pointerType === "mouse") {
      // A mouse just looks around wherever it points
      setZoom({ x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = down.current;
    down.current = null;
    if (!start || (e.target as Element).closest("button, a")) return;
    const dx = e.clientX - start.x;
    const moved = Math.hypot(dx, e.clientY - start.y) > 10;
    if (zoom) {
      if (!moved) setZoom(null); // a tap zooms back out
    } else if (moved) {
      if (Math.abs(dx) > 50 && photos.length > 1) go(dx < 0 ? 1 : -1); // a swipe
    } else if (e.target === img.current && img.current) {
      const r = img.current.getBoundingClientRect();
      base.current = r;
      setZoom({ x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) });
    } else onClose(); // a tap beside the photo
  }

  const arrow = "absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/15 text-2xl text-paper hover:bg-paper/30";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#1a1714]/95 p-4 sm:p-14 ${zoom ? "touch-none" : ""}`}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY, zoom })}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)}
    >
      {photo.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={photo.url}
          alt={photo.caption ?? ""}
          className={`max-h-full max-w-full rounded-[3px] object-contain shadow-2xl select-none ${
            zoom ? "cursor-zoom-out" : "cursor-zoom-in transition-transform duration-200"
          }`}
          style={zoom ? { transform: `scale(${ZOOM})`, transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%` } : undefined}
          draggable={false}
        />
      )}
      <p className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-sm text-paper/80 tabular-nums">
        {index + 1} / {photos.length}
      </p>
      {photo.caption && !zoom && (
        <p className="absolute inset-x-4 bottom-4 mx-auto max-w-2xl text-center font-hand text-2xl leading-snug text-paper">
          <Linkify text={photo.caption} />
        </p>
      )}
      <button
        type="button"
        aria-label="Close"
        className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-paper/15 text-xl text-paper hover:bg-paper/30"
        onClick={onClose}
      >
        ✕
      </button>
      {photos.length > 1 && !zoom && (
        <>
          <button type="button" aria-label="Previous photo" className={`${arrow} left-3`} onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Next photo" className={`${arrow} right-3`} onClick={() => go(1)}>
            ›
          </button>
        </>
      )}
    </div>
  );
}
