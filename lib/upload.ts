import { resizeImage } from "@/lib/image";
import type { Bucket } from "@/lib/storage";

async function send(bucket: Bucket, path: string, blob: Blob): Promise<string> {
  const response = await fetch(`/api/media/${bucket}/${path}`, {
    method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" },
  });
  if (!response.ok) throw new Error(await response.text());
  return path;
}

export async function uploadAvatar(groupId: string, userId: string, file: File): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 512, square: true });
  return send("avatars", `${groupId}/${userId}/${Date.now()}.jpg`, blob);
}

export async function uploadPostcardPhoto(groupId: string, postcardId: string, side: "front" | "back", file: File): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 1600, quality: 0.82 });
  return send("postcards", `${groupId}/${postcardId}/${side}-${Date.now()}.jpg`, blob);
}

export async function uploadMeetupPhoto(groupId: string, meetupId: string, file: File): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 1600, quality: 0.82 });
  return send("meetups", `${groupId}/${meetupId}/${crypto.randomUUID()}.jpg`, blob);
}

export async function uploadPrivatePhoto(userId: string, cardId: string, side: "front" | "back", file: File): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 1600, quality: 0.82 });
  return send("private-postcards", `${userId}/${cardId}/${side}-${Date.now()}.jpg`, blob);
}
