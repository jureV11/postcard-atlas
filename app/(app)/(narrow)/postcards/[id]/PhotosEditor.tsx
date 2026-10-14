"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/PhotoPicker";
import { createClient } from "@/lib/supabase/client";
import { uploadPostcardPhoto } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import { setPostcardPhotos } from "../actions";

export function PhotosEditor({
  cardId,
  groupId,
  frontUrl,
  backUrl,
}: {
  cardId: string;
  groupId: string;
  frontUrl: string | null;
  backUrl: string | null;
}) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const [frontPath, backPath] = await Promise.all([
        front ? uploadPostcardPhoto(supabase, groupId, cardId, "front", front) : null,
        back ? uploadPostcardPhoto(supabase, groupId, cardId, "back", back) : null,
      ]);
      const result = await setPostcardPhotos(cardId, frontPath, backPath);
      if (result.error) throw new Error(result.error);
      setFront(null);
      setBack(null);
      router.replace(`/postcards/${cardId}`); // also clears ?photoError
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoPicker label="Front" file={front} onChange={setFront} currentUrl={frontUrl} />
        <PhotoPicker label="Back" file={back} onChange={setBack} currentUrl={backUrl} />
      </div>
      {error && <p className="error">{error}</p>}
      {(front || back) && (
        <button type="button" className="btn" onClick={save} disabled={busy}>
          {busy ? "Uploading…" : "Save photos"}
        </button>
      )}
    </div>
  );
}
