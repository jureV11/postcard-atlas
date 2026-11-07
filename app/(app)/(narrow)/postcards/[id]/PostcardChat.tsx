"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Linkify } from "@/components/Linkify";
import { formatDate } from "@/lib/dates";
import { MAX_COMMENT, REACTIONS, type CommentRow, type Reaction, type ReactionRow } from "@/lib/postcardChat";
import type { MemberWithAvatar } from "@/lib/types";
import { addComment, deleteComment, editComment, toggleReaction } from "./chat-actions";

const andList = (list: string[]) =>
  list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;

/** Emoji reactions and comments under a postcard: anyone who can see the card can join in. */
export function PostcardChat({
  cardId,
  reactions: saved,
  comments,
  people,
  me,
  heads,
}: {
  cardId: string;
  reactions: ReactionRow[];
  comments: CommentRow[];
  people: MemberWithAvatar[]; // everyone who might have reacted or commented
  me: MemberWithAvatar;
  heads: string | null; // who can see it for now, while the card isn't public yet
}) {
  const router = useRouter();
  const [reactions, setReactions] = useState(saved);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const person = (id: string) => (id === me.id ? me : people.find((p) => p.id === id));

  async function react(emoji: Reaction) {
    const on = !reactions.some((r) => r.emoji === emoji && r.member_id === me.id);
    const before = reactions;
    // Show it straight away; put it back if saving fails
    setReactions(on ? [...reactions, { emoji, member_id: me.id }] : reactions.filter((r) => !(r.emoji === emoji && r.member_id === me.id)));
    setError(null);
    const { error } = await toggleReaction(cardId, emoji, on);
    if (error) {
      setReactions(before);
      setError(error);
    }
  }

  async function run(fn: () => Promise<{ error?: string }>, done: () => void) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setError(error);
    done();
    router.refresh();
  }

  const used = REACTIONS.map((emoji) => ({ emoji, who: reactions.filter((r) => r.emoji === emoji).map((r) => r.member_id) })).filter(
    (r) => r.who.length,
  );

  return (
    <section id="comments" className="card scroll-mt-24 space-y-5">
      {/* Tap one to add yours, tap it again to take it back */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1 sm:gap-1.5" role="group" aria-label="Reactions">
          {REACTIONS.map((emoji) => {
            const count = reactions.filter((r) => r.emoji === emoji).length;
            const mine = reactions.some((r) => r.emoji === emoji && r.member_id === me.id);
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                onClick={() => react(emoji)}
                className={`flex min-h-10 items-center gap-1 rounded-full border px-2 text-lg sm:px-3 leading-none transition active:scale-95 ${
                  mine
                    ? "border-stamp/60 bg-stamp/10"
                    : count
                      ? "border-ink/15 bg-white"
                      : "border-ink/10 bg-paper/60 opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0"
                }`}
              >
                <span aria-hidden="true">{emoji}</span>
                {count > 0 && <span className="text-sm font-medium tabular-nums text-ink">{count}</span>}
                <span className="sr-only">{mine ? "Take back your reaction" : "React"}</span>
              </button>
            );
          })}
        </div>
        {used.length > 0 && (
          <p className="text-xs text-ink-soft">
            {used.map((r, i) => (
              <span key={r.emoji}>
                {i > 0 && " · "}
                {r.emoji} {andList(r.who.map((id) => (id === me.id ? "you" : (person(id)?.display_name ?? "someone"))))}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="space-y-4 border-t border-ink/10 pt-4">
        <h2 className="font-display text-xl font-semibold">
          Comments{comments.length > 0 && <span className="text-ink-soft"> · {comments.length}</span>}
        </h2>
        {heads && <p className="-mt-2 text-sm text-ink-soft">{heads}</p>}

        {comments.length > 0 && (
          <ul className="space-y-4">
            {comments.map((c) => {
              const author = person(c.member_id);
              const mine = c.member_id === me.id;
              return (
                <li key={c.id} className="flex gap-3">
                  <span className="shrink-0 pt-0.5">
                    {author && <Avatar name={author.display_name} color={author.color} url={author.avatar_url} size={32} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium">{author?.display_name ?? "Someone"}</span>
                      <span className="text-xs text-ink-soft">
                        {formatDate(c.created_at.slice(0, 10))}
                        {c.edited_at && " · edited"}
                      </span>
                      {mine && editing !== c.id && (
                        <span className="ml-auto flex gap-3 text-xs font-medium">
                          <button
                            type="button"
                            className="text-ink-soft hover:text-ink hover:underline"
                            onClick={() => {
                              setEditing(c.id);
                              setDraft(c.body);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-stamp hover:underline"
                            disabled={busy}
                            onClick={() => confirm("Delete your comment?") && run(() => deleteComment(cardId, c.id), () => {})}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </p>
                    {editing === c.id ? (
                      <div className="mt-1.5 space-y-2">
                        <label htmlFor={`edit-${c.id}`} className="sr-only">
                          Your comment
                        </label>
                        <textarea
                          id={`edit-${c.id}`}
                          className="input min-h-20"
                          value={draft}
                          maxLength={MAX_COMMENT}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn min-h-9 px-4"
                            disabled={busy || !draft.trim()}
                            onClick={() => run(() => editComment(cardId, c.id, draft), () => setEditing(null))}
                          >
                            Save
                          </button>
                          <button type="button" className="btn-ghost min-h-9 px-4" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-line break-words">
                        <Linkify text={c.body} />
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addComment(cardId, text), () => setText(""));
          }}
        >
          <span className="hidden shrink-0 pb-1.5 sm:block">
            <Avatar name={me.display_name} color={me.color} url={me.avatar_url} size={32} />
          </span>
          <label htmlFor="comment" className="sr-only">
            Write a comment
          </label>
          <textarea
            id="comment"
            rows={1}
            className="input min-h-11 flex-1 resize-y"
            placeholder={comments.length ? "Write a reply…" : "Write a comment…"}
            value={text}
            maxLength={MAX_COMMENT}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a computer; Shift+Enter, or the return key on a phone, starts a new line
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn min-h-11 shrink-0 px-4" disabled={busy || !text.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
