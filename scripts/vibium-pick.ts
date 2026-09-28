#!/usr/bin/env node
/**
 * Direct query: which element on this page is the one for a goal? One Jev Choice over the map.
 *
 *   npm run pick -- --url https://github.com/microsoft/vscode/issues \
 *     --goal "search the issues by typing a query" --goal "open the pull requests tab"
 *
 * Options: --url U (required) · --goal "…" (repeatable) · --tags REGEX (only elements whose tag matches, e.g. '^(a|button)')
 *          --headless · --session S · --stop (stop the daemon afterwards)
 * Prints one JSON line per goal: ref, the map line, p, entropy, options, ms. A pick below p 0.85 is null.
 */
import { systemOne } from "../src/typesafe/client.ts";
import { ensureDaemon, snapshot, vibium } from "../src/vibium/cli.ts";
import { pickRef } from "../src/vibium/pick.ts";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const opts = (n: string) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]!] : []));

if (!process.env.TYPESAFE_API_KEY) { console.error("TYPESAFE_API_KEY is not set"); process.exit(1); }
const url = opt("--url");
const goals = opts("--goal");
if (!url || !goals.length) { console.error("usage: npm run pick -- --url U --goal \"…\" [--goal …]"); process.exit(1); }

const vopts = { headless: flag("--headless"), session: opt("--session") ?? process.env.VIBIUM_SESSION ?? "pick" };
const onlyTags = opt("--tags") ? new RegExp(opt("--tags")!) : undefined;

await ensureDaemon(vopts);
await vibium(["go", url], vopts);
await vibium(["wait", "load", "--timeout", "20000"], vopts).catch(() => undefined);
const s = await snapshot(vopts);
console.log(JSON.stringify({ url: s.url, title: s.title, elements: s.map ? s.map.split("\n").length : 0 }));
let exit = 0;
for (const goal of goals) {
  const r = await pickRef(goal, s.map, { url: s.url, title: s.title }, (req) => systemOne(req), { onlyTags });
  const top = Object.entries(r.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v.toFixed(2)}`);
  console.log(JSON.stringify({ goal, ref: r.ref, line: r.line?.raw ?? null, p: +r.p.toFixed(2), entropy: +r.entropy.toFixed(2), options: r.options, ms: r.ms, top }));
  if (!r.ref) exit = 2;
}
if (flag("--stop")) await vibium(["daemon", "stop"], vopts).catch(() => undefined);
process.exit(exit);
