import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { canUseMedia, mediaContentType, mediaFilePath, readMedia, writeMedia } from "@/lib/media";
import type { Bucket } from "@/lib/storage";
import { parseRange } from "@/lib/videoFiles";

type Context = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(request: Request, context: Context) {
  try {
    const { bucket, path } = await context.params;
    const name = path.join("/");
    if (name.endsWith(".mp4")) return await sendVideo(request, bucket as Bucket, name);
    const bytes = await readMedia(await createClient(), bucket as Bucket, name);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mediaContentType(name), "Cache-Control": "private, no-store" } });
  } catch { return new Response("Not found", { status: 404 }); }
}

/**
 * A meetup video (#55), streamed from disk rather than read into memory, and in parts
 * when the player asks for them (`Range`): iPhones won't play a video otherwise, and
 * it lets anyone skip ahead without downloading everything before it.
 */
async function sendVideo(request: Request, bucket: Bucket, name: string): Promise<Response> {
  if (!(await canUseMedia(await createClient(), bucket, name, "read"))) throw new Error("Not allowed");
  const file = mediaFilePath(bucket, name);
  const { size } = await stat(file);
  const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "Content-Length": String(end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) },
  });
}

export async function POST(request: Request, context: Context) {
  try {
    if (request.headers.get("content-type") !== "image/jpeg") throw new Error("JPEG required");
    if (Number(request.headers.get("content-length")) > 10 * 1024 * 1024) return new Response("Photo is too large", { status: 413 });
    const { bucket, path } = await context.params;
    const name = path.join("/");
    if (!name.endsWith(".jpg")) throw new Error("JPEG path required");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Photo required");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 10 * 1024 * 1024) { await reader.cancel(); return new Response("Photo is too large", { status: 413 }); }
      chunks.push(value);
    }
    await writeMedia(await createClient(), bucket as Bucket, name, Buffer.concat(chunks));
    return new Response(null, { status: 201 });
  } catch { return new Response("Upload rejected", { status: 403 }); }
}
