# HANDOFF: Jev × Vibium

The entry point. What this branch holds, who reads what, where every file is, and how to run it.
Branch `claude/nice-fermat-ky9qtz` on manutej/jev-tape (runtime) and manutej/JEV-works (lab, PR #2).
Last measured 2026-09-29. Jev pin `jev-1.13.0`, Vibium 26.8.21, model xai/grok-4.6.

## Read by audience

| You are | Read, in order |
| --- | --- |
| Leadership, ten minutes | `docs/vibium-team-brief.html` sections 1 and 2 (published: https://claude.ai/artifact/WbfHE1ZKWmNGeR92iyx2d6) |
| The Vibium team | `docs/HANDOFF-VIBIUM-TEAM.md` → the brief, section 4 (the browser layer) and 7 (the bridges) → `docs/TEST-IN-PLACE.md` to reproduce it → `docs/VIBIUM-BRIDGES.md` for the ask |
| Anyone checking a number | `docs/SOURCE-OF-TRUTH.md` → `results/registry.json` → the raw file the row names |
| Anyone judging the comparison | `docs/judges-comparison.html` (published: https://claude.ai/artifact/X729CDTw8qsbzXUwiJL4Qw) → `docs/COMPUTER-USE-CROSSCHECK.md` |
| The next session continuing the work | `docs/HANDOFF-2026-09-28.md` (state, next steps, rails) → `spec/SURFACES-VIBIUM.md` → JEV-works `handoffs/vibium-browser.md` |
| Adding results from another session | `results/incoming/README.md`, then `npm run brief` |

## The tree, annotated (Vibium surface only)

```
HANDOFF.md                         this file
README.md · AGENTS.md              repo overview; agent rules, incl. the results and presentation rules
package.json                       scripts: test · typecheck · vibium · bench · pick · corpus · calibrate ·
                                   demo:vibium · registry · brief · judges (Temporal scripts alongside)

docs/
  HANDOFF-VIBIUM-TEAM.md           executive summary, registry totals, stamped experiment table, file index
  TEST-IN-PLACE.md                 the Vibium team's runbook: fresh clone, own binary, ten checks, then bench and corpus
  SOURCE-OF-TRUTH.md               what is canonical at each layer, registry schema, GROW steps, rules for numbers
  HANDOFF-2026-09-28.md            session state, all measurements, next steps in order, rails
  COMPUTER-USE-CROSSCHECK.md       the screenshot-judge and pixel-operator proxies, blinding protocol
  VIBIUM-BRIDGES.md                seven bridges into Vibium; the ask is bridge 6
  PARALLEL-SPEND.md                ten-agent corpus design with recordings and Haiku labels (not launched)
  LOCAL-DEMO.md                    run the loop from your own terminal; direct queries; failure meanings
  vibium-team-brief.src.html       the brief's source with {{placeholders}}; built by `npm run brief`
  vibium-team-brief.html           the built brief (registry inlined). Do not edit by hand
  judges-comparison.src.html       the three-judge comparison source; built by `npm run judges`
  judges-comparison.html           the built comparison page
  LOCAL-GROK.md · PARALLELISM.md · TEMPORAL-MVP.md    the Temporal side of jev-tape, not part of this surface

spec/
  SURFACES-VIBIUM.md               the design: verb classes, gate, verify, tape, rails; every measurement in §8
  (other spec files belong to the Temporal and Gmail/GitHub surfaces)

src/vibium/
  cli.ts                           spawns `vibium --json --session S`, parses JSON, resolves @refs, redacts values
  step.ts                          the router: classify → park check → gate → act → settle → verify; fallback order
  decide.ts                        thresholds 0.85 / 0.15, entropy rule, compose rules (ported from JEV-works kit)
  pack.ts                          loads packs/*.json, fails closed on drift from the lab contexts
  tape.ts                          answers keyed by sha256(state + questions); replay makes zero calls
  pick.ts                          one Choice over the element map with `none` as the escape
  vibium.test.ts                   13 twins against fixtures/vibium/fake-vibium.mjs and a scripted judge

packs/
  browser.action-gate.json         gate questions: mutatesWorld · reversible · spendsOrSends · blastRadius
  browser.step-verify.json         verify questions: outcome · errorShown · blocked; login-verify module

scripts/
  vibium-step.ts                   `npm run vibium`: one typed browser flow
  vibium-bench.ts                  `npm run bench`: same claim to Jev and to vibium check, eight pages
  vibium-pick.ts                   `npm run pick`
  vibium-corpus.ts                 `npm run corpus`: parallel sessions, recordings, Grok fallback
  calibrate.ts                     `npm run calibrate`: Brier, reliability bins, per-kind accuracy
  demo.sh · fixture-site.mjs       `npm run demo:vibium`; the local login/secure/checkout site on 8787
  test-in-place.sh                 the acceptance script (pass 10 · fail 0 here)
  build-registry.mjs               `npm run registry`: results/registry.json from committed files only
  build-brief.mjs                  `npm run brief`: registry, then the brief page
  build-judges.mjs                 `npm run judges`: the comparison data and page
  workflow-parallel-corpus.js      the ten-agent Workflow script (drivers + blinded Haiku labellers)

fixtures/vibium/
  catalog-pages.json               80 rows, measured twice (E9, E15)
  catalog-100.json                 140 rows across 18 kinds, ready for the scale run
  fake-vibium.mjs · *.json         the fake binary and recorded snapshots the twins use

results/
  registry.json                    THE registry: 15 experiments, 248 rows, computed totals. Built, never edited
  raw/                             per-row numbers, page text removed: corpus day 1 and 2, bench day 2,
                                   the three Sonnet judge runs with the key, the comparison data
  incoming/                        README (schema and rules) and repeatability-2026-09-29.json (E13 to E15)

.claude/skills/ormus-chrome/       the design chrome as a repo skill: SKILL.md + references (tokens, fusion.css,
                                   STYLE.md, components, cover, charts, icons, page template)

runs/ · recordings/                gitignored: raw runner output with page text, the tape, recording zips.
                                   Their numbers are in results/raw; the zips ship in the recordings bundle
```

JEV-works, same branch: `kit/modules/contexts/browser.*.json` (the canonical questions), `kit/modules/items/browser-*.items.json`
(labelled items), `kit/results/browser-*.json` (the lab results the registry reads), `handoffs/vibium-browser.md`,
`handoffs/vibium/*` (the operadic interviews and the OC tree).

## Run it

```bash
npm ci && npm test                     # 42 tests, no key, no browser
scripts/test-in-place.sh               # ten checks; needs TYPESAFE_API_KEY and vibium for the last four
npm run brief && npm run judges        # rebuild the registry and both pages from committed files
```

## The rules that bind

Never push to HermeticOrmus/vibium. Never paste a key. `results/registry.json` and the built pages are never edited
by hand. Every number carries n, baseline and whether thresholds were fitted. Jev never counts, compares or
decides a retry; a Jev refusal is final; pay, send and delete park for a person before any call.
