# Temporal contract — scripts and twins must match this

Binding for `SPEC-v1-TAPE.md`. If a script disagrees with this file, the script is wrong.

## One loop

Apply last. TASK_QUEUE is `jev-tape`.

`assertLegalCommand → qualifyTask → gate → propose → qualifyOutput → gate → applyCommand`

Illegal: apply then qualifyOutput; scoreFill as a gate; `jev-latest`; TypeSafe on replay; starting a Cloud worker from `npm run live`; a stub verdict without `source: "stub"` on the step.

## Files

| File | Role |
| --- | --- |
| `src/typesafe/pack.ts` | The v2 question trees as code. Source: `spec/QUESTIONS-TASK-v2.md`, `spec/QUESTIONS-OUTPUT-v2.md`. |
| `src/loop.ts` | Pure loop: tree compose + OC check, propose. No IO. |
| `src/item.ts` | runItem over injected ports. Twin and Workflow share it. |
| `src/judge.ts` | live (key) / stub (opt-in) / fail closed. |
| `src/engine.ts` | Unit twin. This is what runs without a server. |
| `src/job.ts` | Worklist fold. ContinueAsNew every 8. |
| `src/waiting.ts` | Waiting twin. |
| `src/someday.ts` | SomedayReview twin. |
| `src/habit.ts` | Habit twin. CreateHabit illegal. |
| `src/temporal/workflows.ts` | Same names and branches. |
| `src/temporal/activities.ts` | qualifyTask, qualifyOutput, applyCommand, typesafeJudge, recordEvent, pullSurface, seenThreadIds. |
| `src/surfaces/mcp.ts` | jev as an MCP client (stdio or HTTP). Worker only. |
| `src/surfaces/codec.ts` | connector result → Capture commands, in code. Gmail first. |
| `src/surfaces/scrub.ts` | addresses, phones, codes, URLs out before anything is judge state. |
| `scripts/ingest.ts` | one SurfaceIngestWorkflow, or a Temporal Schedule with `--every`. |
| `scripts/mcp-fake-gmail.ts` | stdio MCP server that pages a local pack; tests and demos without Gmail. |
| `src/temporal/worker.ts` | TASK_QUEUE=jev-tape. Local dev server by default; Cloud via TEMPORAL_ADDRESS/API_KEY. |
| `src/temporal/connection.ts` | Where Temporal is. Env only. |
| `scripts/demo.ts` | Three workflows through a real server. `--crash` kills and resumes a worker. |
| `scripts/replay.ts` | Replays Event History with no judge. Must pass the real workflowId. |
| `scripts/harness.ts` | Live tape over SSE: steps, parks, verdict buttons. Serves `harness/index.html`. |
| `scripts/live-run.ts` | One Capture through startEngine. |
| `scripts/smoke-key.ts` | Pin check. |
| `scripts/qualify-surface.ts` | Fixture → System One. Never send. |

## Names

Workflows: JevCorrectnessWorkflow, WaitingWorkflow, HabitWorkflow, SomedayReviewWorkflow, SurfaceIngestWorkflow.
JevCorrectnessWorkflow runs each batch of 8 concurrently (items are disjoint); a park never blocks its neighbours.
Signals: humanVerdict {compose\|escalate\|refuse}.
Pin: jev-1.13.0. Pack: v2.0 (24 task + 4 output questions, one POST each). Every verdict carries `pack` and `oc`.

## Retry

Retry: TypeSafe 5xx / 429 / 529.
Non-retryable: 401, 422, missing key, QualifyRed, ContractViolation, response.model !== jev-1.13.0.

## npm

`npm test` no key (workflow tests need a Temporal dev server or `TEMPORAL_CLI`; they skip loudly otherwise).
`npm run smoke` / `live` / `qualify` need TYPESAFE_API_KEY. `npm run worker` / `demo` / `replay` need a Temporal server.
`npm run live` never starts a worker. Without a key, only `JEV_JUDGE=stub` lets `demo` run, and every verdict says so.
