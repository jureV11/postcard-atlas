/**
 * An achievement as a rubber-stamp seal: a double ring with a line-drawn icon.
 * Inked in stamp red once earned, faint grey before. Decorative (the name and
 * description next to it carry the meaning).
 */
const ICONS: Record<string, string> = {
  // A postage stamp
  first: "M7 5h10v14H7zM7 8h-1M7 11h-1M7 14h-1M18 8h-1M18 11h-1M18 14h-1M10 10.5l1.5 1.5 3-3",
  // Globe
  "countries-5": "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM4 12h16M12 4c-2.4 2.3-2.4 13.7 0 16M12 4c2.4 2.3 2.4 13.7 0 16",
  // Plane
  "countries-15": "M3 13l7-1.5L14 4h2l-1.5 7.5L20 10l1 1.5-6.5 2.5L13 20h-2l.5-5L5 16.5z",
  // Compass
  "continents-3": "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM15 9l-1.8 4.2L9 15l1.8-4.2z",
  // Folded map
  "continent-half": "M4 6.5 9 5l6 2 5-1.5v12L15 19l-6-2-5 1.5zM9 5v12M15 7v12",
  // A long dashed route between two pins
  "long-haul": "M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6.5 13.5c3-5 6-1 11-5",
  // A little sailing boat on a wave
  "slow-boat": "M5 15h14l-2 3H7zM12 5v10M12 5l5 8h-5M3 20c2 0 2-1 4.5-1S10 20 12 20s2.5-1 4.5-1S19 20 21 20",
  // Lightning
  express: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  // Envelope with a heart
  "pen-pal": "M4 7h16v11H4zM4 8l8 5.5L20 8M12 17.2l-1.6-1.4c-1.3-1.1-.6-3 .9-2.6.3.1.5.3.7.5.2-.2.4-.4.7-.5 1.5-.4 2.2 1.5.9 2.6z",
  // Mailbox
  mailbox: "M5 11a4 4 0 0 1 8 0v8H5zM13 7h4a4 4 0 0 1 2 3.5V19h-6M9 19v3M15 4v5h2",
  // Waves
  lost: "M3 9c2 0 2-1.5 4.5-1.5S10 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 14c2 0 2-1.5 4.5-1.5S10 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19",
  // Three continents: three little globes
  "world-mail": "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9.5 8.5l1.5 6M14.5 8.5 13 14.5M10 6h4",
  // Every continent: a globe with a star
  "every-continent": "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM4 12h16M12 4c-2.4 2.3-2.4 13.7 0 16M12 4c2.4 2.3 2.4 13.7 0 16M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6z",
  // Collector: a stack of cards
  collector: "M6 8h12v11H6zM8 5h10v2M10 3h8v1M8 12h8M8 15h5",
  // Fan club: three people
  "fan-club": "M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7.5 19a4.5 4.5 0 0 1 9 0M3 18a3 3 0 0 1 4-2.8M21 18a3 3 0 0 0-4-2.8",
  // Postie: a mail bag
  postie: "M6 9h12l-1 11H7zM9 9a3 3 0 0 1 6 0M4 6l4 3M20 6l-4 3",
  // Around the world: a globe with an arrow circling it
  "around-the-world": "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM6 12h12M12 6c-1.8 1.7-1.8 10.3 0 12M3.5 9.5A9 9 0 0 1 19 5.5M19 5.5l.2-2.5M19 5.5l-2.4.6",
  // Neighbourly: two houses side by side
  neighbourly: "M3 20v-7l4-4 4 4v7zM13 20v-7l4-4 4 4v7zM6 20v-3h2v3M16 20v-3h2v3",
  // Trip report: a suitcase
  trip: "M4 8h16v11H4zM9 8V5h6v3M4 13h16M10 13v2h4v-2",
  // Special delivery: an envelope in a hand
  "special-delivery": "M7 5h11v7H7zM7 6l5.5 3.5L18 6M3 15h5l3 2h4.5a1.5 1.5 0 0 1 0 3H9M3 20h3",
  // Question mark (secret, not yet earned)
  secret: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.5",
};

export function AchievementSeal({ id, earned, hidden }: { id: string; earned: boolean; hidden?: boolean }) {
  const ink = earned ? "#c2503a" : "#8a8076";
  const path = ICONS[hidden ? "secret" : id] ?? ICONS.first;
  // A small, steady tilt per badge, like a hand-pressed stamp.
  const tilt = ((id.length * 7) % 11) - 5;
  return (
    <svg
      viewBox="0 0 48 48"
      className={`size-12 shrink-0 ${earned ? "" : "opacity-45"}`}
      style={{ transform: `rotate(${tilt}deg)` }}
      aria-hidden="true"
    >
      {earned && <circle cx="24" cy="24" r="22" fill="#c2503a" fillOpacity="0.08" />}
      <circle cx="24" cy="24" r="22" fill="none" stroke={ink} strokeWidth="2" strokeDasharray={earned ? undefined : "3 3"} />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke={ink} strokeWidth="0.9" strokeOpacity="0.7" />
      <g transform="translate(12 12)" fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </g>
    </svg>
  );
}
