/** Videos on meetups (#55). Shared by the browser and the server. */

/** The biggest video that can be uploaded: about 3–5 minutes of phone video. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/**
 * Videos are sent in pieces this big. Cloudflare turns away anything over 100 MB in
 * one go, and a small piece also gets through on slow mobile data well within its
 * time limit. A piece that fails is sent again, not the whole video. Keep it under
 * 10 MB: Next.js only passes that much of a request through `proxy.ts`.
 */
export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;

/** The longest side of a converted video, in pixels (1080p either way round). */
export const VIDEO_MAX_SIDE = 1920;
