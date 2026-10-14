"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileFields, type ProfileValues } from "@/components/ProfileFields";
import { firstFreeColor, MEMBER_COLORS } from "@/lib/colors";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/upload";
import { errorMessage } from "@/lib/utils";
import { createOrJoinGroup, previewGroup, type GroupPreview as Preview } from "./actions";

export function OnboardingForm({ userId, initialCode }: { userId: string; initialCode: string }) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [mode, setMode] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lookup, setLookup] = useState<"idle" | "loading" | "notfound">("idle");
  const [profile, setProfile] = useState<ProfileValues>({
    displayName: "",
    color: MEMBER_COLORS[0].hex,
    home: null,
    avatarFile: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = code.trim().toUpperCase();

  // Look up the group as soon as a full code is entered.
  useEffect(() => {
    if (mode !== "join" || normalizedCode.length !== 6) {
      setPreview(null);
      setLookup("idle");
      return;
    }
    let cancelled = false;
    setLookup("loading");
    previewGroup(normalizedCode)
      .catch(() => null)
      .then((found) => {
        if (cancelled) return;
        setPreview(found);
        setLookup(found ? "idle" : "notfound");
        if (found) {
          setProfile((p) =>
            found.taken_colors.includes(p.color) ? { ...p, color: firstFreeColor(found.taken_colors) } : p,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, normalizedCode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const displayName = profile.displayName.trim();
    const home = profile.home;
    if (mode === "create" && !groupName.trim()) return setError("Give your group a name.");
    if (mode === "join" && !preview) return setError("Enter a valid invite code.");
    if (!displayName) return setError("Tell your friends your name.");
    if (!home) return setError("Pick your home city from the search results.");

    setBusy(true);
    try {
      const { groupId, error } = await createOrJoinGroup({
        mode,
        groupName: groupName.trim(),
        code: normalizedCode,
        displayName,
        color: profile.color,
        home,
      });
      if (error || !groupId) throw new Error(error ?? "Something went wrong");

      if (profile.avatarFile) {
        try {
          const path = await uploadAvatar(supabase, groupId, userId, profile.avatarFile);
          await supabase.from("members").update({ avatar_path: path }).eq("user_id", userId);
        } catch {
          // Membership exists already; the photo can be added from the profile page.
        }
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const takenColors = mode === "join" ? (preview?.taken_colors ?? []) : [];

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-paper-deep p-1" role="tablist">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`min-h-10 rounded-full text-sm font-medium transition ${
              mode === m ? "bg-white shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "create" ? "Start a group" : "Join a group"}
          </button>
        ))}
      </div>

      <section className="card">
        {mode === "create" ? (
          <div>
            <label className="label" htmlFor="groupName">
              Group name
            </label>
            <input
              id="groupName"
              className="input"
              placeholder="e.g. The Far-Flung Four"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={60}
            />
            <p className="hint">You&apos;ll get an invite code to share once it&apos;s created.</p>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="inviteCode">
              Invite code
            </label>
            <input
              id="inviteCode"
              className="input font-mono text-lg uppercase tracking-[0.3em]"
              placeholder="ABC234"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            {lookup === "loading" && <p className="hint">Looking up group…</p>}
            {lookup === "notfound" && <p className="hint text-stamp">No group found with that code.</p>}
            {preview && (
              <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-sm">
                Joining <strong>{preview.group_name}</strong>
                {preview.member_names.length > 0 && <> with {formatNames(preview.member_names)}</>}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-5 font-display text-xl font-semibold">About you</h2>
        <ProfileFields
          values={profile}
          onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
          takenColors={takenColors}
        />
      </section>

      {error && <p className="error">{error}</p>}

      <button className="btn w-full" disabled={busy}>
        {busy ? "Just a moment…" : mode === "create" ? "Create group" : "Join group"}
      </button>
    </form>
  );
}

function formatNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
