# Temporal contract — scripts and twins must match this

Binding for `SPEC-v1-TAPE.md`. If a script disagrees with this file, the script is wrong.

## One loop

Apply last. TASK_QUEUE is `jev-tape`.

`assertLegalCommand → qualifyTask → gate → propose → qualifyOutput → gate → applyCommand`

Illegal: apply then qualifyOutput; scoreFill as a gate; `jev-latest`; TypeSafe on replay; starting a Cloud worker from `npm run live`.

## Files

| File | Role |
| --- | --- |
| `src/engine.ts` | Unit twin. This is what runs. |
| `src/job.ts` | Worklist fold. ContinueAsNew every 8. |
| `src/waiting.ts` | Waiting twin. |
| `src/someday.ts` | SomedayReview twin. |
| `src/habit.ts` | Habit twin. CreateHabit illegal. |
| `src/temporal/workflows.ts` | Same names and branches. |
| `src/temporal/activities.ts` | qualifyTask, qualifyOutput, applyCommand, typesafeJudge. |
| `src/temporal/worker.ts` | TASK_QUEUE=jev-tape. Cloud sketch only. |
| `scripts/live-run.ts` | One Capture through startEngine. |
| `scripts/smoke-key.ts` | Pin check. |
| `scripts/qualify-surface.ts` | Fixture → System One. Never send. |

## Names

Workflows: JevCorrectnessWorkflow, WaitingWorkflow, HabitWorkflow, SomedayReviewWorkflow.
Signals: humanVerdict {compose\|escalate\|refuse}.
Pin: jev-1.13.0.

## Retry

Retry: TypeSafe 5xx / 429 / 529.
Non-retryable: 401, 422, missing key, QualifyRed, ContractViolation, response.model !== jev-1.13.0.

## npm

`npm test` no key. `npm run smoke` / `live` / `qualify` need TYPESAFE_API_KEY. No `npm run worker`.
