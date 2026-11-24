import { createClient } from "@/lib/supabase/server";
import { canUseMedia } from "@/lib/media";
import { appendChunk, isUuid, partPath } from "@/lib/videoFiles";
import { VIDEO_CHUNK_BYTES } from "@/lib/videoLimits";

type Context = { params: Promise<{ meetupId: string; uploadId: string }> };

/**
 * One piece of a video being uploaded to a meetup (#55): PUT ?offset=<bytes so far>.
 * Answers with how much has arrived, so the browser knows where to carry on. Only
 * someone in the meetup's group may upload; the pieces wait outside every bucket
 * until the video is added and converted (`addMeetupVideo`).
 */
export async function PUT(request: Request, context: Context) {
  try {
    const { meetupId, uploadId } = await context.params;
    if (!isUuid(meetupId) || !isUuid(uploadId)) return Response.json({ error: "Invalid upload" }, { status: 400 });
    const query = new URL(request.url).searchParams;
    const offset = Number(query.get("offset"));
    // The piece's size: from the header, or from the address if a proxy on the way dropped it
    const length = Number(request.headers.get("content-length") || query.get("size"));
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 || length > VIDEO_CHUNK_BYTES)
      return Response.json({ error: "Invalid piece" }, { status: 400 });
    if (!request.body) return Response.json({ error: "Empty piece" }, { status: 400 });

    const client = await createClient();
    const { data: meetup } = await client.from("meetups").select("group_id").eq("id", meetupId).maybeSingle();
    if (!meetup || !(await canUseMedia(client, "meetups", `${meetup.group_id}/${meetupId}/${uploadId}.mp4`, "write")))
      return Response.json({ error: "Not allowed" }, { status: 403 });

    const result = await appendChunk(partPath(meetupId, uploadId), offset, request.body, length);
    if ("error" in result) {
      if (result.error === "too-big") return Response.json({ error: "That video is too big: up to 500 MB." }, { status: 413 });
      return Response.json({ error: "Out of order", size: result.size }, { status: 409 });
    }
    return Response.json({ size: result.size });
  } catch {
    return Response.json({ error: "Upload rejected" }, { status: 403 });
  }
}
