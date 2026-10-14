export function Avatar({
  name,
  color,
  url,
  size = 40,
}: {
  name: string;
  color: string;
  url?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, boxShadow: `0 0 0 2px ${color}` };

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- signed URLs, no optimisation needed
    return <img src={url} alt={name} className="shrink-0 rounded-full object-cover" style={style} />;
  }

  const initials =
    name
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w)) // skip "(former member)" etc.
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join("") || "?";

  return (
    <span
      aria-label={name}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ ...style, background: color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
