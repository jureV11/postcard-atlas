"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CitySearch } from "@/components/CitySearch";
import { MEMBER_COLORS } from "@/lib/colors";
import type { City } from "@/lib/geo";

export type ProfileValues = {
  displayName: string;
  color: string;
  home: City | null;
  avatarFile: File | null;
};

export function ProfileFields({
  values,
  onChange,
  takenColors,
  currentAvatarUrl,
}: {
  values: ProfileValues;
  onChange: (patch: Partial<ProfileValues>) => void;
  takenColors: string[];
  currentAvatarUrl?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!values.avatarFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(values.avatarFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [values.avatarFile]);

  const shownUrl = previewUrl ?? currentAvatarUrl ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={values.displayName || "?"} color={values.color} url={shownUrl} size={64} />
        <div>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            {shownUrl ? "Change photo" : "Add a photo"}
          </button>
          <p className="hint">Optional</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange({ avatarFile: file });
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <label className="label" htmlFor="displayName">
          Your name
        </label>
        <input
          id="displayName"
          className="input"
          value={values.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          maxLength={40}
          autoComplete="given-name"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="homeCity">
          Home city
        </label>
        <CitySearch
          id="homeCity"
          value={values.home}
          onChange={(home) => onChange({ home })}
          placeholder="Search for your city…"
        />
        <p className="hint">Postcards sent to you land here on the map.</p>
      </div>

      <fieldset>
        <legend className="label">Your colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {MEMBER_COLORS.map((c) => {
            const taken = takenColors.includes(c.hex);
            const selected = values.color === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                disabled={taken}
                aria-pressed={selected}
                aria-label={taken ? `${c.name} (taken)` : c.name}
                title={taken ? `${c.name} — taken` : c.name}
                onClick={() => onChange({ color: c.hex })}
                className={`size-9 rounded-full transition ${
                  selected ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                } ${taken ? "cursor-not-allowed opacity-20" : "hover:scale-110"}`}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
        <p className="hint">Your home country is highlighted in this colour.</p>
      </fieldset>
    </div>
  );
}
