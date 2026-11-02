import Link from "next/link";
import { Flag } from "@/components/Flag";
import { formatDate } from "@/lib/dates";
import { requireMember } from "@/lib/session";
import { signPaths } from "@/lib/storage";
import type { PrivatePostcard } from "@/lib/types";

export default async function PrivatePostcardsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const { supabase } = await requireMember();
  const { data } = await supabase.from("private_postcards").select("*").order("sent_on", { ascending: false });
  const all = (data ?? []) as PrivatePostcard[];
  const filter = show === "sent" || show === "received" ? show : null;
  const cards = filter ? all.filter((c) => c.direction === filter) : all;
  const urls = await signPaths(supabase, "private-postcards", cards.map((c) => c.front_path));

  const tab = (value: string | null, label: string, count: number) => (
    <Link
      href={value ? `/private?show=${value}` : "/private"}
      aria-current={filter === value ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        filter === value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label} <span className="font-mono text-xs opacity-70">{count}</span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Private postcards</h1>
          <p className="mt-1 text-ink-soft">Cards with people outside the group. Only you can see these.</p>
        </div>
        <Link href="/private/new" className="btn">
          + Add a postcard
        </Link>
      </div>

      {all.length > 0 && (
        <nav className="flex gap-1">
          {tab(null, "All", all.length)}
          {tab("sent", "Sent", all.filter((c) => c.direction === "sent").length)}
          {tab("received", "Received", all.filter((c) => c.direction === "received").length)}
        </nav>
      )}

      {cards.length === 0 ? (
        <div className="card text-center">
          <p className="font-display text-xl font-semibold">{all.length ? "None here yet" : "Your own little shoebox"}</p>
          <p className="mt-1 text-ink-soft">Keep the front and back of cards you send to, or get from, anyone else.</p>
          <Link href="/private/new" className="btn mt-4">
            Add a postcard
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {cards.map((c) => {
            const url = c.front_path ? urls.get(c.front_path) : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/private/${c.id}`}
                  className="block rounded-[4px] bg-[#fffdf8] p-2 pb-3 shadow-[0_1px_2px_rgb(42_38_34/0.1),0_12px_24px_-14px_rgb(42_38_34/0.5)] ring-1 ring-ink/10 transition hover:-translate-y-0.5"
                >
                  <div className="aspect-[3/2] overflow-hidden rounded-[2px] bg-paper-deep">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl text-ink-soft/50" aria-hidden="true">
                        ✉
                      </div>
                    )}
                  </div>
                  <div className="px-1 pt-2">
                    <p className="text-[11px] font-medium tracking-wide text-ink-soft uppercase">
                      {c.direction === "sent" ? "Sent" : "Received"} · {formatDate(c.sent_on)}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {c.person ? `${c.direction === "sent" ? "To" : "From"} ${c.person}` : c.direction === "sent" ? "Sent" : "Received"}
                    </p>
                    {c.from_city && (
                      <p className="flex items-center gap-1.5 truncate text-xs text-ink-soft">
                        {c.from_country_code && <Flag code={c.from_country_code} size={12} />}
                        {c.from_city}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
