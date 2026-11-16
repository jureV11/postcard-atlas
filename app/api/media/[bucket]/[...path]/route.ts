import { createClient } from "@/lib/supabase/server";
import { mediaContentType, readMedia, writeMedia } from "@/lib/media";
import type { Bucket } from "@/lib/storage";

type Context = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { bucket, path } = await context.params;
    const name = path.join("/");
    const bytes = await readMedia(await createClient(), bucket as Bucket, name);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mediaContentType(name), "Cache-Control": "private, no-store" } });
  } catch { return new Response("Not found", { status: 404 }); }
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
