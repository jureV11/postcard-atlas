// Sovereign states per continent (UN members plus Kosovo, Palestine, Taiwan and
// the Vatican) — these set each continent's total for the passport progress bars.
// Transcontinental countries are placed where they're usually counted
// (Russia → Europe; Turkey, Cyprus and the Caucasus → Asia).
export const CONTINENTS = [
  {
    name: "Europe",
    codes: "AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  },
  {
    name: "Asia",
    codes: "AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  },
  {
    name: "Africa",
    codes: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW",
  },
  {
    name: "North America",
    codes: "AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US",
  },
  { name: "South America", codes: "AR BO BR CL CO EC GY PY PE SR UY VE" },
  { name: "Oceania", codes: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU" },
].map((c) => ({ name: c.name, codes: new Set(c.codes.split(" ")) }));

// Territories: they count towards a continent's stamps but not its total.
const TERRITORIES: Record<string, string> = {
  PR: "North America", GL: "North America", BM: "North America", KY: "North America", AW: "North America",
  CW: "North America", GP: "North America", MQ: "North America", VI: "North America", VG: "North America",
  TC: "North America", AI: "North America", MS: "North America", BL: "North America", MF: "North America",
  SX: "North America", PM: "North America", BQ: "North America",
  GF: "South America", FK: "South America",
  RE: "Africa", YT: "Africa", SH: "Africa", EH: "Africa",
  HK: "Asia", MO: "Asia", IO: "Asia",
  FO: "Europe", GI: "Europe", GG: "Europe", JE: "Europe", IM: "Europe", AX: "Europe", SJ: "Europe",
  NC: "Oceania", PF: "Oceania", GU: "Oceania", MP: "Oceania", AS: "Oceania", CK: "Oceania", NU: "Oceania",
  WF: "Oceania", TK: "Oceania", PN: "Oceania", NF: "Oceania",
};

export function continentOf(alpha2: string): string | null {
  const code = alpha2.toUpperCase();
  for (const c of CONTINENTS) if (c.codes.has(code)) return c.name;
  return TERRITORIES[code] ?? null;
}

/** Visited vs total per continent, for a set of country codes. */
export function continentProgress(codes: string[]) {
  const visited = new Set(codes.map((c) => c.toUpperCase()));
  return CONTINENTS.map((c) => ({
    name: c.name,
    total: c.codes.size,
    visited: [...visited].filter((code) => continentOf(code) === c.name).length,
  }));
}
