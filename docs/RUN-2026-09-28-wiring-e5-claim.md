# Run record — wiring claim gate, first dogfood (2026-09-28)

Fixture: `fixtures/wiring-e5-claim.json` (E5.1 of `manutej/wiring-and-the-whole`, commit `77a4d7d`, source files hashed in the fixture).
Recorded answer map: `fixtures/wiring-e5-claim.recorded.json`. Replay: `npm test` (no key, no POST).

## Sequence

1. `npm run smoke` → `models: ok`, `model=jev-1.13.0`.
2. `npm run qualify -- fixtures/wiring-e5-claim.json` → one POST. `usage in=1858 out=122`.

## Path 0 (code)

`B-A = -3.7 pts`, threshold `-5 pts` → rule passes. Not a local RED.

## Judge (`jev-1.13.0`)

| Question | Answer | Read |
| --- | --- | --- |
| `legend_readable` (noul) | 0.33 | low, below mid-band |
| `evidence_sufficiency` (choice) | `parity` 0.45 / `insufficient_n` 0.28 / `tax` 0.27, confidence 0.18 | near-flat |
| `promote_rung` (choice) | `RED` 0.56 / `AMBER` 0.36 / `GREEN` 0.08, confidence 0.35 | RED |
| `scope` (score) | 1.05 → level 1: implies something not measured, nothing on MAY-NOT | not a MAY-NOT breach |

## composeAnswers (code)

`verdict=RED`. Reason: `promote_rung=RED`. Apply parked (C10). Nothing written.

## What the run says, and what it does not

- The verdict is a judge output. It gates the write. It is not evidence about the wiring result and must not be cited on that repo's ladder.
- The rung under test is already in that repo's README MAY list. The gate did not exist when it was written. This run is a retroactive audit; whether the rung stays is a human call there.
- A path-0 lint run beside this gate found what the low `legend_readable` points at: pack B's body uses `anno`, `dep` and `edge` lines whose grammar the legend never defines, and the `*Repository*` glob gloss lives in the question text, not the legend. That is the same defect class E5's own panel found (undocumented `-` sentinel). It is code-checkable and belongs in that repo as a legend linter, not here.
- `evidence_sufficiency` at confidence 0.18 is close to flat across three options. One run, one fixture. Do not read a trend.

## Debt opened by this run

- Legend linter (path 0) in `manutej/wiring-and-the-whole`: every line-start keyword in a pack body must be defined in its legend.
- A second fixture from E3 (`experiments/e3-ablation/E3-GRADES.json`) so the surface has two recorded runs before anything else is built on it.
