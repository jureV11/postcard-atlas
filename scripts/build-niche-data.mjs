// Rebuilds the bundled tables the nicheness score uses:
//   lib/data/airports.json — airports with scheduled flights (OurAirports, public domain)
//   lib/data/tourism.json  — tourist arrivals per resident, per country (World Bank)
// Run: node scripts/build-niche-data.mjs
import { writeFile } from "node:fs/promises";

const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const WB = (indicator) =>
  `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&date=2010:2019`;

/** Minimal CSV parser (quoted fields, commas and doubled quotes inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function airports() {
  const res = await fetch(AIRPORTS_URL);
  if (!res.ok) throw new Error(`airports.csv: HTTP ${res.status}`);
  const [header, ...rows] = parseCsv(await res.text());
  const col = (name) => header.indexOf(name);
  const [type, lat, lng, sched, iata] = ["type", "latitude_deg", "longitude_deg", "scheduled_service", "iata_code"].map(col);
  // Large airports, plus medium ones with scheduled passenger flights.
  const keep = rows.filter(
    (r) => r[type] === "large_airport" || (r[type] === "medium_airport" && r[sched] === "yes" && r[iata]),
  );
  // [lat, lng] rounded to ~100 m keeps the file small.
  return keep.map((r) => [Number(Number(r[lat]).toFixed(3)), Number(Number(r[lng]).toFixed(3))]);
}

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
    out[code] = { perResident: Number(ratio.toPrecision(3)), year };
  }
  return out;
}

const [ap, tr] = await Promise.all([airports(), tourism()]);
await writeFile(new URL("../lib/data/airports.json", import.meta.url), JSON.stringify(ap));
await writeFile(new URL("../lib/data/tourism.json", import.meta.url), JSON.stringify(tr, null, 0));
console.log(`airports: ${ap.length}, tourism countries: ${Object.keys(tr).length}`);
