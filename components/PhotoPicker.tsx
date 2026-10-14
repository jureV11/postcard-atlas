"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pick one side of a postcard. On phones, "image/*" offers both camera and photo library.
 * With `currentUrl`, shows the existing photo until a replacement is chosen.
 */
export function PhotoPicker({
  label,
  file,
  onChange,
  currentUrl,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  currentUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? currentUrl ?? null;
  const smallBtn = "rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
      {shown ? (
        <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt={label} className="aspect-[3/2] w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-paper">
            {label}
            {preview && currentUrl ? " (new)" : ""}
          </span>
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button type="button" className={smallBtn} onClick={() => inputRef.current?.click()}>
              Replace
            </button>
            {preview && (
              <button type="button" className={smallBtn} onClick={() => onChange(null)}>
                {currentUrl ? "Undo" : "Remove"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/15 bg-white/50 text-ink-soft transition hover:border-ink/30 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-sm font-medium">Add {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}
