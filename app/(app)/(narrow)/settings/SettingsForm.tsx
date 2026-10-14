"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfileFields, type ProfileValues } from "@/components/ProfileFields";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { uploadAvatar } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";

export function SettingsForm({
  member,
  avatarUrl,
  takenColors,
}: {
  member: Member;
  avatarUrl: string | null;
  takenColors: string[];
}) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [profile, setProfile] = useState<ProfileValues>({
    displayName: member.display_name,
    color: member.color,
    home: {
      name: member.home_city,
      country: member.home_country,
      countryCode: member.home_country_code,
      lat: member.home_lat,
      lng: member.home_lng,
    },
    avatarFile: null,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const displayName = profile.displayName.trim();
    if (!displayName) return setError("Your name can't be empty.");

    setBusy(true);
    let newPath: string | null = null;
    try {
      if (profile.avatarFile) {
        // Your own, current membership — only former members have no account attached.
        newPath = await uploadAvatar(supabase, member.group_id, member.user_id!, profile.avatarFile);
      }

      const { error } = await supabase
        .from("members")
        .update({
          // Home now follows your current address (Map page → Addresses).
          display_name: displayName,
          color: profile.color,
          ...(newPath ? { avatar_path: newPath } : {}),
        })
        .eq("id", member.id);

      if (error) {
        if (error.code === "23505") throw new Error("Someone just took that colour — pick another.");
        throw error;
      }

      if (newPath && member.avatar_path) {
        await supabase.storage.from("avatars").remove([member.avatar_path]);
      }

      setProfile((p) => ({ ...p, avatarFile: null }));
      setSaved(true);
      router.refresh();
    } catch (err) {
      if (newPath) await supabase.storage.from("avatars").remove([newPath]);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <ProfileFields
        values={profile}
        onChange={(patch) => {
          setSaved(false);
          setProfile((p) => ({ ...p, ...patch }));
        }}
        takenColors={takenColors}
        currentAvatarUrl={avatarUrl}
        showHome={false}
      />
      <p className="text-sm text-ink-soft">
        Moved house? Add your new address and make it current under{" "}
        <Link href="/" className="font-medium text-stamp hover:underline">
          Map → Addresses
        </Link>
        .
      </p>
      {error && <p className="error">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-ink-soft">Saved ✓</span>}
      </div>
    </form>
  );
}
