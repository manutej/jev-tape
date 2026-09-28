# SURFACES-VIBIUM — the browser cut

Status: **drafted, twins green, not yet measured live.** Pin `jev-1.13.0`. Queue `jev-tape`. No new product name.
Addendum to `SPEC-v1-TAPE.md` and `SPEC-v1-SPEED.md`; it does not change the loop, it names a third surface after Gmail and GitHub.

## 1. Why a browser surface

Vibium ([VibiumDev/vibium](https://github.com/VibiumDev/vibium), studied on HermeticOrmus's `feat/linear-tasks`, v26.8.21) drives Chrome over WebDriver BiDi with a verb-shaped CLI: `go`, `map`, `click @e3`, `fill`, `text`, `diff map`. A warm CLI call is ~13 ms. Its own model loop, `vibium run` and `vibium check`, is 20–150 s per call (field report, 2026-09-16, n≈100 cells). Everything slow in a browser step is a model turn. Jev's job here is to take the **bounded forks** out of that turn: may this click run, did the page do what the step said. A text model is still the planner; Jev is the typed `if`.

## 2. Planes

| Plane | Owns |
| --- | --- |
| Vibium | Sensor and actuator. `url` / `title` / `text` / `map` in, verbs out. |
| Code (`src/vibium/`) | Control flow, verb classes, host allowlist, ref validity, label diff, redaction, C10 keywords, tape. |
| TypeSafe `jev-1.13.0` | One POST per gate over one snapshot. Answers only. |
| LLM | Plans the next step. Only on `escalate`. Never inside this loop. |
| Human | `human` route (C10), `escalate` when the operator's policy says so. |
| Tape (`runs/*.jsonl`) | Every answer map, once. Replay never re-POSTs. |

## 3. Verb classes → speed paths

| Class | Verbs | Path | POSTs |
| --- | --- | --- | --- |
| read | map, text, url, title, screenshot, html, find*, count, a11y-tree, is, value, attr, frames, wait*, cookies (list), storage (export) | 0 | 0 |
| tab-edit | fill, type, select, set/unset, check/uncheck, focus, hover, scroll, press Tab | 0 | 0 |
| nav | go, back, forward, reload | 0 (host allowlist in code) | 0 |
| commit | click, dblclick, press, keys, upload, drag, eval, dialog, content, cookies set, storage restore, mouse | 1 gate POST | 1 |
| any commit with `expect` | + `browser.step-verify` after the action | 1 verify POST | +1 |

A tab edit stays in the tab until a commit verb sends it anywhere; that is why a full login (go, fill, fill, click, verify) costs **two** POSTs, not five.

Path 0 checks that run before any POST, all in code (`step.ts`): host allowlist; `@ref` still present in the current map (stale ⇒ throw, caller re-maps); C10 keyword on the target label (`pay`, `send`, `delete`, …) ⇒ route `human`, no POST, no act; typed values redacted and password fields blanked in what the judge sees.

## 4. Packs

Packs are JEV-works `kit/modules` Contexts, vendored under `packs/`. Canonical copies and their meta-type lint live in JEV-works `kit/modules/contexts/browser.*.json`. `loadPack()` re-checks the run-time shape rules (one question mark, declared `reads`, noul ends, choice escape option, compose references) so a drifted copy fails closed.

| Pack | Module | State the judge reads | Verdict |
| --- | --- | --- | --- |
| `browser.action-gate` | `action-gate` | url, title, action (redacted), target map line, text excerpt | auto / refuse / escalate |
| `browser.step-verify` | `step-verify` | claim, beforeUrl, afterUrl, urlChanged, title, text excerpt, labelsAdded, labelsRemoved | verified / contradicted / unsupported |
| `browser.step-verify` | `login-verify` | same | landed / not landed / stop showing |

`labelsAdded` / `labelsRemoved` come from `labelDiff()` in code: vibium's `diff map` is positional and re-numbers every ref when one element is inserted (the failed login shows 9 positional changes and 1 real one). `urlChanged` is a string compare in code. Every `notForJev` line in a pack names the code that replaced the question.

## 5. Acceptance (speed)

- A read verb makes 0 snapshots and 0 POSTs.
- A full sign-in flow (nav + 2 tab edits + gated click + verify) makes ≤ 2 POSTs. Measured in the twin: exactly 2.
- Replay of any recorded step makes 0 POSTs; a tape miss on replay is an error, not a fetch.
- A C10 target never reaches TypeSafe and never acts.
- No typed value and no password field content ever appears in a request body.

Budget per live step, to be confirmed on the first keyed run: snapshot ≈ 4 × 13 ms, gate p50 ≈ 130 ms, act = page time, verify ≈ 50 ms + 130 ms. Abort a POST at 1.5 s and route `escalate`: a stalled call must not make the fast path slower than the model turn it replaced (NETER P23 tail).

## 6. FIRE (unrepresentable here)

Jev picking coordinates. Jev computing the diff, the URL change, or the element count. Jev deciding a retry. A second submit decided by anything but session state. A password in `state`. Acting before the gate. Verifying before the snapshot settles. `jev-latest`. TypeSafe on replay.

## 7. Not measured yet, and what measures it

Neither pack has a confidence profile on a browser corpus. Until it does, `auto` is a hypothesis. The corpus is `fixtures/vibium/*.json` plus whatever `npm run vibium -- --corpus` appends. Then, in JEV-works:

1. `measure-confidence` per question: expect `outcome` (claim vs evidence) to be the weakest, since it is the least literal; if it is MOVE-TO-CODE, the verify lane keeps only `errorShown`, `blocked`, and the login leaves, and non-literal claims go to `vibium check`.
2. The OC tree in `handoffs/vibium/toq-login-verify.yaml` through the four collapses (G10).
3. The operator interview `handoffs/vibium/interview-login-verify.md` is how a new common task becomes a pack: episode leaves that are visible on one page become atoms; exact strings, cookies, timers, and retries become `notForJev`; money and sends become C10.

## 8. Run

```bash
npm test                                   # twins: fake browser, scripted judge, no key
export VIBIUM_BIN=/path/to/vibium          # or `vibium` on PATH
npm run vibium -- --url https://the-internet.herokuapp.com/login \
  --fill @e1 tomsmith --fill @e2 'SuperSecretPassword!' \
  --click @e3 --expect "the user is signed in and sees the secure area" \
  --verify-module login-verify --allow-host the-internet.herokuapp.com --headless --stop
npm run vibium -- ... --replay             # same flow from the tape, 0 POSTs
```

In a root container Chrome needs `VIBIUM_CHROME_ARGS="--no-sandbox"`; behind a TLS-inspecting proxy add `--ignore-certificate-errors`. Neither is needed on a laptop.

Launch flags go on the daemon, once. The CLI forwards `--headless` (and `--engine`, `--channel`) to the daemon as a `browser_start` before every verb that carries them (`cmd/clicker/daemon_client.go`), so passing the flag on every call is not free once a browser is up: the first live run paid an 18 s "snapshot" and lost its `@refs` between `map` and `fill`. `ensureDaemon()` starts the session's daemon with the flags if it is not running; `vibium()` never adds them. Four reads in `snapshot()` run in sequence, and `map` is last so the refs it mints are the ones the next verb resolves.

## 8a. First live run, 2026-09-28

Keyed, `jev-1.13.0 (direct)`, Chrome for Testing 152 headless in a root container behind a TLS-inspecting egress proxy.

| What | Measured |
| --- | --- |
| vibium read (url / title / text / map), warm | ~13 ms each; a 4-read snapshot 41–56 ms |
| gate POST (4 questions, ~700-token state) | 331 ms in the loop; kit over 43 targets p50 186 ms, p95 240 ms, $0.00155 total |
| verify POST (3–4 questions) | kit p50 255–269 ms |
| `score` shape | expected level on a 0-based legend (0.3 from p={0:.72, 1:.27, 3:.01}); probabilities per level alongside |
| login click, gate verdict | **escalate**: mutatesWorld 0.79–0.81, reversible 0.39, spendsOrSends 0.29–0.37 — mid-band on two pages, no rule fired, default held |
| operator answers compose (`--approve-escalate`), then verify POST (`login-verify`) | **true** in 503 ms: signedInSignsShown 0.99, loginFormGone 0.98, credentialErrorShown 0.02, interstitial none (p 1.00) |
| whole login flow against the local fixture site | 4.7 s, of which 0.6 s page load; 1 POST + 1 tape hit on the second run |

Label-free question quality on the 43 gate targets: `mutatesWorld` JEV-SAFE (91% at ends), `blastRadius` JEV-SAFE (91%), `reversible` JEV-SAFE (72%), `spendsOrSends` MARGINAL (40%). Verify and login sets are below the 8-observation floor, so no verdict; on the labels they carried, every answer was right except `loginFormGone` on the page where the flash was closed but the form was still gone (0.64, mid-band). Results: JEV-works `kit/results/browser-*-2026-09-28.json`.

Reading the escalate: a sign-in submit does change server state, so 0.79 on `mutatesWorld` is a fair answer to the question as worded, and by rule 7 the threshold is not moved because the result disappointed. The lever is the instrument or the policy: either the operator names routine commits (a submit labelled Login on an allowlisted host) in `Policy` so path 0 approves them in code, or the question is re-worded to what the operator means by "changes something". Both are code or wording, neither is a threshold.

Two environment facts learned the hard way, both handled in code now: the egress proxy here gives up on an upstream after 30 s and hands Chrome a document whose whole text is "upstream request failed"; the public demo host sleeps and cold-starts in ~30 s. `settleNav()` waits for load, treats an empty map on a near-empty document as a failed navigation, reloads once, then fails closed. `scripts/fixture-site.mjs` serves the same three pages locally so a live run does not depend on a sleeping host.

## 8b. Same claim, same page: Jev POST vs `vibium check` (2026-09-28)

`npm run bench`. Eight real public pages, opened once each in one Vibium session; the same claim asked of Jev (`step-verify`, one POST) and then of Vibium's own model loop (`check`, xai/grok-4.6). Raw: JEV-works `kit/results/browser-bench-check-vs-jev-2026-09-28.json`.

| page | claim | expected | Jev | `check` | ratio |
| --- | --- | --- | --- | --- | --- |
| npmjs.com/package/react | npm page for react | passed | **escalate** 309 ms (`blocked` fired: Cloudflare bot wall) | failed, 141.7 s | 459× |
| rfc-editor.org rfc2324 | about RFC 2324 | passed | passed 248 ms | passed 25.2 s | 102× |
| wikipedia Common_Lisp | the Common Lisp article | passed | passed 250 ms | passed 41.0 s | 164× |
| MDN flexbox guide | documents flexbox | passed | passed 277 ms | passed 17.4 s | 63× |
| wikipedia Ada_Lovelace | says she invented JavaScript | failed | **escalate** 241 ms (unsupported, not contradicted) | failed 53.3 s | 221× |
| github torvalds/linux | the repo page | passed | passed 219 ms | passed 15.8 s | 72× |
| wikipedia Python | says Torvalds created it | failed | failed 246 ms | failed 45.8 s | 186× |
| news.ycombinator.com | front page lists stories | passed | passed 236 ms | passed 18.2 s | 77× |

Medians: Jev **248 ms**, `check` **41.0 s**, ratio **164×**. Jev decided 6 of 8 and matched the expectation on all 6; the other 2 escalated, which is the safe verdict and what the model fallback (§3a) is for. `check` matched 7 of 8 and took 142 s on the one it missed. Two of the Jev POSTs were larger than the login ones (~1,900 input tokens: page text excerpt plus up to 60 map labels) and still sat at 220–310 ms.

What this does and does not show. It shows the per-decision cost gap on literal claims about one page. It does not show accuracy at scale (n=8, hand-set thresholds, no fit/test split: G4 and G8 would refuse a headline). The npm row is the interesting one: `blocked` is a code-shaped question, and Jev raised it in 309 ms where the model loop spent 142 s investigating a bot wall.

## 3a. Fallback order

Jev first. On a **verify** escalate, the text model (`llmFallback`, wired to `vibium check` by `--llm-fallback`) with the step's own claim; on the model's own escalate, a person. On a **gate** escalate, policy or a person, not the model: asked whether a click would be safe, `check` investigates for its whole 3-minute budget and times out with no verdict (measured, §8c). Never the model after a Jev refusal, and never the model for a C10 park: those belong to the person.

## 8c. The same login three ways (2026-09-28, local fixture site, screenshots per step)

| variant | what decides | wall time | of which page load | decisions | outcome |
| --- | --- | --- | --- | --- | --- |
| A. model only | `vibium run` (grok-4.6) plans and acts, `vibium check` verifies | **32.8 s** | 0.6 s | run 14.8 s, check 17.3 s | completed, passed |
| B. Jev + operator policy | scripted verbs; Jev gates the submit (escalate → operator compose); Jev verifies | **5.0 s** | 0.7 s | gate 0.33 s and verify 0.50 s when fresh; 81 ms together from the tape on this run | verified true |
| C. Jev + model fallback on the gate | as B, but the gate escalate goes to `check` | 185 s | 0.7 s | `check` timed out at 180 s, no verdict → parked | not applied (correct fail-closed) |

Whole task: about **6×** (B over A). The decisions alone: about **40×** with fresh POSTs, more from the tape. The gap that remains in B is the page itself. Variant A also plans the steps, which B does not: B is the shape for a known flow (a playbook), A for an unknown page. The per-decision gap on real pages is in §8b.

## 8c′. Cross-check against a computer-use style agent (2026-09-28)

Claude computer use was not available in the session; a Sonnet screenshot-only proxy ran the same two experiments (details, blinding, and per-row table in `docs/COMPUTER-USE-CROSSCHECK.md`). Same eight pages, blind: Jev median **248 ms** vs Sonnet screenshot judge **2.8 s** read-and-decide (9.2 s agent wall), Jev 6/6 decided right + 2 escalates, judge 7/8 against the label (its miss is the Cloudflare-walled npm page, where it was right about the image). Same login, pixel-driven operator (screenshot, click x y, one key per press): **14.2 s** self-timed, 23.1 s wall, passed; Jev + policy 5.0 s; model-only 32.8 s.

## 8d. Real sites, gated and verified, no person and no model in the loop (2026-09-28)

| site | step | gate | verify | note |
| --- | --- | --- | --- | --- |
| news.ycombinator.com | click "new" | auto, 435 ms (mutatesWorld 0.06) | true, verified 0.97 | whole step 1.6 s; page load 6.3 s |
| en.wikipedia.org Special:Search | fill, press Enter | auto, 264 ms | true, but verified at **0.48** | exposed the missing peakedness rule; `outcome` now escalates above normalised entropy 0.6 |
| github.com microsoft/vscode issues | fill @e34, press Enter | auto, 320 ms | **contradicted 0.64** | and it was right: the scripted fill never stuck in GitHub's search component, URL unchanged, 18,437 open. Model-only: `run` 20.9 s then `check` 29.1 s passed on the page it had typed itself |

The GitHub row is the one to remember: the verify lane caught a silently failed action in 332 ms. With rule 0 it would now escalate (entropy 0.64) to `vibium check`, which is also correct; either way the loop knows.

**Check only, or Run too.** The gate is already a Run-side fork (may this act), and verify is the Run loop's feedback after every commit, not only a final Check. `src/vibium/pick.ts` adds the next Run-side fork: which element on this page is the one the step needs, as one Choice over the map lines with `none` as the escape; a pick is used only when it is peaked (p ≥ 0.85). Page routing (login wall, form, listing, error, captcha, consent) is the fork after that. Planning an unknown page from a goal stays with the model.

Measured live on github.com/microsoft/vscode/issues, 80 candidate elements in one Choice:

| goal | pick | p | entropy | ms |
| --- | --- | --- | --- | --- |
| search the issues by typing a query | `@e34 [input] placeholder="Search Issues"` | 0.99 | 0.01 | 304 |
| open the pull requests tab | `@e13 [a] "Pull requests"` | 1.00 | 0.00 | 163 |
| pay for a GitHub subscription | `none` (escape) | 0.90 | 0.10 | 176 |

One POST replaces the planner turn that would otherwise choose the element, and the escape option holds when nothing fits. n=3, one page: a lead, not a law.

## 8e. The larger number space: 80 rows, 3 parallel workers (2026-09-28)

`npm run corpus -- --workers 3` over `fixtures/vibium/catalog-pages.json`: 40 public pages, each with a true claim and a false claim. Each worker is its own Vibium session making its own Jev calls.

| | |
| --- | --- |
| wall time | 88 s for 80 rows (nav median 1.5 s, Jev median 178 ms) |
| settled | 74; 6 never settled: PyPI's bot check ("is verifying your browser") ×3, gnu.org 429 to three parallel workers ×2, one empty document. Caught in code, no call made |
| decided | 73 of 74, **73 right, 0 wrong**; 1 escalate (WCAG quick reference, `outcome` entropy 0.78 → rule 0) |
| cost | 74 POSTs, about $0.005 |

Lab measurement over the same 74 items (JEV-works `kit/results/browser-step-verify-corpus-2026-09-28.json`): `outcome` JEV-SAFE (82% at ends), **98.6%** vs majority 50%, McNemar b=36 c=0, p = 2.9e-11, coverage 100% ≥ declared 90%. `errorShown` and `blocked` came back NO-INFORMATION: every page in this catalog is a normal page, so they answered the same way every time. That is a catalog gap (add 404 / 500 / login-wall / consent rows), not a question defect; on the bench run `blocked` was the question that caught the Cloudflare wall.

What this is: coverage, consistency, and latency under parallel load on a sample big enough for the kit's own verdicts. What it is not: a generalisation claim. The claims were written with the pages known (L31), the false ones are mostly wrong-subject claims, and thresholds are hand-set. The next step is a fit/test split with claims written blind, and rows with actions so the gate gets the same treatment.

## 9. Next cuts, in order

1. First keyed run; record the gate's score indexing and the real p50 per POST in this file.
2. `pickRef(goal)`: one Choice over the map lines (escape `none`) to choose the element for a step, replacing a planner turn for routine pages. Validate before trusting; rank-wide-read-narrow lane.
3. Batch: gate several pending commits over one snapshot in one POST (question ids suffixed per action).
4. Toward Vibium itself (feature branch + PR to HermeticOrmus): a typed gate in front of `report linear` on `walk` packs, and a `jev` skill beside `browser` and `check`. Not before 1–2.
