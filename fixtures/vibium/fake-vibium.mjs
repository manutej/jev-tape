#!/usr/bin/env node
// A stand-in for the vibium binary so the step loop is testable with no browser and no key.
// Answers `--json` calls from a scenario: an ordered list of snapshots {url,title,text,map}.
// Read verbs answer from the current snapshot; nav, tab-edit and commit verbs advance the cursor.
//   FAKE_VIBIUM_SCENARIO  path to a JSON array of snapshots
//   FAKE_VIBIUM_CURSOR    path of the cursor file (created on first call)
//   FAKE_VIBIUM_LOG       optional path; every call's argv is appended as one JSON line
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

function main() {
  const scenario = JSON.parse(readFileSync(process.env.FAKE_VIBIUM_SCENARIO, "utf8"));
  const cursorPath = process.env.FAKE_VIBIUM_CURSOR;
  let cursor = existsSync(cursorPath) ? Number(readFileSync(cursorPath, "utf8")) : 0;

  const argv = process.argv.slice(2);
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json" || argv[i] === "--headless") continue;
    if (argv[i] === "--session") { i++; continue; }
    args.push(argv[i]);
  }
  if (process.env.FAKE_VIBIUM_LOG) appendFileSync(process.env.FAKE_VIBIUM_LOG, `${JSON.stringify(args)}\n`);

  const [verb, ...rest] = args;
  const cur = scenario[Math.min(cursor, scenario.length - 1)];
  const ok = (result) => { process.stdout.write(JSON.stringify({ ok: true, result })); process.exit(0); };
  const fail = (error) => { process.stdout.write(JSON.stringify({ ok: false, error })); process.exit(1); };

  switch (verb) {
    case "url": return ok(cur.url);
    case "title": return ok(cur.title);
    case "text": return ok(cur.text);
    case "map": return ok(cur.map || "No interactive elements found");
    case "diff": return ok("(positional diff not modelled)");
    case "daemon": return ok({ running: false, stopped: true });
    default: {
      if (verb === "click" && rest[0] && !/^@e\d+$/.test(rest[0]) && !cur.map.includes(rest[0])) return fail(`element not found: ${rest[0]}`);
      cursor = Math.min(cursor + 1, scenario.length - 1);
      writeFileSync(cursorPath, String(cursor));
      return ok(verb === "go" ? `Navigated to ${rest[0]}` : `${verb} ok`);
    }
  }
}

main();
