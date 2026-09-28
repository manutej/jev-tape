# jev × Temporal: two parallelisms, one tape — adversarial evaluation (2026-09-28)

**Question.** jev is parallel one way (many questions per POST, about one state). Temporal is parallel another way
(workflows × activity slots × workers on a task queue). Are they integrated cleanly, and is the integration using both?

**Short answer.** They are orthogonal and compose without conflict: jev's axis is *questions within one item*, Temporal's
axis is *items across lanes and workers*. TypeSafe accepts one state per request, so items cannot be batched into one POST;
lanes are the right axis for items. But the first cut left one Temporal axis unused: inside a lane, items ran one at a time,
so a single AMBER park stalled every item behind it and only one gate POST per lane was ever in flight. Fixed below.

## Method

Adversarial: assume each layer is the bottleneck, measure, fix what measures. Bench: `.jev-tape/bench-run.mjs` drives the
harness with N real pack items, lanes of 50, park timeout 300 ms, stub judge (0 ms) so what remains is orchestration cost.
Baseline numbers come from the code as of commit 6203c4b.

## Findings

| # | Finding | Evidence | Fix | After |
|---|---|---|---|---|
| F1 | `fileTape.append` re-read the whole tape per apply: O(n) per apply, O(n²) per run | 1,500 appends: 2.9 s, 0.8 → 2.9 ms per append as the file grew | Key index + incremental tail scan by byte offset (a retry landing on another worker still sees other processes' writes) | 0.5 s, flat 0.3 ms per append |
| F2 | Harness polled a `status` query per lane every 500 ms: N lanes × 2 workflow tasks/s competing with real work | 400 items, dashboard open vs closed: 17.7 s vs 12.0 s after other fixes | Poll every 2 s, only while a browser is connected; lanes that finished stop polling | Dashboard costs ~30%, down from a suspected 3x on the 1,044 run |
| F3 | Two sequential POSTs per item although `propose` is pure | 2 × judge round trip per item on the critical path | **Not applied: spec decision.** Options: one POST for both trees; two parallel activities; keep sequential | pending |
| F4 | 20 activity slots per worker capped concurrent POSTs at 20 | with 8 lanes × 8 concurrent items = 64 in flight, slots were the ceiling | Default 50 (`JEV_MAX_ACTIVITIES`); scale further by adding workers | — |
| F5 | `seenThreadIds` re-read the tape per ingested page | O(n) per page | Same index as F1 serves it | O(ids) |
| **F6** | **Sequential fold inside a lane: a park blocked its neighbours; one POST in flight per lane** | 400 items / 8 lanes: 634 ms per item per lane; with 5 s parks, 2,400 ms | **Batch of 8 runs concurrently inside the workflow (`Promise.all`). Items are disjoint, so parallel composition is legal; outcomes fold back in index order** | **240 ms per item per lane; 31.7 s → 12.0 s (2.6x)** |

Single lane of 400 items after F6: 60 s, 150 ms per item, i.e. within-lane concurrency alone gives 8 in flight; lanes multiply it.

## What did NOT show up

- The dashboard was suspected of a 3x slowdown on the 1,044 run (78 s). Measured with page open vs closed on identical
  code: no difference. The 78 s was the 5 s park timeout on items the v2 stub parks, serialized inside lanes (F6).
- Webpack bundling, ContinueAsNew every 8, heartbeats: none measurable at this scale.

## How the two parallelisms now compose

```
item      = one state, one POST per gate, 24 + 4 questions      ← jev's parallelism (questions)
lane      = 8 items in flight inside one workflow run             ← Temporal, in-workflow concurrency
worklist  = lanes × 8, each lane ContinueAsNew every batch        ← Temporal, workflows
queue     = every worker polls jev-tape; slots = JEV_MAX_ACTIVITIES ← Temporal, workers
```

Concurrent POSTs in flight = lanes × 8, capped by slots × workers, backed off by TypeSafe 429/529 retry policy.
A park holds one slot's worth of nothing: a waiting condition, no activity.

## Replay note

F6 changes the command sequence of `JevCorrectnessWorkflow`. Histories recorded before it will not replay on the new code
(nondeterminism at the first batch). New runs replay fine. If old histories must stay replayable, gate the change with
`patched("batch-v2")`; for this MVP the tape is the record and old runs were re-run.
