"use client";

import { useState } from "react";
import { setPassword } from "./actions";

export function PasswordForm() {
  const [password, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await setPassword(password);
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      setPw("");
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <p className="text-sm text-ink-soft">Set or change the password you sign in with.</p>
      </div>
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        placeholder="New password (8+ characters)"
        minLength={8}
        value={password}
        onChange={(e) => {
          setPw(e.target.value);
          setSaved(false);
        }}
        required
      />
      {error && <p className="error">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn-ghost" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
        {saved && <span className="text-sm text-ink-soft">Password saved ✓</span>}
      </div>
    </form>
  );
}
