import { resizeImage } from "@/lib/image";
import type { Bucket } from "@/lib/storage";
import { MAX_VIDEO_BYTES, VIDEO_CHUNK_BYTES } from "@/lib/videoLimits";

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

/**
 * Send a video to a meetup in pieces (#55), so Cloudflare's 100 MB limit doesn't matter
 * and a dropped connection only costs one piece. `onProgress` gets 0–1. Returns the
 * upload's id, for `addMeetupVideo`.
 */
export async function uploadMeetupVideo(meetupId: string, file: File, onProgress: (done: number) => void): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("That video is too big: up to 500 MB (about 3–5 minutes).");
  if (!file.size) throw new Error("That video is empty.");
  const uploadId = crypto.randomUUID();
  let offset = 0;
  let failures = 0;
  onProgress(0);
  while (offset < file.size) {
    const piece = file.slice(offset, Math.min(offset + VIDEO_CHUNK_BYTES, file.size));
    let response: Response | null = null;
    try {
      response = await fetch(`/api/videos/${meetupId}/${uploadId}?offset=${offset}&size=${piece.size}`, {
        method: "PUT",
        body: piece,
        headers: { "Content-Type": "application/octet-stream" },
      });
    } catch {
      response = null; // no connection: try this piece again
    }
    const answer = response ? ((await response.json().catch(() => ({}))) as { size?: number; error?: string }) : {};
    if (response?.ok && typeof answer.size === "number") {
      offset = answer.size;
      failures = 0;
      onProgress(offset / file.size);
      continue;
    }
    if (response?.status === 409 && typeof answer.size === "number") {
      offset = answer.size; // the server has a different amount: carry on from there
      continue;
    }
    if (response && response.status !== 409 && response.status < 500) throw new Error(answer.error ?? "The video didn't upload.");
    if (++failures > 5) throw new Error("The video didn't upload: the connection kept dropping. Try again on wifi.");
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** failures)); // wait a little longer each time
  }
  return uploadId;
}
