"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setPostcardAddress } from "@/app/(app)/address-actions";
import { AddressSelect } from "@/components/AddressSelect";
import { todayLocal } from "@/lib/dates";
import type { Address } from "@/lib/types";
import { ArrivalDateField } from "@/components/ArrivalDateField";
import { unmarkReceived, updateReceived } from "../../actions";

export function RecipientEditForm({
  cardId,
  groupId,
  sentOn,
  receivedOn: initialReceivedOn,
  dateUnknown: initialDateUnknown = false,
  message: initialMessage,
  addresses,
  addressId: initialAddressId,
}: {
  cardId: string;
  groupId: string;
  sentOn: string;
  receivedOn: string;
  /** Arrived, but nobody knows when. */
  dateUnknown?: boolean;
  message: string;
  addresses: Address[]; // your own addresses
  addressId: string | null;
}) {
  const router = useRouter();
  const [receivedOn, setReceivedOn] = useState(initialReceivedOn);
  const [dateUnknown, setDateUnknown] = useState(initialDateUnknown);
  const [message, setMessage] = useState(initialMessage);
  const [addressId, setAddressId] = useState<string | null>(initialAddressId);
  const [busy, setBusy] = useState<"save" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => setToday(todayLocal()), []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    if (!receivedOn && !dateUnknown) {
      setBusy(null);
      return setError("When did it arrive? (Or tick “I don’t know”.)");
    }
    const result = await updateReceived(cardId, dateUnknown ? null : receivedOn, message);
    if (result.error) {
      setBusy(null);
      return setError(result.error);
    }
    if (addressId && addressId !== initialAddressId) {
      const r = await setPostcardAddress(cardId, addressId);
      if (r.error) {
        setBusy(null);
        return setError(`Saved, but the address didn't change: ${r.error}`);
      }
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
        <ArrivalDateField
          value={receivedOn}
          onChange={setReceivedOn}
          unknown={dateUnknown}
          onUnknownChange={setDateUnknown}
          min={sentOn}
          max={today}
        />
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
        {addresses.length > 1 && (
          <div>
            <label className="label" htmlFor="sentTo">
              Which of your addresses it came to
            </label>
            <AddressSelect id="sentTo" addresses={addresses} value={addressId} onChange={setAddressId} />
            <p className="hint">Distances and stats follow the address you pick.</p>
          </div>
        )}
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
