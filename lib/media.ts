import "server-only";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PostgrestClient } from "@supabase/postgrest-js";
import type { Bucket } from "@/lib/storage";
import { getIdentity } from "@/lib/identity";

const buckets = new Set<Bucket>(["avatars", "postcards", "meetups", "private-postcards"]);

function filePath(bucket: string, name: string): string {
  if (!buckets.has(bucket as Bucket) || !name || name.length > 500 ||
      name.split("/").some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || part === "." || part === "..")) {
    throw new Error("Invalid media path");
  }
  if (!/\.(jpe?g|png|webp)$/.test(name)) throw new Error("Invalid media type");
  return path.join(process.env.MEDIA_ROOT || "/data", bucket, name);
}

export async function canUseMedia(client: PostgrestClient, bucket: Bucket, name: string, mode: "read" | "write" | "delete") {
  filePath(bucket, name);
  const [first, second] = name.split("/");
  const identity = await getIdentity();
  if (bucket === "avatars") {
    const { data } = await client.from("members").select("id,group_id,user_id,avatar_path").eq("group_id", first);
    return mode === "read"
      ? !!data?.some((m) => m.avatar_path === name)
      : !!data?.some((m) => m.user_id === identity.id && m.user_id === second);
  }
  if (bucket === "private-postcards") {
    if (first !== identity.id) return false;
    const { data } = await client.from("private_postcards").select("front_path,back_path").eq("id", second).eq("user_id", identity.id).maybeSingle();
    return !!data && (mode !== "read" || data.front_path === name || data.back_path === name);
  }
  if (bucket === "postcards") {
    if (mode === "read") {
      const { data } = await client.from("postcard_feed").select("front_path,back_path,group_id").eq("id", second).maybeSingle();
      return !!data && data.group_id === first && (data.front_path === name || data.back_path === name);
    }
    const { data: member } = await client.from("members").select("group_id").eq("user_id", identity.id).maybeSingle();
    if (member?.group_id !== first) return false;
    const { data } = await client.rpc("postcard_media_access", { p_card: second, p_mode: mode });
    return data === true;
  }
  const { data: meetup } = await client.from("meetups").select("id,group_id").eq("id", second).maybeSingle();
  if (!meetup || meetup.group_id !== first) return false;
  if (mode === "write") return true;
  const { data: photo } = await client.from("meetup_photos").select("id").eq("meetup_id", second).eq("path", name).maybeSingle();
  if (!photo) return false;
  if (mode === "read") return true;
  const { data } = await client.rpc("can_remove_meetup_photo", { p_photo: photo.id });
  return data === true;
}

export async function readMedia(client: PostgrestClient, bucket: Bucket, name: string) {
  if (!(await canUseMedia(client, bucket, name, "read"))) throw new Error("Not allowed");
  return readFile(filePath(bucket, name));
}

export function mediaContentType(name: string) {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function writeMedia(client: PostgrestClient, bucket: Bucket, name: string, bytes: Uint8Array) {
  if (bytes.length > 10 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid JPEG");
  if (!(await canUseMedia(client, bucket, name, "write"))) throw new Error("Not allowed");
  const destination = filePath(bucket, name);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, destination); } catch (error) { await unlink(temporary); throw error; }
}

export async function removeFiles(client: PostgrestClient, bucket: Bucket, names: string[]) {
  let removed = 0;
  for (const name of names) {
    if (!(await canUseMedia(client, bucket, name, "delete"))) continue;
    try { await unlink(filePath(bucket, name)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    removed++;
  }
  return removed;
}

export async function removePendingMeetupFiles(client: PostgrestClient, names: string[]) {
  for (const name of names) {
    if (!(await canUseMedia(client, "meetups", name, "write"))) continue;
    try { await unlink(filePath("meetups", name)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function removeMeetupFilesOnDelete(client: PostgrestClient, meetupId: string, names: string[]) {
  const identity = await getIdentity();
  const { data: member } = await client.from("members").select("id").eq("user_id", identity.id).maybeSingle();
  const { data: meetup } = await client.from("meetups").select("group_id,created_by").eq("id", meetupId).maybeSingle();
  if (!member || !meetup || meetup.created_by !== member.id) throw new Error("Only the meetup creator can delete it");
  for (const name of names) {
    if (!name.startsWith(`${meetup.group_id}/${meetupId}/`)) continue;
    try { await unlink(filePath("meetups", name)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function listFiles(client: PostgrestClient, bucket: Bucket, folder: string) {
  const probe = `${folder}/probe.jpg`;
  if (!(await canUseMedia(client, bucket, probe, "delete"))) return [];
  try { return (await readdir(path.dirname(filePath(bucket, probe)))).filter((name) => /\.(jpe?g|png|webp)$/.test(name)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
