"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup } from "./actions";

export function LeaveGroupButton({
  groupName,
  isOwner,
  heirName,
  isLastMember,
}: {
  groupName: string;
  isOwner: boolean;
  heirName: string | null; // who becomes owner if the owner leaves
  isLastMember: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    const lines = [`Leave "${groupName}"?`, ""];
    lines.push("Your postcards stay in the group's history, shown as \"(former member)\".");
    if (isLastMember) {
      lines.push("You're the last member — the group will be empty. Its postcards are kept, and whoever joins next becomes the owner.");
    } else if (isOwner && heirName) {
      lines.push(`You're the owner — ownership passes to ${heirName}.`);
    }
    lines.push("You can rejoin with the invite code any time and get your profile back.");
    if (!confirm(lines.join("\n"))) return;

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
            Your postcards stay in the group&apos;s history.
            {isLastMember
              ? " You're the last member, so the group would be empty."
              : isOwner && heirName
                ? ` Ownership would pass to ${heirName}.`
                : ""}
          </p>
        </div>
        <button type="button" onClick={leave} disabled={busy} className="btn-ghost shrink-0 text-stamp">
          {busy ? "Leaving…" : "Leave group"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
