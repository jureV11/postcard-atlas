"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePostcard } from "../actions";

export function DeleteButton({ cardId, groupId }: { cardId: string; groupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Delete this postcard and its photos? This can't be undone.")) return;
    setBusy(true);
    const result = await deletePostcard(cardId, groupId);
    if (result.error) {
      setBusy(false);
      alert(result.error);
      return;
    }
    router.push("/postcards");
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className="text-sm text-stamp hover:underline disabled:opacity-50">
      {busy ? "Deleting…" : "Delete postcard"}
    </button>
  );
}
