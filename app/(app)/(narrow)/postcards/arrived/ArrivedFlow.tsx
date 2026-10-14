"use client";

import { useMemo, useState } from "react";
import countries from "i18n-iso-countries";
import { MemberPicker } from "@/components/MemberPicker";
import { formatDate } from "@/lib/dates";
import type { MemberWithAvatar } from "@/lib/types";
import { findIncoming } from "../actions";
import { ReceiveForm } from "../[id]/ReceiveForm";

type Match = { id: string; sentOn: string; hasMessage: boolean };

/** Step 1: match the physical card to its mystery entry. Step 2: date, photos, reveal. */
export function ArrivedFlow({ groupId, senders }: { groupId: string; senders: MemberWithAvatar[] }) {
  const [senderId, setSenderId] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return Object.keys(countries.getAlpha2Codes())
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!senderId) return setError("Who signed the postcard?");
    if (!country) return setError("Which country is the stamp from?");
    setBusy(true);
    // Both must match — a wrong name or country just finds nothing, so the wrong
    // card can never be revealed by mistake.
    const result = await findIncoming(senderId, country);
    setBusy(false);
    if (result.match) setMatch(result.match);
    else setError(result.error ?? "Something went wrong");
  }

  if (match) {
    const sender = senders.find((s) => s.id === senderId);
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <strong>Found it!</strong> The postcard {sender?.display_name} sent on {formatDate(match.sentOn)}. Add the
          date and photos to reveal it.
        </p>
        <section className="card">
          <ReceiveForm cardId={match.id} groupId={groupId} sentOn={match.sentOn} needsMessage={!match.hasMessage} />
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={find} className="card space-y-5">
      <div>
        <p className="label">Who&apos;s it from?</p>
        <MemberPicker
          members={senders}
          value={senderId}
          onChange={(id) => {
            setSenderId(id);
            setError(null);
          }}
        />
        <p className="hint">Check the signature on the card.</p>
      </div>

      <div>
        <label className="label" htmlFor="country">
          Which country is the stamp from?
        </label>
        <select
          id="country"
          className="input"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setError(null);
          }}
        >
          <option value="">Choose a country…</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="hint">Look at the stamp or postmark. Both answers have to match before anything is revealed.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn w-full" disabled={busy}>
        {busy ? "Looking…" : "Find my postcard"}
      </button>
    </form>
  );
}
