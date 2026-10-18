"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LostDateField } from "@/components/LostDateField";
import { todayLocal } from "@/lib/dates";
import { errorMessage } from "@/lib/utils";
import { markLost, unmarkLost } from "../actions";

/**
 * Sender only. A card in transit: give it up as lost (asks when). A lost card:
 * change the "gave up on" date, or take it back ("on its way after all").
 */
export function LostButton({
  id,
  lost,
  sentOn,
  lostOn,
}: {
  id: string;
  lost: boolean;
  sentOn: string;
  lostOn?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const [date, setDate] = useState(lostOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Today" in the sender's timezone.
  useEffect(() => {
    const t = todayLocal();
    setToday(t);
    setDate((d) => d || t);
  }, []);

  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const r = await action();
      if (r.error) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (open && today) {
    return (
      <span className="block w-full max-w-sm space-y-3 rounded-xl border border-ink/15 bg-white p-3">
        <LostDateField value={date} onChange={setDate} sentOn={sentOn} today={today} id={`lostOn-${id}`} />
        {!lost && (
          <span className="block text-xs text-ink-soft">
            It stops being a surprise: everyone (the recipient too) will see it on the map as lost in the post.
          </span>
        )}
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run(() => markLost(id, date))} disabled={busy || !date} className="btn min-h-9 px-4 text-sm">
            {busy ? "Saving…" : lost ? "Save date" : "Mark as lost"}
          </button>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-ghost min-h-9 px-4 text-sm">
            Cancel
          </button>
        </span>
        {error && <span className="error block text-xs">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className="btn-ghost min-h-9 px-4 text-sm">
        {lost ? "Change date" : "It never arrived — mark as lost"}
      </button>
      {lost && (
        <button type="button" onClick={() => run(() => unmarkLost(id))} disabled={busy} className="btn-ghost min-h-9 px-4 text-sm">
          {busy ? "Saving…" : "It's on its way after all"}
        </button>
      )}
      {error && <span className="error w-full text-xs">{error}</span>}
    </span>
  );
}
