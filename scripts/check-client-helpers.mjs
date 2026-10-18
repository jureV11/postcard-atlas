// Fails if a server file imports a plain helper function from a "use client" file.
// Next.js only lets server code render client *components*; calling a client
// helper (formatCount(), profileFlag()…) crashes the page at runtime, and
// neither the type-check nor the build catches it. Put helpers in lib/ instead.
//
// Run: node scripts/check-client-helpers.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = [];
function walk(dir) {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(rel);
  }
}
for (const d of ["app", "components", "lib"]) walk(d);

const src = new Map(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));
const isClient = (s) => /^\s*["']use client["']/.test(s);

// Lower-case runtime exports of client files (components are Capitalised).
const helpers = new Map();
for (const [f, s] of src) {
  if (!isClient(s)) continue;
  const names = [...s.matchAll(/^export (?:async )?(?:function|const|let) ([a-z]\w*)/gm)].map((m) => m[1]);
  if (names.length) helpers.set(f, new Set(names));
}

const problems = [];
for (const [f, s] of src) {
  if (isClient(s)) continue;
  for (const m of s.matchAll(/import \{([^}]*)\} from "([^"]+)"/g)) {
    if (/^\s*type\s/.test(m[1])) continue;
    const path = m[2].startsWith("@/")
      ? m[2].slice(2)
      : m[2].startsWith(".")
        ? normalize(join(dirname(f), m[2])).replaceAll("\\", "/")
        : null;
    if (!path) continue;
    for (const target of [`${path}.tsx`, `${path}.ts`]) {
      const names = helpers.get(target);
      if (!names) continue;
      const used = m[1].split(",").map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]);
      const bad = used.filter((n) => names.has(n));
      if (bad.length) problems.push(`${f}: imports ${bad.join(", ")} from client file ${target}`);
    }
  }
}

if (problems.length) {
  console.error("Server files calling helpers from \"use client\" files (move the helpers to lib/):");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`OK — ${src.size} files checked, no server file imports a helper from a client file.`);
