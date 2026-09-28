# HANDOFF — jev-tape Temporal MVP (as of 2026-09-28, commit fcdff69)

Read this first. It is the compact state of the build: what exists, what was decided and why, what is proven, what is
not, and what the next round should take up. Companion docs: `TEMPORAL-MVP.md` (how to run), `PARALLELISM.md`
(measured evaluation), `spec/TEMPORAL.md` (binding contract), `spec/QUESTIONS-*-v2.md` (the question instruments).

## 1. Where things are

| What | Where |
| --- | --- |
| Branch / PR | `claude/youthful-cannon-7oev48` → https://github.com/manutej/jev-tape/pull/1 (9 commits over `main`, unmerged) |
| Runtime | Node ≥ 22.18 (type stripping), `@temporalio/*` 1.24.0, `@modelcontextprotocol/sdk` 1.30, zod 4 |
| Tests | `npm test` → 33 pass (unit: loop, engine twin, four twins, codec/scrub/MCP; on a Temporal dev server: worklist + replay, waiting, harness end to end, ingest end to end) |
| Static gates | `npm run check` (FIRE unrepresentable, 11 checks) · `npm run temporal` (scripts match spec/TEMPORAL.md) · `npm run typecheck` |
| Data | The 1,244-item Gmail pack is NOT in the repo. It lives in the zip delivered in chat; load to `.jev-tape/pack.json` (gitignored). Fetching stopped by request; cap was 1,500 and never reached |
| Line count | ~3,800 lines of TS + one HTML page |

## 2. What exists (by plane)

**Operad names the questions.** `spec/QUESTIONS-TASK-v2.md` (24) and `spec/QUESTIONS-OUTPUT-v2.md` (4) are typed
question trees derived with the operadic-interview instrument and linted (`treelint.py` passes; two documented star
delegations). `src/typesafe/pack.ts` encodes them. Pack version `v2.0` rides on every verdict.

**TypeSafe answers.** `src/judge.ts`: `live` (jev-1.13.0 over `api.typesafe.ai` when `TYPESAFE_API_KEY` is set),
`stub` (opt-in `JEV_JUDGE=stub`, every verdict stamped `source: "stub"`, driven by text cues), else fail closed.
`src/typesafe/client.ts` validates responses at the boundary (distributions sum to 1, confidence in [0,1], pin match).

**Code gates.** `src/loop.ts`: `localGate` (path 0: illegal commands never reach a judge), tree compose exactly as the
specs state, dual axes (θ = 0.7 on P(GREEN), top_prob_floor = 0.55), C10 floor, and the operadic-consistency (OC)
check: composed light vs collapsed root from the same POST; disagreement is a recorded FINDING with its kernel and the
verdict takes the more conservative light. `src/item.ts` is the loop once, over injected ports; the twin
(`src/engine.ts`) and the workflow share it.

**Temporal records.** `src/temporal/workflows.ts`: `JevCorrectnessWorkflow` (lanes of commands, batch of 8 runs
concurrently, C10 park on Signal `humanVerdict`, ContinueAsNew every 8 carrying keys + verdicts only),
`WaitingWorkflow`, `HabitWorkflow`, `SomedayReviewWorkflow`, `SurfaceIngestWorkflow` (MCP pages → codec → dedupe →
child lanes). `activities.ts`: `qualifyItem` (one POST, both gates; default), `qualifyTask`/`qualifyOutput`
(`gates: "two"`), `applyCommand` (idempotent by `workflowId:index`), `recordEvent`, `pullSurface`, `seenThreadIds`,
`typesafeJudge`. Tape = append-only JSONL with an in-memory key index and incremental tail scan. `worker.ts`: queue
`jev-tape`, local dev server by default, Cloud via `TEMPORAL_ADDRESS`/`TEMPORAL_NAMESPACE`/`TEMPORAL_API_KEY`.

**Surfaces (no model in the loop).** `src/surfaces/mcp.ts` (jev as MCP client, stdio or streamable HTTP),
`codec.ts` (Gmail `search_threads` → Capture commands; generic path-map codec), `scrub.ts` (addresses, phones, codes,
URLs, card-like runs out before anything is judge state). `scripts/mcp-fake-gmail.ts` is a real stdio MCP server that
pages a local pack in the connector's shape, for tests and keyless demos.

**Harness.** `scripts/harness.ts` + `harness/index.html` at :4848: SSE step stream from the activities, loop counters,
one row per item with both gate lights, judge ms, source, OC markers, judge-derived kind; layers (chips), group,
sort, filter with FLIP animation; park verdict buttons; lanes + park timeout controls; local pack loader; Ingest
button; tape view; Temporal UI deep links. Keyboard: 1–9 layers, `g` group, `s` sort.

**Scripts.** `demo` (3 workflows, `--crash`, `--pack`), `replay` (0 POSTs proof; passes the real workflowId),
`ingest` (once or `--every 15m` Schedule), `pack:scan`, `live` (twin), `smoke`, `qualify`, `temporal:dev`, `worker`.

## 3. Decisions taken (with the user) and why

