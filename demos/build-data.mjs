#!/usr/bin/env node
/**
 * build-data.mjs — every number in the demos traces to a file.
 * Reads the sibling checkout of manutej/wiring-and-the-whole (WIRING env or ../../wiring-and-the-whole)
 * plus this repo's own src/, and emits demos/data/*.js (window.JEV_DATA.<key>) so the demos
 * work from file://, GitHub Pages and artifact hosting alike.
 *
 * No TypeSafe call is made here or anywhere in demos/. The demos ship a deterministic twin.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const JEV = resolve(HERE, "..");
const W = process.env.WIRING ?? resolve(JEV, "..", "wiring-and-the-whole");
if (!existsSync(W)) { console.error(`wiring-and-the-whole not found at ${W} (set WIRING=)`); process.exit(1); }

const rd = (p) => readFileSync(p, "utf8");
const js = (p) => JSON.parse(rd(p));
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const prov = [];
const src = (rel, note) => { const p = join(W, rel); prov.push({ file: `wiring-and-the-whole/${rel}`, sha256_16: sha(rd(p)), note }); return p; };
const srcJ = (rel, note) => { const p = join(JEV, rel); prov.push({ file: `jev-tape/${rel}`, sha256_16: sha(rd(p)), note }); return p; };

// ---------- tokenizer (real cl100k via tiktoken if present; else labelled estimate) ----------
let count, tokenizer = "estimate (chars/3.6, labelled ±)";
try {
  const { createRequire } = await import("node:module");
  const req = createRequire(join(W, "experiments", "package.json"));
  const { get_encoding } = req("tiktoken");
  const enc = get_encoding("cl100k_base");
  count = (s) => enc.encode(s).length; tokenizer = "cl100k_base (tiktoken)";
} catch { count = (s) => Math.round(s.length / 3.6); }

// ---------- E2 ----------
const e2 = js(src("experiments/e2-tokens/E2-RESULTS.json", "E2 token arithmetic"));
const e2packs = {};
for (const k of ["LEGEND", "S1_A", "S1_motif", "S1_row", "S2_A", "S2_motif", "S2_row", "S3_A", "S3_motif", "S3_row"])
  e2packs[k] = rd(src(`experiments/e2-tokens/pack_${k}.txt`, "E2 pack text"));

// ---------- E3 ----------
const e3graph = js(src("experiments/e3-ablation/graph.json", "30 real @CommandType handlers"));
const e3man = js(src("experiments/e3-ablation/manifest.json", "E3 freeze + tokens"));
const e3grades = js(src("experiments/e3-ablation/E3-GRADES.json", "E3 grades"));
const e3packB = rd(src("experiments/e3-ablation/packB.txt", "E3 factored pack"));
const e3packA = rd(src("experiments/e3-ablation/packA.txt", "E3 explicit pack"));
const e3packC = rd(src("experiments/e3-ablation/packC.txt", "E3 interface-only pack"));
const e3q = js(src("experiments/e3-ablation/questions.json", "E3 questions"));

// ---------- E5 ----------
const e5q = js(src("experiments/e5-depth/questions.json", "112 questions, golds, depth, OC trees"));
const e5graph = js(src("experiments/e5-depth/graph.json", "40 real units"));
const e5man = js(src("experiments/e5-depth/manifest.json", "E5 freeze"));
const e5raw = js(src("experiments/e5-depth/E5-GRADES.json", "E5 raw grades (v1)"));
const e5fix = js(src("experiments/e5-depth/E5.1-GRADES.json", "E5.1 panel-corrected grades"));
const packBv1 = rd(src("experiments/e5-depth/packB.v1.txt", "pack B before the legend fix"));
const packBv2 = rd(src("experiments/e5-depth/packB.txt", "pack B after the legend fix"));
const legendV1 = packBv1.split("\n").filter(l => l.startsWith("#"));
const legendV2 = packBv2.split("\n").filter(l => l.startsWith("#"));
const legendAdded = legendV2.filter(l => !legendV1.includes(l));

// OC trees: 10 trees; COMPOSE-valid = D5/D6 (per e5_grade2.py VALID_TREES); theater = D9/D10 trees
const trees = e5q.oc.map((subs, i) => ({ i, q: e5q.questions[i], gold: e5q.gold[i], depth: e5q.depth[i], subs }))
  .filter(t => t.subs.length)
  .map(t => ({ ...t, composeValid: t.depth === 5 || t.depth === 6, ocRawInconsistentIn: Object.entries(e5raw.oc).filter(([, r]) => r.inconsistent_qs.includes(t.i + 1)).map(([k]) => k) }));

// ---------- E1 ----------
const witness = js(src("witness/WITNESS.json", "E1 13/13"));
const toyFiles = {};
for (const d of readdirSync(join(W, "witness/toybank"))) for (const f of readdirSync(join(W, "witness/toybank", d)))
  toyFiles[`${d}/${f}`] = rd(src(`witness/toybank/${d}/${f}`, "toybank"));

// ---------- jev-tape's own wiring pack (demo 08: the tape as a module of systems) ----------
const jevFiles = ["src/domain.ts", "src/colors.ts", "src/typesafe/contract.ts", "src/typesafe/client.ts", "scripts/qualify-surface.ts", "scripts/smoke-key.ts"];
const jevUnits = jevFiles.map(rel => {
  const body = rd(srcJ(rel, "jev-tape source"));
  const unit = rel.replace(/^(src|scripts)\//, "").replace(/\.ts$/, "").replace(/\//g, ".");
  const exportsRe = /^export\s+(?:const|function|class|type|interface|async function)\s+([A-Za-z_]\w*)/gm;
  const ports = [...body.matchAll(exportsRe)].map(m => m[1]);
  const imports = [...body.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g)]
    .flatMap(m => m[1].split(",").map(s => s.trim().replace(/^type\s+/, "")).filter(Boolean).map(sym => ({ sym, from: m[2] })));
  const fetches = /fetch\(/.test(body);
  const envKey = /TYPESAFE_API_KEY/.test(body);
  return { rel, unit, lines: body.split("\n").length, ports, imports, fetches, envKey, tokens: count(body) };
});
// explicit vs factored serialisation of jev-tape's wiring
const explicitJev = jevUnits.map(u => [`unit ${u.unit}`, ...u.ports.map(p => `port ${u.unit}#${p}`), ...u.imports.map(i => `edge ${u.unit} -> ${i.from.replace(/^\.\//, "").replace(/\.ts$/, "").replace(/^\.\.\/typesafe\//, "typesafe.")}#${i.sym}`)].join("\n")).join("\n\n");
const motifJev = [
  "motif TsUnit(U, ports, edges):",
  "  unit $U",
  "  foreach p in $ports -> port $U#$p",
  "  foreach T#s in $edges -> edge $U -> $T#$s",
  ...jevUnits.map(u => `inst TsUnit(${u.unit}, ports=[${u.ports.join(",")}], edges=[${u.imports.map(i => `${i.from.replace(/^\.\//, "").replace(/\.ts$/, "").replace(/^\.\.\/typesafe\//, "typesafe.")}#${i.sym}`).join(",")}])`),
].join("\n");

// ---------- jev-tape doctrine (from spec + wiki, quoted verbatim where used) ----------
const specTape = rd(srcJ("spec/SPEC-v1-TAPE.md", "loop + FIRE"));
const specSpeed = rd(srcJ("spec/SPEC-v1-SPEED.md", "four paths"));
const contractTs = rd(srcJ("src/typesafe/contract.ts", "wire contract"));
const domainTs = rd(srcJ("src/domain.ts", "commands"));
const colorsTs = rd(srcJ("src/colors.ts", "operad colors"));
const colors = [...colorsTs.matchAll(/"(\w+)"/g)].map(m => m[1]);
const commands = [...(domainTs.split("DomainEventName")[0]).matchAll(/^\s*\|\s*"(\w+)"/gm)].map(m => m[1]);
const humanGated = [...(domainTs.match(/HUMAN_GATED_COMMANDS = new Set<CommandName>\(\[([^\]]+)\]/)?.[1] ?? "").matchAll(/"(\w+)"/g)].map(m => m[1]);
const fire = specTape.split("\n").find(l => l.startsWith("No TypeSafe in the Workflow isolate"));
const loop = "assertLegalCommand → qualifyTask → gate → propose in memory → qualifyOutput → gate → applyCommand";

const DATA = {
  meta: { built: new Date().toISOString(), tokenizer, pin: "jev-1.13.0", queue: "jev-tape", note: "Twin data. No TypeSafe call was made to build or run these demos." },
  provenance: prov,
  jev: { colors, commands, humanGated, loop, fire, paths: [
    { n: 0, name: "code", when: "Deterministic. Missing field, illegal command", typesafe: "no", temporal: "no" },
    { n: 1, name: "batch judge", when: "Bounded fork: which tool / may this send", typesafe: "one POST, many questions", temporal: "only if a write follows" },
    { n: 2, name: "rank then read", when: "Many candidates, then an expensive LLM", typesafe: "shortlist POST recorded", temporal: "record shortlist before LLM" },
    { n: 3, name: "tape", when: "Crash, wait, worklist, C10", typesafe: "reuse recorded answers", temporal: "Workflow + Signal + Continue-As-New" } ],
    contract: { noulMid: [0.4, 0.6], scoreLevels: [2, 10], choiceMin: 2, endpoint: "https://api.typesafe.ai/v1/systemone" } },
  e2: { results: e2, packs: e2packs, legendTokens: count(e2packs.LEGEND) },
  e3: { graph: e3graph, manifest: e3man, grades: e3grades, packB: e3packB, packA: e3packA, packC: e3packC, questions: e3q.questions,
        tokens: { A: count(e3packA), B: count(e3packB), C: count(e3packC) } },
  e5: { manifest: e5man, raw: { pooled_per_depth: e5raw.pooled_per_depth, pooled_overall: e5raw.pooled_overall, oc: e5raw.oc, runs: e5raw.runs },
        fixed: e5fix, legendV1, legendV2, legendAdded, trees, graph: e5graph, questions: e5q.questions, gold: e5q.gold, depth: e5q.depth },
  e1: { witness, toybank: toyFiles },
  jevPack: { units: jevUnits, explicit: explicitJev, factored: motifJev, tokens: { explicit: count(explicitJev), factored: count(motifJev) } },
};

const emit = (name, obj) => writeFileSync(join(HERE, "data", `${name}.js`), `// generated by demos/build-data.mjs — do not edit\nwindow.JEV_DATA=window.JEV_DATA||{};window.JEV_DATA.${name}=${JSON.stringify(obj)};\n`);
emit("meta", DATA.meta); emit("provenance", DATA.provenance); emit("jev", DATA.jev);
emit("e1", DATA.e1); emit("e2", DATA.e2); emit("e3", DATA.e3); emit("e5", DATA.e5); emit("jevPack", DATA.jevPack);
writeFileSync(join(HERE, "data", "all.json"), JSON.stringify(DATA, null, 1));
console.log(`built ${prov.length} sources → demos/data/*.js  (tokenizer: ${tokenizer})`);
console.log(`jev-tape pack: explicit ${DATA.jevPack.tokens.explicit} tok vs factored ${DATA.jevPack.tokens.factored} tok`);
console.log(`E3 packs A/B/C tokens: ${DATA.e3.tokens.A}/${DATA.e3.tokens.B}/${DATA.e3.tokens.C} (manifest: ${e3man.tokens.A}/${e3man.tokens.B}/${e3man.tokens.C})`);
console.log(`OC trees: ${trees.length}, compose-valid ${trees.filter(t=>t.composeValid).length}, theater ${trees.filter(t=>!t.composeValid).length}`);
