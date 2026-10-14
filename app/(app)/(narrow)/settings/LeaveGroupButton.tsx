"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup } from "./actions";

export function LeaveGroupButton({ groupName }: { groupName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    if (!confirm(`Leave "${groupName}"? You can join another group (or this one again) with an invite code.`)) return;
    setBusy(true);
    setError(null);
    const result = await leaveGroup();
    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">Leave group</p>
          <p className="text-sm text-ink-soft">
            Only possible if you haven&apos;t sent or received any postcards here.
          </p>
        </div>
        <button type="button" onClick={leave} disabled={busy} className="btn-ghost shrink-0 text-stamp">
          {busy ? "Leaving…" : "Leave"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
