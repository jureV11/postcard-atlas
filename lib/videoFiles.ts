import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, open, stat, truncate } from "node:fs/promises";
import path from "node:path";
import { MAX_VIDEO_BYTES } from "@/lib/videoLimits";

// Videos on meetups (#55): the files on the way in, before they're converted. They
// live in MEDIA_ROOT/.uploads, out of every bucket, so nothing can ever serve them.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string) => UUID.test(s);

export function uploadsRoot(): string {
  return path.join(process.env.MEDIA_ROOT || "/data", ".uploads");
}

/** Where the pieces of one upload are put together. */
export function partPath(meetupId: string, uploadId: string): string {
  if (!isUuid(meetupId) || !isUuid(uploadId)) throw new Error("Invalid upload");
  return path.join(uploadsRoot(), meetupId, `${uploadId}.part`);
}

async function sizeOf(file: string): Promise<number> {
  try {
    return (await stat(file)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

export type ChunkResult = { size: number } | { error: "offset"; size: number } | { error: "too-big" };

/**
 * Add one piece at `offset`. Pieces must come in order; one that was already received
 * (sent again after a dropped connection) is accepted without writing it twice. The
 * whole video may not grow past MAX_VIDEO_BYTES.
 */
export async function appendChunk(file: string, offset: number, body: ReadableStream<Uint8Array>, length: number): Promise<ChunkResult> {
  await mkdir(path.dirname(file), { recursive: true });
  const size = await sizeOf(file);
  if (offset + length <= size) return { size }; // already have it
  if (offset !== size) return { error: "offset", size };
  if (offset + length > MAX_VIDEO_BYTES) return { error: "too-big" };

  const out = createWriteStream(file, { flags: "a" });
  const reader = body.getReader();
  let written = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.length;
      if (written > length || offset + written > MAX_VIDEO_BYTES) {
        await reader.cancel();
        throw new Error("too-big");
      }
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
  } catch (error) {
    out.destroy();
    await truncate(file, offset).catch(() => {}); // a half-written piece is dropped, so it can be sent again
    if ((error as Error).message === "too-big") return { error: "too-big" };
    throw error;
  }
  if (written !== length) {
    await truncate(file, offset).catch(() => {});
    return { error: "offset", size: offset };
  }
  return { size: offset + written };
}

/** Does this look like a video file (MP4 / MOV, or WebM / MKV)? Checked before converting. */
export async function looksLikeVideo(file: string): Promise<boolean> {
  const handle = await open(file, "r");
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    if (bytesRead < 12) return false;
    const box = head.toString("latin1", 4, 8);
    if (["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box)) return true; // MP4 and iPhone MOV
    return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3; // WebM / Matroska
  } finally {
    await handle.close();
  }
}

/**
 * The part of a file a `Range: bytes=…` header asks for, for playing videos (iPhones
 * only play a video if the server sends it in parts). Null means send the whole file;
 * "invalid" means the range can't be met.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2]) || size === 0) return "invalid";
  let start: number;
  let end: number;
  if (!m[1]) {
    // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? "invalid" : { start, end };
}
