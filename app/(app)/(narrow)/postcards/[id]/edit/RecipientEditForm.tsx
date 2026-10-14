"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";
import { unmarkReceived, updateReceived } from "../../actions";

export function RecipientEditForm({
  cardId,
  groupId,
  sentOn,
  receivedOn: initialReceivedOn,
  message: initialMessage,
}: {
  cardId: string;
  groupId: string;
  sentOn: string;
  receivedOn: string;
  message: string;
}) {
  const router = useRouter();
  const [receivedOn, setReceivedOn] = useState(initialReceivedOn);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState<"save" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => setToday(todayLocal()), []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    const result = await updateReceived(cardId, receivedOn, message);
    if (result.error) {
      setBusy(null);
      return setError(result.error);
    }
    router.push(`/postcards/${cardId}`);
    router.refresh();
  }

  async function undo() {
    if (
      !confirm(
        "Undo receiving this postcard? It goes back to being a mystery in transit and its photos are removed. Use this if you matched the wrong card.",
      )
    )
      return;
    setError(null);
    setBusy("undo");
    const result = await unmarkReceived(cardId, groupId);
    if (result.error) {
      setBusy(null);
      return setError(result.error);
    }
    router.push("/postcards/arrived");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card space-y-5">
        <div>
          <label className="label" htmlFor="receivedOn">
            Date received
          </label>
          <input
            id="receivedOn"
            type="date"
            className="input"
            min={sentOn}
            max={today}
            value={receivedOn}
            onChange={(e) => setReceivedOn(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="message">
            Message <span className="font-normal text-ink-soft">(what&apos;s written on the card)</span>
          </label>
          <textarea
            id="message"
            className="input min-h-28"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn w-full" disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="card flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Matched the wrong card?</p>
          <p className="text-sm text-ink-soft">Put it back in transit and match your postcard again.</p>
        </div>
        <button type="button" onClick={undo} disabled={busy !== null} className="btn-ghost shrink-0 text-stamp">
          {busy === "undo" ? "Undoing…" : "Undo received"}
        </button>
      </section>
    </div>
  );
}
