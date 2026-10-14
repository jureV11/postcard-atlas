"use client";

import { useEffect, useState } from "react";

export function InviteCard({ code, groupName }: { code: string; groupName: string }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/join/${code}`);
    setCanShare(typeof navigator.share === "function");
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked on plain-http LAN addresses; the code is still visible.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${groupName} on Postcard Atlas`, url: link });
    } catch {
      // User cancelled the share sheet.
    }
  }

  return (
    <section className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-medium text-ink-soft">Invite code</h2>
        <p className="font-mono text-3xl font-semibold tracking-[0.25em]">{code}</p>
      </div>
      <div className="flex gap-2">
        {canShare && (
          <button type="button" className="btn" onClick={share}>
            Share invite
          </button>
        )}
        <button type="button" className={canShare ? "btn-ghost" : "btn"} onClick={copy} disabled={!link}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
