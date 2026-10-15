"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setPostcardAddress } from "@/app/(app)/address-actions";
import { AddressSelect, currentAddressId } from "@/components/AddressSelect";
import { CitySearch } from "@/components/CitySearch";
import { confetti } from "@/components/Confetti";
import { flagUrl } from "@/lib/flags";
import { MemberPicker } from "@/components/MemberPicker";
import { todayLocal } from "@/lib/dates";
import type { City } from "@/lib/geo";
import type { Address, MemberWithAvatar } from "@/lib/types";
import { logPostcard } from "../actions";

// No photos here on purpose: the recipient photographs the card when it arrives.
export function NewPostcardForm({ recipients, addresses }: { recipients: MemberWithAvatar[]; addresses: Address[] }) {
  const router = useRouter();
  // Several recipients = one card each, same trip (revealed together once all arrive).
  const [recipientIds, setRecipientIds] = useState<string[]>(recipients.length === 1 ? [recipients[0].id] : []);
  // Which address each card goes to: the recipient's current one unless changed (e.g. a card sent in the past).
  const [chosenAddress, setChosenAddress] = useState<Record<string, string>>({});
  const addressesOf = (memberId: string) => addresses.filter((a) => a.member_id === memberId);
  const addressFor = (memberId: string) => chosenAddress[memberId] ?? currentAddressId(addressesOf(memberId));
  const [from, setFrom] = useState<City | null>(null);
  const [sentOn, setSentOn] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set on the client so "today" is in the sender's timezone.
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    setToday(todayLocal());
    setSentOn(todayLocal());
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!recipientIds.length) return setError("Who is the postcard for?");
    if (!from) return setError("Pick the city you're sending it from.");
    if (!sentOn) return setError("When did you send it?");

    const ids: string[] = [];
    for (const [i, recipientId] of recipientIds.entries()) {
      setStatus(recipientIds.length > 1 ? `Saving ${i + 1} of ${recipientIds.length}…` : "Saving…");
      const { id, error } = await logPostcard({ recipientId, from, sentOn, message, note });
      if (error || !id) {
        setStatus(null);
        const saved = ids.length ? ` (${ids.length} saved before this one)` : "";
        return setError((error ?? "Couldn't save the postcard") + saved);
      }
      ids.push(id);
      // New cards go to the recipient's current address automatically; only an older one needs saving.
      const addressId = addressFor(recipientId);
      if (addressId && addressId !== currentAddressId(addressesOf(recipientId))) {
        const r = await setPostcardAddress(id, addressId);
        if (r.error) {
          setStatus(null);
          return setError(`Saved, but couldn't set the address: ${r.error} — you can change it with Edit on the postcard.`);
        }
      }
    }
    // Celebrate: paper confetti plus the flag of where it was sent from (keeps going on the next page).
    confetti({ flags: [flagUrl(from.countryCode)], flagCount: 10, paperCount: 70 });
    router.push(ids.length === 1 ? `/postcards/${ids[0]}` : "/postcards");
  }

  const busy = status !== null;

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-5">
        <div>
          <p className="label">To</p>
          <MemberPicker members={recipients} multiple value={recipientIds} onChange={setRecipientIds} />
          <p className="hint">
            {recipientIds.length > 1
              ? `${recipientIds.length} cards — one each. They're revealed to everyone together, once they've all arrived.`
              : "Sending from here to several people? Pick them all."}
          </p>
        </div>
        {recipientIds.length > 0 && (
          <div className="space-y-3">
            {recipientIds.map((rid) => {
              const r = recipients.find((x) => x.id === rid);
              const own = addressesOf(rid);
              if (!r || own.length === 0) return null;
              return (
                <div key={rid}>
                  <label className="label" htmlFor={`addr-${rid}`}>
                    Sent to {recipientIds.length > 1 ? `${r.display_name}'s address` : "address"}
                  </label>
                  {own.length > 1 ? (
                    <AddressSelect
                      id={`addr-${rid}`}
                      addresses={own}
                      value={addressFor(rid)}
                      onChange={(id) => setChosenAddress((c) => ({ ...c, [rid]: id }))}
                    />
                  ) : (
                    <p className="text-sm text-ink-soft">{own[0].address_line}</p>
                  )}
                </div>
              );
            })}
            {recipientIds.some((rid) => addressesOf(rid).length > 1) && (
              <p className="hint !mt-1">Logging a card from before someone moved? Pick their old address.</p>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="fromCity">
            Sent from
          </label>
          <CitySearch id="fromCity" value={from} onChange={setFrom} placeholder="Which city are you in?" />
        </div>
        <div>
          <label className="label" htmlFor="sentOn">
            Date sent
          </label>
          <input
            id="sentOn"
            type="date"
            className="input"
            value={sentOn}
            max={today}
            onChange={(e) => setSentOn(e.target.value)}
            required
          />
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="message">
            Message <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="message"
            className="input min-h-28"
            placeholder="Type out what you wrote on the card…"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="note">
            Note <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="note"
            className="input"
            placeholder="e.g. Found it in a tiny shop by the harbour"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <p className="hint !mt-2">
          Nobody else can see this card — or that it exists — until it arrives.
          {recipientIds.length > 1 && " The message goes on every card; you can edit each one afterwards."}
        </p>
      </section>

      <p className="text-center text-sm text-ink-soft">
        No photos needed — the recipient snaps the front and back when it lands in their mailbox.
      </p>

      {error && <p className="error">{error}</p>}

      <button className="btn w-full" disabled={busy}>
        {status ?? "Send it off"}
      </button>
    </form>
  );
}