| Decision | Choice | Why |
| --- | --- | --- |
| Judge without a key | Fail closed + opt-in stub, loudly stamped | Spec: no local fake; demo still needs the tape story |
| Visible harness | Live SSE dashboard | Temporal UI shows history, not gate semantics or ms |
| Pack size for the demo | ≥ 500 real inbox items, stopped at 1,244 | User request; later cap 1,500 |
| Questions | Derived with operadic-interview + meta-operad, 28 total | Spec says the operad names questions; hand-written v1 was a gap |
| Ingest | Generic MCP-client adapter + ingest workflow, Gmail first | Removes the LLM from ingestion; any MCP server becomes a surface |
| Gates per item | One POST for both trees (`qualifyItem`) | propose is pure; SPEC-SPEED forbids sequential TypeSafe; measured 15% with a 0 ms judge, a full round trip more live |
| Lanes | Big packs split into parallel worklists; batch of 8 concurrent inside a lane | 2.6x measured; a park no longer blocks neighbours |

## 4. Proven vs not proven

Proven on a real Temporal server here (stub judge): two gates and apply-last; C10 park by Signal; ContinueAsNew; crash
of a worker mid-run and resumption with 0 duplicate applies; replay with 0 POSTs; timers + Signals in Waiting; Habit
minting; MCP stdio ingest with dedupe; 1,244 items in 21 lanes in 80 s; 400 items in 9.6 s after optimization.

Not yet done: **a single live run with jev-1.13.0.** Every verdict on the tape so far is `stub`. The key never reached
this cloud session (env vars are injected at container start). The first live run on the user's machine is the
baseline; expect different AMBER/RED rows and real OC findings.

## 5. Known limitations and risks

- **θ and top_prob_floor are hand-set.** JEV-works' own gate G8 refuses hand-set thresholds; they must be fitted on a
  labeled split from the tape before any claim about calibration. Nothing in this repo claims calibration.
- **The tape is a JSONL file.** Idempotency works per process with a tail scan; a real projection needs a table with a
  unique index on `key` and on `threadId`. `entries()` still reads the whole file (harness /tape, twin).
- **Replay compatibility.** Histories recorded before the concurrent-batch and one-POST changes do not replay on the
  new code. Future workflow changes should use `patched()` if old histories must stay replayable.
- **Hosted Gmail connector is not dialable from Node.** The adapter needs a local Gmail MCP server (any) or a direct
  Gmail API transport; only the fake server has been exercised end to end.
- **Harness is a single process on localhost with no auth.** Fine for a demo, not for exposure.
- **Blob limits.** ContinueAsNew carry is now bounded; the worklist result still returns the last run's outcomes only.
- **Stub cues leak into demo behaviour** ("?" parks, "[red]" refuses, money/reply words go AMBER). Do not read stub
  lights as judgments.
- **Dev-server timers** fire with ~1 s latency; tests allow for it.

## 6. Environment notes

- Cloud session: Temporal dev server binary and data live in the session scratchpad; harness ran on :4848 with
  `JEV_JUDGE=stub` and the fake connector. None of that persists; the repo does.
- User's Mac: clone at `/Users/manu/Documents/LUXOR/PROJECTS/HALCON/claude-sdk-microservice/jev-tape` (per npm log
  path); earlier untracked drafts were moved to `../jev-tape-local-drafts/` before checkout. Full run steps are in
  `TEMPORAL-MVP.md` and in the last chat message ("Clear local steps for the demo").

## 7. Next round — candidates, in recommended order

1. **First live run and baseline.** Run the 1,244 pack with the key; record POST count, p50/p95 ms, light
   distribution, OC finding rate, judge kind vs subagent category agreement. Keep the tape as `baseline-v2.0`.
2. **Calibrate instead of hand-set.** Label ~150 items from the tape (compose/escalate/refuse), fit θ and
   top_prob_floor with JEV-works `kit/threshold.ts` (G8/G9 gates), version the pack to v2.1.
3. **Real connector.** Pick a local Gmail MCP server (or add a direct Gmail API transport behind the same codec), run
   `npm run ingest -- --every 15m`, and add the GitHub codec named in `spec/SURFACES-GMAIL-GITHUB.md`.
4. **Projection store.** Replace the JSONL tape with SQLite/Postgres (unique index on key and threadId); harness and
   layers read from it; keep the file tape as the twin's default.
5. **Beyond Capture.** Clarify flows (ToNextAction / ToWaiting / ToSomeday / ToReference) from the judge's Q6 kind,
   with C10 where the domain says so; Waiting and Someday visible in the harness.
6. **Workflow versioning and Cloud.** `patched()` around future changes; one run on Temporal Cloud with the same
   worker (`TEMPORAL_ADDRESS`/`TEMPORAL_API_KEY`).
7. **CI.** GitHub Actions job that downloads the Temporal CLI, starts the dev server, runs `npm test`; a SessionStart
   hook for cloud sessions.
8. **Merge PR #1** once the user's parallel merges land; rebase or merge `main` into the branch first.

## 8. Open questions for the user

- Which Gmail MCP server (or direct API) on the Mac for real ingest?
- Is the JSONL tape acceptable through the demo, or is the projection store wanted before it?
- Should old histories stay replayable (adds `patched()` discipline) or is "new runs only" fine until Cloud?
