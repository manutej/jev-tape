# Parallel spend: ten agents, 140 rows, recordings, Grok triage, Haiku ground truth, calibration

Status: designed and dry-runnable, not yet launched. Launch needs the operator's answers to
`JEV-works/handoffs/vibium/interview-use-cases.md` (they reorder the catalog) and a go.

## Shape

```
catalog-100.json (140 rows, 70 pages, 18 kinds)
   │ shard into 10 ranges of 14 rows
   ▼
10 × Sonnet agent  ──each──►  npm run corpus -- --rows a-b --workers 1 --record recordings/ --llm-fallback
   │                            per row: record start → go → snapshot → Jev verify (~250 ms)
   │                                     → escalate? → vibium check (grok-4.6, 15–150 s)
   │                                     → record stop → recordings/<id>.zip (actions + screenshots)
   │  returns {summary, rows[]} via schema
   ▼
10 × Haiku agent  ──each──►  ground truth from the recordings: open <id>.zip's last screenshot,
   │                          answer the row's claim yes/no from the image only (no page text, no Jev answer)
   ▼
code (no agent): merge → items with two label sources (catalog expectation, Haiku screenshot read)
                 → kit/run.ts (coverage, accuracy, McNemar vs majority)
                 → scripts/calibrate.ts (Brier and reliability bins per question, per kind)
```

Why the split is this way: Sonnet agents drive the browser and the loop (they read JSON, retry a
stalled host, name what failed); Haiku agents only look at pictures and answer one claim, which is
the cheapest independent judge available; Jev and Grok never label their own work.

## Cost, order of magnitude

| item | count | unit | total |
| --- | --- | --- | --- |
| Jev verify POSTs | ~130 (plus tape hits on reruns) | ~$0.00007 | ~$0.01 |
| Grok fallbacks (`vibium check`) | ~10–20 escalates × ~30 s | ~$0.02 | ~$0.40 |
| Sonnet driver agents | 10 × ~40–80k tokens | ~$0.15–0.30 | ~$2–3 |
| Haiku screenshot labellers | 140 × ~3k tokens (one image each) | ~$0.003 | ~$0.40 |
| Recordings on disk | 140 zips × 100–500 KB | | 15–70 MB |
| Wall time | shards run concurrently; Grok fallbacks dominate | | ~10–15 min |

## Calibration, per question and per task

The catalog expectation is the author's label. The Haiku read is a second, independent label
from the recording. Where the two agree, that row is ground truth; where they disagree, the row
is a finding to inspect, not a label. Against the agreed rows:

- **accuracy and coverage** per question (kit/run.ts, gates G1–G4);
- **Brier score** and **reliability bins** per question and per kind (`scripts/calibrate.ts`): does
  p = 0.9 mean right 90% of the time? A question that is confident and wrong on a kind (PDF, image)
  is the finding that changes the pack; the kit's G9 rule says a cost threshold is only trusted on
  probabilities an audited evaluator calls calibrated;
- **escape-option rate** per kind: how often `unsupported` / `none` fired, and whether the Haiku read
  agrees the page was undecidable.

The action rows (fill, click, press) are where "did it actually do that thing" matters most, and
the gate pack gets the same treatment once the catalog carries them: the recording's last frame is
the proof of the action, read by Haiku, never by the model that decided to act.

## Rails

Never a site that pays, sends, or holds someone's data. Read-only rows, one browser session per
worker, at most three workers on any one host (gnu.org rate-limited three). Keys from the
environment only. Recordings are actions and screenshots; the corpus states are page text; neither
leaves the machine except into the two repos.

## Launch

The workflow script is `scripts/workflow-parallel-corpus.js`. It takes `args`: `{catalog, rows, shards,
recordDir, resultsDir, stamp}`. A dry shard first:

```bash
cd jev-tape && npm run corpus -- --catalog fixtures/vibium/catalog-100.json --rows 0-13 --workers 1 \
  --record recordings/ --llm-fallback --session-prefix shard0 --out runs/shard0.json --items runs/shard0.items.json
```

Then the Workflow tool with the script and ten shards. Results land in `runs/`, items in JEV-works
`kit/modules/items/`, recordings in `recordings/` (gitignored; keep the zips for the Record Player).
