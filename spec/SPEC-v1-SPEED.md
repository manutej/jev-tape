# SPEC-v1-SPEED — useful, fast execution

Status: rehearsal. Does not replace SPEC-v1-TAPE.md. Adds skip rules and pack shape so classification is faster, not more durable-looking.

Pin: `jev-1.13.0`. Task queue: `jev-tape`. No new product name. No new seats.

## What "fast" means here

A harness turn that only needs a typed if should pay **one** TypeSafe POST (or zero). A business process that already decided should pay **zero** TypeSafe POSTs on replay. Speed of processing is skip + batch + record, not a bigger model.

## Four paths

| Path | When | TypeSafe | Temporal |
| --- | --- | --- | --- |
| 0 code | Deterministic. Missing field, illegal command | no | no |
| 1 batch judge | Bounded fork: which tool / may this send | one POST, many questions | only if a write follows |
| 2 rank then read | Many candidates, then an expensive LLM | shortlist POST recorded | record shortlist before LLM |
| 3 tape | Crash, wait, worklist, C10 | reuse recorded answers | Workflow + Signal + Continue-As-New |

Illegal: Temporal around path 0. Sequential TypeSafe. Re-POST on replay. `jev-latest` after thresholds exist.

## Ormus constructs — mapped, not flattened

| Construct | Engine mapping |
| --- | --- |
| Three lanes | gate = qualifyTask/Output; verify = claim pack; screen = untrusted-blob pack |
| Batch decisions | one POST per gate |
| Decision gate forks | Choice options in the pack |
| Confidence routing | composeAnswers dual-axis |
| Rank-wide-read-narrow | shortlist Activity then LLM Activity |
| SQAV | qualify → propose → qualify → apply |
| Anti-jobs | FIRE + apply last |

## Acceptance (speed)

- Path 0 items never appear in TypeSafe logs.
- A Capture that reaches apply made ≤ 2 TypeSafe POSTs (task + output).
- Replay of that Capture made 0 TypeSafe POSTs.
- A 13-question pack is one HTTP call, not 13.
- Harness read-only turns make 0 TypeSafe POSTs.
