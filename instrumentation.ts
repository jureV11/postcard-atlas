// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Videos still waiting to be converted when the server last stopped (#55)
  const { resumeVideoJobs } = await import("@/lib/videoJobs");
  await resumeVideoJobs();
}
