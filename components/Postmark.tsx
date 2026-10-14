import { useId } from "react";

function postmarkDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day))
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

/** Round cancellation mark — "LJUBLJANA · SLOVENIA" around the rim, the posting date in the middle. */
export function Postmark({
  city,
  country,
  date,
  className = "",
}: {
  city: string;
  country: string;
  date: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const top = city.toUpperCase();
  const bottom = country.toUpperCase();
  const ink = "#24345e";

  return (
    <svg viewBox="0 0 230 120" className={className} aria-label={`Postmarked ${city}, ${postmarkDate(date)}`} role="img">
      <defs>
        <path id={`${id}-top`} d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id={`${id}-bot`} d="M 14 60 A 46 46 0 0 0 106 60" />
        <filter id={`${id}-ink`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2" />
        </filter>
      </defs>
      <g filter={`url(#${id}-ink)`} fill="none" stroke={ink}>
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="34" strokeWidth="1.5" />
        {/* Wavy cancellation lines */}
        {[34, 48, 62, 76, 90].map((y) => (
          <path
            key={y}
            d={`M 122 ${y} q 13 -7 26 0 t 26 0 t 26 0 t 26 0`}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ))}
        <g fill={ink} stroke="none" fontFamily="ui-monospace, 'Courier New', monospace" fontWeight="700">
          <text fontSize={top.length > 12 ? 9 : 11} letterSpacing="1.5">
            <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
              {top}
            </textPath>
          </text>
          <text fontSize={bottom.length > 14 ? 7.5 : 9} letterSpacing="1.5">
            <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
              {bottom}
            </textPath>
          </text>
          <text x="60" y="64" fontSize="10.5" textAnchor="middle" letterSpacing="0.5">
            {postmarkDate(date)}
          </text>
        </g>
      </g>
    </svg>
  );
}
