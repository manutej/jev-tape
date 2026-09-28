#!/usr/bin/env node
/** Build docs/vibium-team-brief.html from docs/vibium-team-brief.src.html and results/registry.json.  npm run brief */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "results/registry.json"), "utf8"));
let html = fs.readFileSync(path.join(ROOT, "docs/vibium-team-brief.src.html"), "utf8");
for (const [k, v] of Object.entries(reg.totals)) html = html.split(`{{${k}}}`).join(String(v));
const left = html.match(/\{\{[a-zA-Z]+\}\}/g); if (left) throw new Error("unfilled placeholders: " + left.join(" "));
html = html.replace("/*__DATA__*/", JSON.stringify(reg).replace(/<\//g, "<\\/"));
fs.writeFileSync(path.join(ROOT, "docs/vibium-team-brief.html"), html);
console.log(`docs/vibium-team-brief.html ${html.length} bytes · ${reg.totals.experiments} experiments · ${reg.totals.rows} rows`);
