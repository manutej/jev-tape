# Temporal MVP — what runs, what it proves, how to show it

Real Temporal server. Real workers. Real Event History. The judge is jev-1.13.0 when `TYPESAFE_API_KEY` is set.

## 60-second show

```bash
npm install
export TEMPORAL_CLI=/path/to/temporal      # or have `temporal` on PATH: https://temporal.download/cli
npm run temporal:dev                        # terminal 1: server on :7233, UI on http://localhost:8233

set -a && source .env && set +a             # terminal 2: TYPESAFE_API_KEY → live judge
npm run demo                                # worker in-process, three workflows, prints the tape
npm run demo:crash                          # worker dies after 3 applies; a fresh one resumes; 0 duplicates
npm run replay -- <workflowId>              # replays Event History with no judge: 0 TypeSafe POSTs
```

Without a key: `JEV_JUDGE=stub npm run demo`. Every verdict is stamped `source: "stub"`. It is not a judgment.

Open the UI link the demo prints. Each workflow shows the two gates as Activities, the C10 park as a
Timer plus a Signal, and `ContinueAsNew` at item 8.

## What the demo drives

| Workflow | What happens | What it proves |
| --- | --- | --- |
| `JevCorrectnessWorkflow` | 11 commands. 7 apply. 4 residual: mid-band AMBER escalated, `CreateHabit` (path 0), `Complete` on a Project (path 0), judge RED. One `Complete` on a NextAction parks on C10 and is composed by Signal. | Two gates, apply last, C10 as a Workflow park, ContinueAsNew every 8, 0 POSTs for illegal commands |
| `WaitingWorkflow` | `StartWaiting` → two timer nudges (`WaitingNudged`) → `resolve` Signal → `ResolveWaiting` parks (C10) → compose | Timers and Signals across the same run |
| `HabitWorkflow` | Mints 3 `Instance`s on an interval | `CreateHabit` is never emitted; the habit only mints |
| `npm run demo:crash` | Worker process exits after 3 applies. New worker picks the workflow up. | Recovery from Event History with an idempotent tape: 0 duplicate rows |
| `npm run replay` | Feeds each run's history to the workflow code with no Activities registered | Replay reuses recorded verdicts. TypeSafe is called 0 times |

## The live harness

```bash
npm run harness          # http://localhost:4848  (worker in-process; --no-worker to use external workers)
```

One page, no build step (`harness/index.html`), fed by `scripts/harness.ts` over Server-Sent Events:

- **Loaded**: judge (LIVE jev-1.13.0 / STUB / CLOSED), pin, endpoint, queue, workflows, activities, worker identity, tape path.
- **The loop**: the eight steps with a live count of how many times each was observed.
- **Items**: one row per command. Task gate and output gate light up as the Activities complete, with the judge's wall
  time in ms per POST and the source. AMBER rows grow compose / escalate / refuse buttons that send the `humanVerdict` Signal.
  Path-0 rows (illegal commands) are predicted with the same `localGate` code the workflow runs and show 0 POSTs.
- **Judge latency**: POST count, p50, p95, path-0 count, applied, residual.
- **Layers on the Items table**: chips (All, Needs me, RED, AMBER, GREEN, Running, Money, Work, Noise), group by
  lane / light / status / category / sender / date, sort by arrival / judge ms / severity / date / sender / category,
  and a free-text filter over text, subject, sender and category. Group headers carry counts and average ms per POST.
  The view is remembered per browser. "Needs me" = parked items plus judge-RED items (path-0 RED is code, not you).
  Changing layer, group or sort animates: rows keep their identity and slide to their new place, new rows fade in,
  group headers flash. Keys while presenting: 1–9 pick a layer, g cycles group, s cycles sort.
- **Step feed** and **Tape**, newest first, plus deep links into the Temporal UI per workflow.

Run the demo pack, type one Capture line, start a Waiting or Habit workflow.

**Your own pack.** Put a JSON array of commands at `.jev-tape/pack.json` (gitignored) or point `JEV_PACK` at one.
The harness loads it in place of the built-in pack; `npm run demo -- --pack FILE` does the same. Keep addresses,
phone numbers and codes out of the text: the payload is the state the judge sees. `npm run pack:scan -- FILE` checks
(`--fix` redacts in place).

**Big packs.** Two controls on the Run panel:
- *lane size* splits the pack into N worklists that run in parallel across every worker on the queue. A park only
  blocks its own lane. Each lane still ContinueAsNews every 8 items.
- *park timeout* auto-escalates an AMBER item after N seconds so a 500-item run never stalls on a human. Set 0 to make
  parks wait forever (the durable default). Everything the page shows comes from the
Activities' step observer and the workflow's `status` query; nothing is invented client-side.

## The questions (pack v2.0)

