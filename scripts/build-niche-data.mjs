// Rebuilds the bundled table the nicheness score uses:
//   lib/data/tourism.json — tourist arrivals per country, total and per resident (World Bank)
// (Island sizes come from the world-atlas package's land shapes, nothing to rebuild.)
// Run: node scripts/build-niche-data.mjs
import { writeFile } from "node:fs/promises";

const WB = (indicator) =>
  `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&date=2010:2019`;

async function wb(indicator) {
  const res = await fetch(WB(indicator));
  if (!res.ok) throw new Error(`${indicator}: HTTP ${res.status}`);
  const [, rows] = await res.json();
  const byCountry = new Map(); // ISO2 → Map(year → value)
  for (const r of rows ?? []) {
    if (r.value == null || !/^[A-Z]{2}$/.test(r.country.id) || !r.countryiso3code) continue;
    if (!byCountry.has(r.country.id)) byCountry.set(r.country.id, new Map());
    byCountry.get(r.country.id).set(Number(r.date), r.value);
  }
  return byCountry;
}

async function tourism() {
  const [arrivals, population] = await Promise.all([wb("ST.INT.ARVL"), wb("SP.POP.TOTL")]);
  const out = {};
  for (const [code, years] of arrivals) {
    // Latest year before the 2020 travel collapse that has both numbers.
    const year = [...years.keys()].sort((a, b) => b - a).find((y) => population.get(code)?.get(y));
    if (year === undefined) continue;
    const ratio = years.get(year) / population.get(code).get(year);
    out[code] = { arrivals: Math.round(years.get(year)), perResident: Number(ratio.toPrecision(3)), year };
  }
  return out;
}

const tr = await tourism();
await writeFile(new URL("../lib/data/tourism.json", import.meta.url), JSON.stringify(tr, null, 0));
console.log(`tourism countries: ${Object.keys(tr).length}`);
