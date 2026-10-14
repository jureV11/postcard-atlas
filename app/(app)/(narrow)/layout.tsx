// Reading-width column for everything except the full-width map page.
export default function NarrowLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl">{children}</div>;
}
