# Handoff for the Vibium team: a typed judge in front of the browser

Date 2026-09-28. Jev pin `jev-1.13.0`. Vibium 26.8.21 built from HermeticOrmus/vibium `feat/linear-tasks`.
Model runs on xai grok-4.6. **Source of truth: `docs/SOURCE-OF-TRUTH.md` and `results/registry.json`** (every number below traces there; other sessions add results through `results/incoming/`).
Page version of this brief, in the Ormus Fusion chrome: `docs/vibium-team-brief.html`
(published copy: https://claude.ai/artifact/WbfHE1ZKWmNGeR92iyx2d6).

## Executive summary

Jev answers the two questions a browser loop asks most, in about a quarter of a second, without a model
turn: **may this click run?** (gate) and **did the page do what the step said?** (verify). Vibium does the
acting. Code classifies each verb so reads and tab edits never call Jev; only commit verbs reach the gate;
a tape replays answers it has seen; money, sending and deletion park for a person before any call.

On literal browser decisions Jev is **164× faster** than the model loop and was **wrong zero times in 79
decided verdicts**. Three escalated instead of guessing. A whole login with Jev gating and verifying took
**5.0 s** against 32.8 s for the model-only loop. All lab runs on 2026-09-28 cost about two tenths of a cent.

| Headline | Number | n | Baseline |
| --- | --- | --- | --- |
| Time per decision, same page and claim | Jev 248 ms · Sonnet screenshot proxy 2.8 s · `vibium check` 41.0 s | 8 pages | ratio 164× vs check, 11× vs proxy |
| Right answers | Jev 6/6 decided + 2 escalates (bench), 73/73 + 1 escalate (corpus) | 8 + 74 | check 7/8; corpus majority baseline 50%, p = 2.9e-11 |
| Whole login | Jev + policy 5.0 s · pixel operator 14.2 s · model only 32.8 s | 1 flow × 3 | page load 0.6–0.7 s of each |
| Calibration | Brier 0.006 on `outcome` | 74 rows | in-sample labels, one label found wrong by the recording |

What the Vibium team is asked to review: **bridge 6**, two optional hooks in the verifier loop
(`clicker/internal/verifier/loop.go`): `--gate CMD` before every mutating tool call, expecting
`auto | park | refuse`, and `--verify CMD` after each step, expecting `true | false | escalate`. jev-tape
supplies both commands. The model keeps planning; Jev gates every action it takes; the loop's 24-action,
3-minute budget stops burning on forks a typed judge settles. Bridge 2 (a skill, docs only) can land first.

## What is shown, what is not

Shown: on literal claims about a settled page, a typed judge over text is one to two orders of magnitude
faster than any model in the loop and at least as accurate on this sample; the loop shape (≤ 2 calls per
applied step, 0 on replay) is twin-tested; every relational judgement has a named code replacement; a
typed verify caught a silently failed GitHub fill in 332 ms that both model runs passed.

Not shown: accuracy beyond in-sample claims (claims written with the pages known, hand-set thresholds, no
fit/test split; the 140-row, 18-kind catalog is built and not yet run at scale); anything about Claude
computer use as a product (a Sonnet screenshot proxy stood in, blind); that `auto` is safe for routine
commits without an operator policy.

## The registry

`results/registry.json` holds 12 experiments and 152 rows: 145 Jev calls, 87 verify verdicts decided with 0 wrong and 3 escalates, 138 labelled rows of which 134 right, 50 pages on 28 sites, 3 judges. Rebuild with `npm run brief`. Add results per `results/incoming/README.md`.

| id | experiment | kind | n | stamp |
| --- | --- | --- | --- | --- |
| E1 | Gate questions on recorded targets | lab | 43 | ⚖ measured |
| E2 | Verify pairs, recorded | lab | 4 | ◐ partial |
| E3 | Login pairs, recorded | lab | 3 | ◐ partial |
| E4 | Live login, fixture site | live | 2 | ⚖ measured |
| E5 | Bench: same claim, Jev vs check | live | 8 | ⚖ measured |
| E6 | Login three ways | live | 3 | ⚖ measured |
| E7 | Real sites, no person, no model | live | 3 | ⚖ measured |
| E8 | Element pick over 80 map lines | live | 3 | ⚖ measured |
| E9 | Corpus, 80 rows, 3 parallel sessions | live | 80 | ⚖ measured |
| E10 | Recording smoke | live | 2 | ✓ accept |
| E11 | Cross-check: blind screenshot judge | proxy | 8 | ⚖ measured |
| E12 | Cross-check: pixel operator login | proxy | 1 | ⚖ measured |

## Test it in place

`docs/TEST-IN-PLACE.md`: clone, `npm ci`, `scripts/test-in-place.sh`. Ten checks, no key needed for the first six; the login on the fixture site is gated, verified and replayed with your own Vibium binary; then `npm run bench` and a corpus shard with recordings reproduce the headline numbers. Verified here on 2026-09-28: pass 10, fail 0.

## Finalized results, by file

### manutej/jev-tape, branch `claude/nice-fermat-ky9qtz` (a60f2bb, contains main)

| Path | What |
| --- | --- |
| `docs/TEST-IN-PLACE.md`, `scripts/test-in-place.sh` | The Vibium team's runbook and acceptance script: fresh clone, own binary, ten checks (`pass 10 · fail 0`), then the bench and corpus |
| `docs/SOURCE-OF-TRUTH.md` | What is canonical, the registry schema, how to add results |
| `results/registry.json` | The registry: every experiment and row, with computed totals |
| `results/raw/corpus-2026-09-28.rows.json` | Per-row corpus numbers, page text removed |
| `results/incoming/README.md` | Schema and rules for other sessions' results |
| `scripts/build-registry.mjs`, `scripts/build-brief.mjs` | `npm run registry`, `npm run brief` |
| `docs/vibium-team-brief.src.html`, `docs/vibium-team-brief.html` | The page source with placeholders, and the built page: record, chips, loop diagram, questions, stamped prospects and gates, explorer of every row |
| `docs/HANDOFF-2026-09-28.md` | Session state, all measurements, next steps in order, rails |
| `spec/SURFACES-VIBIUM.md` | The design and every measurement, §1–§9; results §8a–§8e and §8c′ |
| `docs/COMPUTER-USE-CROSSCHECK.md` | Blind screenshot judge and pixel operator beside Jev and `check`; blinding protocol |
| `docs/VIBIUM-BRIDGES.md` | Seven bridges with cost, what each buys, order |
| `docs/PARALLEL-SPEND.md` | Ten-agent corpus design: recordings, Grok fallback, Haiku ground truth, calibration |
| `docs/LOCAL-DEMO.md` | Run it from a Mac: keys, binary, fixture site, demo script |
| `src/vibium/cli.ts` | Vibium CLI shim, daemon once, sequential snapshot, `labelDiff`, `excerpt` |
| `src/vibium/decide.ts` | Decision semantics ported from the kit: thresholds 0.85/0.15, entropy rule |
| `src/vibium/pack.ts` | Pack loader with shape checks; fails closed on a drifted copy |
| `src/vibium/tape.ts` | Replay tape keyed by sha256(state + questions) |
| `src/vibium/step.ts` | Step router: read / tab-edit / nav / human / auto / auto-llm / refuse / escalate |
| `src/vibium/pick.ts` | One Choice over map lines with `none` as the escape |
| `src/vibium/vibium.test.ts` | 13 twins against the fake binary and a scripted judge |
| `packs/browser.action-gate.json` | Gate questions: mutatesWorld, reversible, spendsOrSends, blastRadius |
| `packs/browser.step-verify.json` | Verify questions: outcome, errorShown, blocked; login-verify module |
| `scripts/vibium-step.ts` | `npm run vibium` |
| `scripts/vibium-bench.ts` | `npm run bench`: same claim through Jev and `check` |
| `scripts/vibium-pick.ts` | `npm run pick` |
| `scripts/vibium-corpus.ts` | `npm run corpus`: parallel sessions, recordings, Grok fallback, contentType |
| `scripts/calibrate.ts` | `npm run calibrate`: Brier, reliability bins, per-kind ends accuracy |
| `scripts/demo.sh`, `scripts/fixture-site.mjs` | `npm run demo:vibium`; local login/secure/checkout site on 8787 |
| `scripts/workflow-parallel-corpus.js` | Ten Sonnet drivers, ten Haiku labellers on a blinded manifest |
| `fixtures/vibium/catalog-pages.json` | 80 rows measured |
| `fixtures/vibium/catalog-100.json` | 140 rows, 70 pages, 18 kinds, ready |
| `fixtures/vibium/*.json`, `fake-vibium.mjs` | Recorded snapshots and the fake binary for twins |

### manutej/JEV-works, branch `claude/nice-fermat-ky9qtz` (136ffc4)

| Path | What |
| --- | --- |
| `kit/modules/contexts/browser.action-gate.json`, `browser.step-verify.json` | Canonical contexts, lint-clean M1–M7 |
| `kit/results/browser-bench-check-vs-jev-2026-09-28.json` | Eight-page bench, per row |
| `kit/results/browser-step-verify-corpus-2026-09-28.json` | Corpus verdicts, McNemar, coverage |
| `kit/results/browser-crosscheck-computer-use-proxy-2026-09-28.json` | Blind and non-blind proxy runs with the key |
| `kit/results/browser-action-gate-action-gate-2026-09-28.json` | Gate question quality on 43 targets |
| `kit/results/browser-step-verify-step-verify-2026-09-28.json`, `…-login-verify-…` | Verify and login question quality |
| `kit/modules/items/browser-gate.items.json`, `browser-verify.items.json`, `browser-login.items.json` | Labelled items |
| `kit/modules/items/browser-verify.corpus-2026-09-28.items.json` | The 74-row corpus items |
| `handoffs/vibium-browser.md` | Lab handoff: claims, next keyed run |
| `handoffs/vibium/interview-login-verify.md`, `toq-login-verify.yaml` | How the login task became a pack (operadic interview, OC tree) |
| `handoffs/vibium/interview-use-cases.md` | Open interview: which use cases to measure at scale (★ questions unanswered) |

### manutej/vibium (fork), local branch `feat/jev-typed-gate` (d0b819a), not pushed

| Path | What |
| --- | --- |
| `skills/jev/SKILL.md` | The skill: when to call the jev-tape loop instead of a model turn |
| `docs/how-to-guides/jev.md` | How-to for the typed gate and verify |

Pages: this brief https://claude.ai/artifact/WbfHE1ZKWmNGeR92iyx2d6 · leadership brief on the logic https://claude.ai/artifact/5Pqep6QZpPmnSNtPkgdToh ·
the repos in plain terms https://claude.ai/artifact/3oA6LMDN7Vbv6dM7XGvw6r.

## Next, in order

1. Answer the ★ questions in `handoffs/vibium/interview-use-cases.md`, reorder `catalog-100.json`, launch the ten-agent run with recordings, calibrate against the Haiku labels.
2. Reword `spendsOrSends`; `loginFormGone` reads `labelsRemoved` only; operator policy for routine commits on allowlisted hosts.
3. Mac test (`docs/LOCAL-DEMO.md`), push `feat/jev-typed-gate` to the fork, docs-only PR to HermeticOrmus.
4. Bridge 6 with the Vibium team.
5. Repeat the cross-check with real Claude computer use from the desktop app, same blind protocol.

## Rails

Never push to HermeticOrmus/vibium. Never paste a key. Jev never counts, compares, or decides a retry. A Jev
refusal is final. Pay / send / delete park for a person before any call. No threshold moves because a result
disappointed. Every number carries n, baseline, and whether thresholds were fitted.
