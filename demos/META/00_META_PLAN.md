# 00 · META-PLAN — ten jev demos at the seam of two repos

Level: L2 (the typed scaffold this run instantiated). Task category: *build a set of judged, recorded,
evidence-grounded interactive demos from two sibling corpora*. Instance: manutej/jev-tape ×
manutej/wiring-and-the-whole, ten demos. Human-of-record: the operator (manutej), who approves push.

## 1. Domain map

**Entities (both corpora, after reading every spec, wiki hub, experiment result, and source file):**

| entity | type | where it lives |
|---|---|---|
| typed question (noul / choice / score) | `Question` | jev-tape/src/typesafe/contract.ts |
| answer map, one per gate | `SystemOneResponse` | contract.ts |
| composeAnswers (code) → GREEN/AMBER/RED | `Gate` | wiki/pages/compose-answers.md, dual-axis.md |
| the loop, apply last | `Process` | spec/SPEC-v1-TAPE.md |
| speed paths 0–3 | `Route` | spec/SPEC-v1-SPEED.md |
| three lanes (decision, claim, screen) | `Lane` | wiki/pages/three-lanes.md |
| C10 human gate, `humanVerdict` signal | `HumanCheck` | wiki/pages/c10-human-gate.md, src/domain.ts |
| Event History, replay, Continue-As-New | `Tape` | spec/TEMPORAL.md, wiki/pages/temporal-replay.md |
| wiring pack (seed, marking, motif, deltas, legend) | `Pack` | wiring/experiments/*/pack*.txt |
| pushout, ports, κ collision | `Gluing` | wiring/witness/run_witness.py, WITNESS.json |
| experiment result with MAY / MAY-NOT | `Claim` | wiring/README.md, E*-RESULTS.md |
| OC tree (root, subs, golds), COMPOSE witness | `Tree` | wiring/experiments/e5-depth/questions.json, e5_grade2.py |

**Relationships that became demos:** `Pack —is a—> write` (so it gets a `Gate`); `Gluing —is—> Route 0`;
`Tree —needs—> Route 0 witness before Route 1 OC`; `Claim —routes through—> Lane 2`; `Pack line —routes
through—> Lane 3`; `Witness check —is an—> Activity on the Tape`; `Refactor square —is—> the apply-last
loop`; `jev-tape/src —is a—> Pack` (the tape is itself a module of systems).

**Invariants (conserved across every demo):**
1. No TypeSafe call, no key, no send, no push from a page. The judge is a twin and says so.
2. Every number traces to a repo file with a hash (`data/provenance.js`).
3. Replay never increments the POST counter.
4. Judge Choice cannot override a local RED.
5. The page structure is fixed (topbar, hero, instrument, tape-shows + counterpoint, provenance, footer).

**Unknowns ledger (each spiked or assumed with a falsifier):**
- Would real cl100k counts be available? → SPIKED: `npm install` in wiring/experiments succeeded;
  counts match the frozen manifest (2089 / 1316 / 845) exactly. Falsifier passed.
- Would Google Fonts load in the sandbox? → ASSUMED no; fallbacks specified in `tape.css`. Screenshots
  were taken with fallback fonts, so the published pages look at least as good as verified.
- Would the twin's routing be mistaken for the judge's belief? → ASSUMED risk; every page's second
  counterpoint says the judge is a twin, and demo 06 labels its P(GREEN) device explicitly.
- Do the four theater trees follow a code-checkable rule? → SPIKED in the brief: answer-type class of the
  last sub vs the root; demo 05 asserts agreement with the grader's `VALID_TREES` on all 10.

## 2. Work-unit graph

| # | unit | output type | depends on | done when | owner |
|---|---|---|---|---|---|
| WU0 | read both corpora + the five meta-suite skills | `DomainMap` | — | every entity above has a file | coordinator |
| WU1 | data builder | `data/*.js` + `provenance` | WU0 | counts equal the frozen manifests; 53 sources hashed | coordinator |
| WU2 | design system + runtime | `tape.css`, `tape.js` | WU0 | Tape, twin, compose, helpers; frozen before fan-out | coordinator |
| WU3 | exemplar demo 01 | `01-pack-gate.html` | WU1, WU2 | shoot.mjs ok at desk + phone; screenshots reviewed | coordinator |
| WU4 | builder brief | `META/BUILDER-BRIEF.md` | WU3 | a fresh agent can build a demo from it alone | coordinator |
| WU5a | demos 02–04 | 3 × html | WU4 | per-demo done criteria in the brief | builder A |
| WU5b | demos 05–07 | 3 × html | WU4 | same | builder B |
| WU5c | demos 08–10 | 3 × html | WU4 | same | builder C |
| WU6 | gallery + README + META docs | `index.html`, `README.md`, `META/*` | WU3 | links resolve; gallery shoots ok | coordinator (parallel with WU5) |
| WU7 | composition gate | `META/oc-check.mjs` + `02_OC_GATE.md` | WU5 | every page passes every check; failures fixed | coordinator |
| WU8 | screenshot review | `shots/*.png` | WU5, WU7 | every page looked at; visible defects fixed | coordinator |
| WU9 | commit + push both repos; publish gallery | commits | WU8 | on `claude/blissful-ride-baii3b` in both repos | coordinator, human approves |

Critical path: WU0 → WU1/WU2 → WU3 → WU4 → WU5 → WU7 → WU8 → WU9.

## 3. Parallel lanes (the five criteria, checked)

WU5a ∥ WU5b ∥ WU5c ∥ WU6: no shared write target (each builder writes only its three files; the
coordinator writes index/README/META), no output dependency between them, shared inputs frozen (assets,
data, exemplar, brief), no contended resource except the screenshot folder (per-file names, no
collision), and a fan-in owner (WU7/WU8). The brief forbids editing shared assets, which is the
same-slot rule stated at plan time rather than caught at merge time.

## 4. Gates

- **G1 data gate** (mechanical): token counts computed by the builder equal the frozen manifests.
- **G2 page gate** (mechanical, `shoot.mjs`): no console errors, no horizontal overflow at 390 px, primary
  button drives the page.
- **G3 composition gate** (mechanical, `oc-check.mjs`): each page carries the required parts, loads only
  shared data, has a provenance table, never fetches, never mentions a key.
- **G4 eye gate** (human-in-the-loop by the coordinator): every screenshot looked at; overlapping text,
  clipped labels, or an empty stage is a defect.
- **G5 human gate**: push to the designated branches is the irreversible step; it follows the session's
  standing instruction to commit and push on `claude/blissful-ride-baii3b`. No PR is opened.

## 5. Kaizen loop

Edit history is appended to `04_LEDGER.md` after each batch. Replan triggers: a builder reports a data
shape it cannot find; a page fails G2 twice. Stop-the-line triggers: any page attempts a network call to
the judge; any number without a file.
