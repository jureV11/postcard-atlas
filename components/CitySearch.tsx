"use client";

import { useEffect, useId, useState } from "react";
import { Flag } from "@/components/Flag";
import { searchCities, type City } from "@/lib/geo";

export function CitySearch({
  id,
  value,
  onChange,
  placeholder = "Search for a city…",
}: {
  id?: string;
  value: City | null;
  onChange: (city: City | null) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchCities(query, ctrl.signal);
        setResults(found);
        setFailed(false);
        setActive(0);
        setOpen(true);
      } catch {
        if (ctrl.signal.aborted) return;
        setResults([]);
        setFailed(true);
      }
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function pick(city: City) {
    onChange(city);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    return (
      <div className="input flex items-center gap-2.5">
        <Flag code={value.countryCode} />
        <span className="min-w-0 flex-1 truncate">
          {value.name}
          <span className="text-ink-soft">, {value.country}</span>
        </span>
        <button type="button" className="text-sm font-medium text-stamp hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  const showEmpty = open && !loading && !failed && results.length === 0 && query.trim().length >= 2;

  return (
    <div className="relative">
      <input
        id={id}
        className="input"
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" />
      )}

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-ink/10 bg-white py-1 shadow-lg"
        >
          {results.map((c, i) => (
            <li
              key={c.id ?? `${c.name}-${c.lat}-${c.lng}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so blur doesn't close before click
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${i === active ? "bg-paper" : ""}`}
            >
              <Flag code={c.countryCode} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {[c.admin1, c.country].filter(Boolean).join(", ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && <p className="hint">No cities match “{query.trim()}”.</p>}
      {failed && <p className="hint text-stamp">City search is unavailable right now — try again in a moment.</p>}
    </div>
  );
}