The packs are trees, not lists. `spec/QUESTIONS-TASK-v2.md` (24 questions) and `spec/QUESTIONS-OUTPUT-v2.md`
(4 questions) are the instruments; both pass the operadic-interview linter. `src/typesafe/pack.ts` encodes them;
`src/loop.ts` composes leaves → parents → light exactly as the spec states the rules.

Both gates are answered by one POST per item (`qualifyItem`): propose is pure, so the proposed event exists before the
task gate, and the 24 + 4 questions ride together. The gate decisions are still composed in order. `gates: "two"` on a
worklist input restores two POSTs. The collapsed root (`allow_now` / `allow_apply`) is asked in the same POST as its decomposition. `composeAnswers`
compares the light composed from the tree with the collapsed one: agreement is recorded; disagreement is an
**OC finding** on the verdict (never silent) with the kernel (the children that drove the composed light), and the
verdict takes the more conservative light. The harness marks such rows `oc!` and has an "OC findings" layer.

Judge-derived item kind (Q6: action / waiting / reference / someday / noise) rides on the verdict for the layers.

## Ingest from a connector (no model in the loop)

`SurfaceIngestWorkflow` pulls pages from an MCP server as an Activity (`pullSurface`), maps rows to Capture commands with a
code codec (`src/surfaces/codec.ts`, scrubbed by `src/surfaces/scrub.ts`), drops threads already on the tape
(`seenThreadIds`), and starts lanes as child workflows. Each page lands in Event History, so a crash resumes from the last
recorded page. ContinueAsNew every 8 pages.

```bash
# worker / harness needs a connector target:
export JEV_MCP_COMMAND="npx -y <your-gmail-mcp-server>"      # stdio
# or JEV_MCP_URL=http://localhost:3333/mcp  (JEV_MCP_BEARER for auth)
npm run ingest                                   # once, in:inbox newer_than:7d
npm run ingest -- --query "in:inbox is:unread" --max 200 --lane 25 --park 30
npm run ingest -- --every 15m                    # Temporal Schedule; --every off deletes it
```

No Gmail MCP server yet? `JEV_MCP_COMMAND="node --experimental-strip-types scripts/mcp-fake-gmail.ts"` serves your local
pack in the connector's shape over real MCP stdio. The harness has an "Ingest from connector" button when a target is set.
Performance notes and the adversarial evaluation of the two parallelisms: [`PARALLELISM.md`](PARALLELISM.md).

## Loop, as code

`src/item.ts` is the loop. Both the twin (`src/engine.ts`) and the workflow (`src/temporal/workflows.ts`) call `runItem`
with their own ports. The workflow's ports are Activities and a Signal wait. Same names, same branches.

```
assertLegalCommand → qualifyTask → gate → propose in memory → qualifyOutput → gate → [humanVerdict] → applyCommand
```

- `src/loop.ts` — question packs, `composeAnswers` (dual axes θ / top_prob_floor, mid-band demote, local RED wins, C10 floor), `propose`
- `src/judge.ts` — `live` (key) | `stub` (opt-in) | fail closed
- `src/temporal/activities.ts` — the only IO. Retry: 5xx/429/529. Non-retryable: 401/422/missing key/wrong pin.
- `src/temporal/workflows.ts` — no fetch, no env, no node: imports. `npm run check` enforces it.

## Latency

Every `qualifyTask` / `qualifyOutput` step carries `ms`, the wall time of the judge call, and the demo prints it per item.
With the live judge that column is the number to watch: one POST per gate, many questions per POST.

## Built to scale

- **Workers are stateless.** Run `npm run worker` on N machines; they share task queue `jev-tape`. `JEV_MAX_ACTIVITIES` / `JEV_MAX_WORKFLOWS` size each one.
- **History stays bounded.** ContinueAsNew every 8 items carries cursor, applied, residual, verdicts and outcomes.
- **Every write is idempotent.** Key = `workflowId:index`. The file tape is a stand-in for a table with a unique index on that key.
- **The judge is an Activity.** Retries, heartbeats and timeouts are Temporal's; the workflow never blocks on HTTP.
- **Cloud is configuration.** `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY` (or `TEMPORAL_TLS_CERT`/`_KEY`). Nothing else changes.

## Replay and the workflow id

Idempotency keys and C10 park keys derive from `workflowInfo().workflowId`. A replay must be given the real id
(`Worker.runReplayHistory(opts, history, workflowId)`); the SDK substitutes `"fake"` otherwise and the Signal keys
never match. `scripts/replay.ts` and the test both pass it.

## Deviations from spec/TEMPORAL.md, on purpose

- `npm run worker`, `demo`, `demo:crash`, `replay`, `harness` exist. The spec's "no `npm run worker`" predates a runnable server.
  `npm run live` is still the twin and never starts a worker.
- New files: `src/loop.ts`, `src/item.ts`, `src/judge.ts`, `src/temporal/connection.ts`. Added to the spec table.
- `JEV_JUDGE=stub` is an explicit opt-in. Default without a key is still fail closed.
