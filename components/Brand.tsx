export function StampIcon({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M4 4h24v24H4z"
        fill="var(--color-stamp)"
        stroke="var(--color-paper)"
        strokeWidth="2.5"
        strokeDasharray="2.2 1.8"
      />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="var(--color-paper)" strokeWidth="1.6" />
      <path d="M9.5 16h13M16 9.5c-2.6 3.6-2.6 9.4 0 13M16 9.5c2.6 3.6 2.6 9.4 0 13" fill="none" stroke="var(--color-paper)" strokeWidth="1.2" />
    </svg>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <StampIcon />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-semibold tracking-tight">Postcard Atlas</span>
        {subtitle && <span className="font-hand text-base leading-none opacity-70">{subtitle}</span>}
      </span>
    </span>
  );
}
