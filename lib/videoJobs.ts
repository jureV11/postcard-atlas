import "server-only";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PostgrestClient } from "@supabase/postgrest-js";
import { internalToken } from "@/lib/identity";
import { mediaFilePath } from "@/lib/media";
import { uploadsRoot } from "@/lib/videoFiles";
import { VIDEO_MAX_SIDE } from "@/lib/videoLimits";

// Converting uploaded videos (#55), one at a time, in the background. Every video is
// turned into an H.264 MP4 of at most 1080p (iPhone HEVC doesn't play on most Android
// phones or Windows), plus a still image to show before it plays. ffmpeg runs on two
// cores at low priority, so the rest of the server isn't slowed down. The original is
// deleted afterwards: only the converted video is kept.
//
// A job is a small file in MEDIA_ROOT/.uploads/jobs, so if the server restarts halfway
// the video is converted after the restart instead of being stuck "getting ready".

export type VideoJob = {
  photoId: string; // the meetup_photos row
  userId: string; // whoever uploaded it: the database is updated as them
  source: string; // the uploaded file on disk
  video: string; // meetups bucket path of the converted video (….mp4)
  poster: string; // meetups bucket path of its still image (….jpg)
};

const MAX_SECONDS = 30 * 60; // give up on a single video after this long
const jobsDir = () => path.join(uploadsRoot(), "jobs");

// One queue per server, kept on globalThis so reloading code in development doesn't start a second one
const state = globalThis as unknown as { videoQueueRunning?: boolean };

/** Save a job and start converting (if nothing else is converting already). */
export async function queueVideo(job: VideoJob): Promise<void> {
  await mkdir(jobsDir(), { recursive: true });
  await writeFile(path.join(jobsDir(), `${job.photoId}.json`), JSON.stringify(job));
  void work();
}

/**
 * After a restart: carry on with any videos that were waiting or halfway converted,
 * and throw away uploads that were given up on (pieces untouched for two days).
 */
export async function resumeVideoJobs(): Promise<void> {
  void work();
  await dropAbandonedUploads().catch((error) => console.error("Couldn't tidy old video uploads:", error));
}

const ABANDONED_MS = 2 * 24 * 60 * 60 * 1000;

async function dropAbandonedUploads(): Promise<void> {
  let folders: string[];
  try {
    folders = await readdir(uploadsRoot());
  } catch {
    return;
  }
  for (const folder of folders) {
    if (folder === "jobs") continue;
    const dir = path.join(uploadsRoot(), folder);
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      if (!name.endsWith(".part")) continue; // ".source" files belong to a waiting job
      const file = path.join(dir, name);
      const { mtimeMs } = await stat(file);
      if (Date.now() - mtimeMs > ABANDONED_MS) await unlink(file).catch(() => {});
    }
    if (!(await readdir(dir).catch(() => ["?"])).length) await rm(dir, { recursive: true }).catch(() => {});
  }
}

async function work(): Promise<void> {
  if (state.videoQueueRunning) return;
  state.videoQueueRunning = true;
  try {
    while (true) {
      let files: string[];
      try {
        files = (await readdir(jobsDir())).filter((f) => f.endsWith(".json")).sort();
      } catch {
        return; // no jobs folder yet: nothing to do
      }
      if (!files.length) return;
      const file = path.join(jobsDir(), files[0]);
      try {
        await run(JSON.parse(await readFile(file, "utf8")) as VideoJob);
      } catch (error) {
        console.error("Video job failed to run:", error);
      }
      await unlink(file).catch(() => {});
    }
  } finally {
    state.videoQueueRunning = false;
  }
}

async function run(job: VideoJob): Promise<void> {
  const video = mediaFilePath("meetups", job.video);
  const poster = mediaFilePath("meetups", job.poster);
  const tmpVideo = `${video}.converting.mp4`;
  const tmpPoster = `${poster}.converting.jpg`;
  await mkdir(path.dirname(video), { recursive: true });

  let ok = true;
  try {
    await ffmpeg(convertArgs(job.source, tmpVideo));
    // The still image from a second in (or the very start, for a very short clip)
    await ffmpeg(posterArgs(tmpVideo, tmpPoster, 1)).catch(() => ffmpeg(posterArgs(tmpVideo, tmpPoster, 0)));
    await rename(tmpPoster, poster);
    await rename(tmpVideo, video);
  } catch (error) {
    ok = false;
    console.error(`Couldn't convert video ${job.photoId}:`, error);
    await Promise.all([unlink(tmpVideo), unlink(tmpPoster), unlink(poster), unlink(video)].map((p) => p.catch(() => {})));
  }
  await unlink(job.source).catch(() => {}); // the original isn't kept either way

  // Tell the database, as whoever uploaded it. If the video was removed (or its meetup
  // deleted) while it was converting, there's no row any more: then drop the files too.
  try {
    const client = new PostgrestClient(process.env.POSTGREST_URL!, {
      headers: { Authorization: `Bearer ${await internalToken(job.userId)}` },
    });
    const { data, error } = await client
      .from("meetup_photos")
      .update({ video_status: ok ? "ready" : "failed" })
      .eq("id", job.photoId)
      .select("id");
    if (error) throw error;
    if (!data?.length && ok) await Promise.all([unlink(video), unlink(poster)].map((p) => p.catch(() => {})));
  } catch (error) {
    console.error(`Couldn't save video ${job.photoId} as ${ok ? "ready" : "failed"}:`, error);
  }
}

/** ffmpeg arguments: a phone-friendly MP4, long side at most 1920 px, starts playing before it's all downloaded. */
export function convertArgs(source: string, out: string): string[] {
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", source,
    "-map", "0:v:0", "-map", "0:a:0?", // the video, and its sound if it has any
    "-vf", `scale=w='min(${VIDEO_MAX_SIDE},iw)':h='min(${VIDEO_MAX_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    "-movflags", "+faststart",
    "-threads", "2",
    out,
  ];
}

/** ffmpeg arguments: one frame at `seconds` as a JPEG, long side at most 1280 px. */
export function posterArgs(video: string, out: string, seconds: number): string[] {
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(seconds), "-i", video,
    "-frames:v", "1",
    "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease",
    "-q:v", "4",
    out,
  ];
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Low priority on Linux (the server), so the site and everything else stay quick
    const [cmd, cmdArgs] = process.platform === "win32" ? ["ffmpeg", args] : ["nice", ["-n", "15", "ffmpeg", ...args]];
    const child = spawn(cmd, cmdArgs, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)));
    const timer = setTimeout(() => child.kill("SIGKILL"), MAX_SECONDS * 1000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
  });
}
