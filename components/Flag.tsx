// Flag images rather than emoji — Windows doesn't render flag emoji.
export function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const cc = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt={code.toUpperCase()}
      width={size}
      height={Math.round(size * 0.75)}
      className="inline-block shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
      style={{ width: size, height: Math.round(size * 0.75) }}
      loading="lazy"
    />
  );
}
