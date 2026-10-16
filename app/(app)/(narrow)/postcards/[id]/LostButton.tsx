"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/utils";
import { markLost, unmarkLost } from "../actions";

/** Sender only: give a card up as lost, or take that back. */
export function LostButton({ id, lost }: { id: string; lost: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (
      !lost &&
      !confirm(
        "Mark this postcard as lost?\n\nIt stops being a surprise: everyone (the recipient too) will see it on the map as lost in the post.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const r = lost ? await unmarkLost(id) : await markLost(id);
      if (r.error) setError(r.error);
      else router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={busy} className="btn-ghost min-h-9 px-4 text-sm">
        {busy ? "Saving…" : lost ? "It's on its way after all" : "It never arrived — mark as lost"}
      </button>
      {error && <span className="error text-xs">{error}</span>}
    </span>
  );
}
