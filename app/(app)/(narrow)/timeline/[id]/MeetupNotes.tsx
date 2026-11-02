"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Linkify } from "@/components/Linkify";
import type { MemberWithAvatar } from "@/lib/types";
import { saveMeetupNote } from "../actions";

export type NoteItem = { id: string; body: string; date: string; author: MemberWithAvatar | null; mine: boolean };

/** Everyone's write-ups, each signed; yours can be written, edited or deleted. */
export function MeetupNotes({ meetupId, notes, me }: { meetupId: string; notes: NoteItem[]; me: MemberWithAvatar }) {
  const router = useRouter();
  const mine = notes.find((n) => n.mine);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <h2 className="font-display text-xl font-semibold">Write-ups</h2>
      {notes.length === 0 && !editing && <p className="text-sm text-ink-soft">Nobody has written about it yet.</p>}

      {notes.map((n) =>
        n.mine && editing ? null : (
          <article key={n.id} className="card">
            <p className="whitespace-pre-line">
              <Linkify text={n.body} />
            </p>
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
              maxLength={4000}
              placeholder="What happened, what you'll remember… Links work too: [our video](https://youtu.be/…)"
            />
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
