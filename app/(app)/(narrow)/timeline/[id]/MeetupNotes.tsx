"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Linkify } from "@/components/Linkify";
import type { MemberWithAvatar } from "@/lib/types";
import { saveMeetupNote } from "../actions";

export type NoteItem = { id: string; body: string; date: string; author: MemberWithAvatar | null; mine: boolean };

const READ_KEY = "postcard-atlas:write-ups-read"; // the write-ups you've chosen to read, on this device
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Everyone's write-ups, each signed; yours can be written, edited or deleted.
 * Other people's start blurred, like a spoiler, so what they remember doesn't
 * shape what you write (#50). Tap one to read it; it stays readable after that.
 */
export function MeetupNotes({
  meetupId,
  notes,
  me,
  max,
}: {
  meetupId: string;
  notes: NoteItem[];
  me: MemberWithAvatar;
  max: number;
}) {
  const router = useRouter();
  const mine = notes.find((n) => n.mine);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = countWords(text);
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setRead(new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]));
    } catch {
      // Private browsing or blocked storage: they just start blurred each time
    }
  }, []);

  function reveal(ids: string[]) {
    const next = new Set([...read, ...ids]);
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {}
  }

  const hidden = notes.filter((n) => !n.mine && !read.has(n.id));

  async function save(body: string) {
    setBusy(true);
    setError(null);
    const { error } = await saveMeetupNote(meetupId, body);
    setBusy(false);
    if (error) return setError(error);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Write-ups</h2>
        {hidden.length > 1 && (
          <button type="button" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline" onClick={() => reveal(hidden.map((n) => n.id))}>
            Show all {hidden.length}
          </button>
        )}
      </div>
      {notes.length === 0 && !editing && <p className="text-sm text-ink-soft">Nobody has written about it yet.</p>}

      {notes.map((n) =>
        n.mine && editing ? null : (
          <article key={n.id} className="card">
            {hidden.includes(n) ? (
              <div className="relative">
                {/* Just the start, blurred: enough to look like writing, too blurry to read */}
                <p aria-hidden="true" className="pointer-events-none max-h-32 overflow-hidden whitespace-pre-line blur-[6px] select-none">
                  {n.body.slice(0, 500)}
                </p>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
                  <button type="button" className="btn-ghost min-h-10 px-4" onClick={() => reveal([n.id])}>
                    Read {n.author ? `${n.author.display_name}'s` : "their"} write-up
                  </button>
                  <p className="rounded-full bg-paper/80 px-2.5 py-0.5 text-xs text-ink-soft">
                    {countWords(n.body).toLocaleString("en")} words · hidden so it doesn&apos;t shape yours
                  </p>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-line">
                <Linkify text={n.body} />
              </p>
            )}
            <footer className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              {n.author && <Avatar name={n.author.display_name} color={n.author.color} url={n.author.avatar_url} size={24} />}
              {/* Signed off like a letter */}
              <span>
                — <span className="font-medium text-ink">{n.author?.display_name ?? "Someone"}</span> · {n.date}
              </span>
              {n.mine && (
                <button type="button" className="ml-auto font-medium text-ink hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </footer>
          </article>
        ),
      )}

      {editing || !mine ? (
        editing ? (
          <div className="card space-y-3">
            <label htmlFor="note" className="label flex items-center gap-2">
              <Avatar name={me.display_name} color={me.color} url={me.avatar_url} size={24} />
              Your write-up
            </label>
            <textarea
              id="note"
              className="input min-h-40"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={max}
              placeholder="What happened, what you'll remember… Links work too: [our video](https://youtu.be/…)"
            />
            <p className="hint -mt-1 text-right tabular-nums">
              {words.toLocaleString("en")} {words === 1 ? "word" : "words"}
              {text.length > max * 0.9 && ` · ${(max - text.length).toLocaleString("en")} characters left`}
            </p>
            {error && <p className="error">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => save(text)}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  setText(mine?.body ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              {mine && (
                <button
                  type="button"
                  className="ml-auto text-sm font-medium text-stamp hover:underline"
                  disabled={busy}
                  onClick={() => confirm("Delete your write-up?") && save("")}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            ✎ Write about it
          </button>
        )
      ) : null}
    </section>
  );
}
