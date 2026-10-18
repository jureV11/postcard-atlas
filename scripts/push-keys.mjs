// Creates everything phone notifications need, once per installation:
//   - a VAPID key pair (identifies this site to the browsers' push services)
//   - a server secret (lets the server, and only the server, look up phones)
//
//   node scripts/push-keys.mjs https://your-site.example
//     → prints the settings lines and the SQL to run
//   node scripts/push-keys.mjs https://your-site.example --env .env --sql push-setup.local.sql
//     → appends the settings to .env and writes the SQL to a file instead
//       (nothing secret is printed)
//
// No packages needed — plain Node, so it also runs through Docker on a server
// without Node installed (see HOSTING.md → Notifications).
// Keep the private key and the secret out of git and chat.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const site = args.find((a) => /^https?:\/\//.test(a));
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!site) {
  console.error("Usage: node scripts/push-keys.mjs https://your-site.example [--env .env] [--sql file.sql]");
  process.exit(1);
}

// A VAPID key pair is a P-256 key: public = uncompressed point, private = d (both base64url).
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const b64 = (s) => Buffer.from(s, "base64url");
const keys = {
  publicKey: Buffer.concat([Buffer.from([4]), b64(pub.x), b64(pub.y)]).toString("base64url"),
  privateKey: priv.d,
};
const secret = randomBytes(32).toString("hex");
const env = [
  "",
  "# Phone notifications (scripts/push-keys.mjs)",
  `VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `VAPID_PRIVATE_KEY=${keys.privateKey}`,
  `VAPID_SUBJECT=${site}`,
  `PUSH_SECRET=${secret}`,
  "",
].join("\n");
const sql = `-- Run once in Supabase → SQL Editor (after migration 0017).\nupdate public.push_config set secret = '${secret}' where id = 1;\n`;

const envFile = opt("--env");
const sqlFile = opt("--sql");
if (envFile) {
  const existing = await readFile(envFile, "utf8").catch(() => "");
  if (/^VAPID_PRIVATE_KEY=/m.test(existing)) {
    console.error(`${envFile} already has notification keys — not adding a second set.`);
    process.exit(1);
  }
  await appendFile(envFile, env);
  console.log(`Added the notification settings to ${envFile}.`);
} else {
  console.log("Add these lines to the server's settings file (.env or .env.local):");
  console.log(env);
}
if (sqlFile) {
  await writeFile(sqlFile, sql);
  console.log(`Wrote the SQL to ${sqlFile} — run it in Supabase → SQL Editor, then delete the file.`);
} else {
  console.log(sql);
}
