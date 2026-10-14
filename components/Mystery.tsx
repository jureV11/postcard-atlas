/** Stands in for a flag when a card's origin is still a secret. */
export function MysteryGlobe({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="inline-block shrink-0 text-stamp"
      aria-label="Somewhere in the world"
      role="img"
    >
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 12h19M12 2.5c-2.8 2.6-2.8 16.4 0 19M12 2.5c2.8 2.6 2.8 16.4 0 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.45"
      />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" fontFamily="system-ui">
        ?
      </text>
    </svg>
  );
}
