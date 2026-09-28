# jev demos — the tape meets the wiring

Ten single-file interactive demos at the seam of two repos:

- **manutej/jev-tape** — the operad names typed questions, TypeSafe answers once per gate, code routes
  GREEN / AMBER / RED, Temporal records the answer across crash, wait, and replay.
- **manutej/wiring-and-the-whole** — a codebase is a module of systems; wiring is shipped to a model as a
  factored pack; four experiments (E1 witness, E2 tokens, E3 comprehension, E5 depth) say what may be claimed.

A pack shipped to a model is a write. So it gets a gate. Every demo puts one jev construct next to one
wiring construct and drives it with the experiments' own numbers.

Open `index.html`. Works from `file://`, from GitHub Pages, and as an artifact.

| # | file | the moment |
|---|---|---|
| 01 | `01-pack-gate.html` | two legend lines flip depth 7 from collapse to parity; one batched judge call |
| 02 | `02-apply-last-square.html` | the migration square as the apply-last loop; crash, replay, C10 |
| 03 | `03-kappa-path-zero.html` | a κ collision is code; the POST counter never leaves zero |
| 04 | `04-rank-wide-read-narrow.html` | thirty handlers scored in one request; four go to the reader |
| 05 | `05-theater-detector.html` | the composition witness rejects four trees before any model call |
| 06 | `06-depth-router.html` | ten depths routed through θ and the probability floor |
| 07 | `07-claim-verify-lane.html` | the claims ladder: verified, contradicted, unsupported |
| 08 | `08-tape-as-module.html` | jev-tape's own source as a wiring pack, glued, counted |
| 09 | `09-two-clocks.html` | screen on the seconds clock, gate on the hours clock, replay keeps the block |
| 10 | `10-witness-tape.html` | thirteen checks on the tape, one crash, a human at the last rung |

## The rules these pages keep

- **No TypeSafe call. No key.** The judge on every page is a deterministic twin (`assets/tape.js` →
  `JEV.twin`) with the same wire shape and contract checks as `src/typesafe/contract.ts`. The top-bar pill
  says so on every page. This is the same stance as `npm test`: twins, no key.
- **Every number traces to a file.** `build-data.mjs` reads the sibling checkout of
  `wiring-and-the-whole` and this repo's `src/`, hashes each source, and emits `data/*.js`. Each page ends
  with a "Where the numbers come from" table. Token counts are real `cl100k_base` counts when
  `experiments/node_modules/tiktoken` is present; otherwise the builder labels them as estimates.
- **The tape is shared.** `assets/tape.js` mounts the recorder at the bottom of every page: Activities,
  gates, signals, crashes, replays. Replay re-emits from history and never increments the POST counter.

## Rebuild and verify

```bash
# from the jev-tape root, with wiring-and-the-whole checked out beside it (or WIRING=/path)
node demos/build-data.mjs
cd demos && node shoot.mjs            # screenshots every page at desk + phone, reports console errors and overflow
node META/oc-check.mjs                 # the composition gate: each page must carry the parts the plan requires
```

The meta-suite documents that produced these pages are in `META/`.
