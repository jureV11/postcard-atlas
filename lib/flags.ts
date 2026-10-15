// Flag images, usable on the server and in the browser.

/** Rainbow pride flag, drawn here so it needs no image download. */
const PRIDE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 4" preserveAspectRatio="none">${[
      "#e40303",
      "#ff8c00",
      "#ffed00",
      "#008026",
      "#004dff",
      "#750787",
    ]
      .map((c, i) => `<rect y="${(i * 4) / 6}" width="6" height="${4 / 6 + 0.01}" fill="${c}"/>`)
      .join("")}</svg>`,
  );

export const flagUrl = (countryCode: string) =>
  `https://flagcdn.com/w40/${countryCode.toLowerCase().replace(/[^a-z]/g, "")}.png`;

/**
 * The profile flag: their home country's, or a pride flag if their name contains
 * one of the PRIDE_FLAG_NAMES set on the server (comma-separated, any case).
 * Server-only: the names never reach the browser.
 */
export function profileFlag(name: string, countryCode: string): string {
  const names = (process.env.PRIDE_FLAG_NAMES ?? "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  return names.some((n) => name.toLowerCase().includes(n)) ? PRIDE : flagUrl(countryCode);
}
