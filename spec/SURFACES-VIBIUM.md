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

## 9. Next cuts, in order

1. First keyed run; record the gate's score indexing and the real p50 per POST in this file.
2. `pickRef(goal)`: one Choice over the map lines (escape `none`) to choose the element for a step, replacing a planner turn for routine pages. Validate before trusting; rank-wide-read-narrow lane.
3. Batch: gate several pending commits over one snapshot in one POST (question ids suffixed per action).
4. Toward Vibium itself (feature branch + PR to HermeticOrmus): a typed gate in front of `report linear` on `walk` packs, and a `jev` skill beside `browser` and `check`. Not before 1–2.
