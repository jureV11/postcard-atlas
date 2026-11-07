import type { InboxMessage } from "@/lib/inbox";
import { requireMember } from "@/lib/session";
import { deleteMessage, markInboxRead, restoreMessage, setMessageRead } from "./actions";

const ICONS: Record<InboxMessage["kind"], string> = { arrived: "📬", achievement: "🏅", meetup: "🗓️", comment: "💬" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ deleted?: string; gone?: string }> }) {
  const { deleted, gone } = await searchParams; // just binned: offer "Undo". Gone: what a message pointed to was deleted
  const { supabase, member } = await requireMember();
  const { data } = await supabase
    .from("inbox_messages")
    .select("*")
    .eq("member_id", member.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const messages = (data ?? []) as InboxMessage[];
  const unread = messages.filter((m) => !m.read_at).length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-ink-soft">
            {unread ? `${unread} new` : "All caught up"} · cards arriving, comments, achievements and meetups you&apos;re in.
          </p>
        </div>
        {unread > 0 && (
          <form action={markInboxRead}>
            <button className="btn-ghost min-h-9 px-3">Mark all as read</button>
          </form>
        )}
      </div>

      {deleted && (
        <div className="flex items-center justify-between gap-3 rounded-[6px] bg-ink px-4 py-2.5 text-sm text-paper" role="status">
          Message deleted
          <form action={restoreMessage.bind(null, deleted)}>
            <button className="font-semibold underline underline-offset-2 hover:text-white">Undo</button>
          </form>
        </div>
      )}

      {gone && (
        <p className="rounded-[6px] bg-paper-deep px-4 py-2.5 text-sm" role="status">
          {gone === "meetup" ? "That meetup isn't on the timeline anymore: someone deleted it." : "That postcard isn't there anymore."}
        </p>
      )}

      {messages.length === 0 ? (
        <div className="card text-center">
          <p className="font-display text-xl font-semibold">Nothing here yet</p>
          <p className="mt-1 text-ink-soft">You&apos;ll get a note when a card you sent arrives, when someone comments on your cards, when you unlock an achievement, or when someone adds you to a meetup.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => {
            const inner = (
              <>
                <span className="text-2xl" aria-hidden="true">
                  {ICONS[m.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.title}</span>
                    {!m.read_at && <span className="shrink-0 rounded-full bg-stamp px-1.5 text-[10px] font-bold text-white uppercase">New</span>}
                  </span>
                  <span className="block text-sm text-ink-soft">{m.body}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft/80">{when(m.created_at)}</span>
                </span>
              </>
            );
            // Unread: a fresh white card with a red edge. Read: greyed back into the paper.
            const look = m.read_at
              ? "border-ink/10 bg-paper-deep/40 opacity-70 hover:opacity-100"
              : "border-l-4 border-stamp/60 border-l-stamp bg-white shadow-sm";
            return (
              <li key={m.id} className={`flex items-stretch overflow-hidden rounded-[6px] border transition ${look}`}>
                {/* Opening it marks it read, then goes where it points */}
                <a href={`/inbox/open/${m.id}`} className="flex min-w-0 flex-1 items-start gap-3 p-4">
                  {inner}
                </a>
                {/* The envelope toggles: sealed = unread, open = read. Hovering shows what a click does. */}
                <form action={setMessageRead.bind(null, m.id, !m.read_at)} className="flex shrink-0">
                  <button
                    className={`group/env flex items-center px-4 transition hover:bg-paper-deep/50 ${m.read_at ? "text-ink-soft" : "text-stamp"}`}
                    title={m.read_at ? "Mark as unread" : "Mark as read"}
                    aria-label={m.read_at ? "Mark as unread" : "Mark as read"}
                  >
                    <span className="group-hover/env:hidden">
                      <Envelope open={!!m.read_at} />
                    </span>
                    <span className="hidden group-hover/env:inline">
                      <Envelope open={!m.read_at} />
                    </span>
                  </button>
                </form>
                <form action={deleteMessage.bind(null, m.id)} className="flex shrink-0 border-l border-ink/10">
                  <button
                    className="flex items-center px-3 text-ink-soft/70 transition hover:bg-stamp/10 hover:text-stamp"
                    title="Delete"
                    aria-label="Delete this message"
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
                    </svg>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Just now", "3 h ago", "2 days ago", then the date. */
function when(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A little envelope: sealed, or opened with the letter peeking out. */
function Envelope({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 28 24" className="h-6 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M6 12V4h16v8" fill="#fffdf8" />
          <path d="M9 7h10M9 10h7" strokeWidth="1.2" />
          <path d="M3 10l11-8 11 8" />
          <path d="M3 10v12h22V10l-11 7z" fill="#fffdf8" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="22" height="16" rx="1.5" fill="#fffdf8" />
          <path d="M3.5 6l10.5 8 10.5-8" />
        </>
      )}
    </svg>
  );
}
