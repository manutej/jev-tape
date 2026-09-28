# Cross-check: Vibium + Jev against a computer-use style agent (2026-09-28)

Claude computer use itself was **not available** in the session that ran this (no computer-use tools were
present, and no device was linked). What ran instead is the closest proxy that uses the same information:
a Sonnet agent that sees the page only as a screenshot and acts only by pixel clicks and key presses.
The numbers below are for that proxy, and they are labelled as such wherever they appear.

## Experiment 1: same claim, same page, three judges

Eight real pages, one claim each (six true, two false), the same set as spec §8b. Jev and `vibium check`
numbers are from that bench. The Sonnet judge read one screenshot per page (780×493 headless viewport,
captured by Vibium) and answered the claim from the image alone.

| page | claim true? | Jev (`jev-1.13.0`) | `vibium check` (grok-4.6) | Sonnet screenshot judge, **blind** |
| --- | --- | --- | --- | --- |
| npmjs.com/package/react | yes (label) | escalate · 309 ms | failed · 141.7 s | failed · 2.5 s |
| rfc-editor.org rfc2324 | yes | passed · 248 ms | passed · 25.2 s | passed · 2.1 s |
| wikipedia Common Lisp | yes | passed · 250 ms | passed · 41.0 s | passed · 2.8 s |
| MDN flexbox guide | yes | passed · 277 ms | passed · 17.4 s | passed · 2.7 s |
| wikipedia Ada Lovelace, "invented JavaScript" | no | escalate · 241 ms | failed · 53.3 s | failed · 3.1 s |
| github torvalds/linux | yes | passed · 219 ms | passed · 15.8 s | passed · 2.8 s |
| wikipedia Python, "created by Linus Torvalds" | no | failed · 246 ms | failed · 45.8 s | failed · 2.9 s |
| news.ycombinator.com | yes | passed · 236 ms | passed · 18.2 s | passed · 4.1 s |
| **median** | | **248 ms** | **41.0 s** | **2.8 s** read-and-decide · **9.2 s** per agent wall |
| **right** | | 6/6 decided, 2 escalates, 0 wrong | 7/8 | 7/8 vs label |

Per decision, Jev is about **11×** faster than the Sonnet judge's own read-and-decide time and about
**37×** faster than the judge's wall time as an agent (spawn, screenshot read, answer). `check` is 164×
slower than Jev because it drives a tool loop instead of reading one frame.

The npm row is the interesting disagreement. Cloudflare served a "performing security verification"
interstitial. Jev's `blocked` question caught it and escalated; the blind Sonnet judge said the claim is
false of the screenshot, which is right about the image and wrong about the catalog label, which assumed
the page loaded. `check` spent 142 s and also said failed. Nobody was fooled; only the label was.

## Experiment 2: the same login, pixel-driven

The local fixture site (`scripts/fixture-site.mjs`, `tomsmith` / `SuperSecretPassword!`). The Sonnet
operator was allowed `screenshot`, `mouse click X Y`, and `keys <one key>` only: no `map`, `find`, `eval`,
`fill`, `type`, or selectors, which is the computer-use shape. Vibium's `keys` takes one key per call, so
the operator typed 30 single keys (about 13 ms each, 0.4 s in all); the time is model turns, not typing.

| variant | what decides | wall time | steps | outcome |
| --- | --- | --- | --- | --- |
| A. model only (`vibium run` + `check`, grok-4.6), spec §8c | model plans, acts, verifies | 32.8 s | run 14.8 s, check 17.3 s | passed |
| B. Jev + operator policy, spec §8c | scripted verbs, Jev gate + Jev verify | **5.0 s** | gate 0.33 s, verify 0.50 s | verified true |
| D. Sonnet pixel operator (computer-use proxy) | model sees screenshots, clicks pixels, presses keys, judges the last frame | **14.2 s** self-timed · 23.1 s agent wall | 3 screenshots, 1 click, 30 keys | passed (final frame checked by hand: "You logged into a secure area!") |

B over D: about **3×** on self-timed, **4.6×** on wall. B over A: 6×. The pixel operator is faster than
`run` because it takes three frames and no tool loop; it is slower than Jev because every frame is a
vision turn. B does not plan; D and A do. That is the same trade as in §8c: Jev is the shape for a known
flow, the model for an unknown page.

## Blinding

The first launch of experiment 1 was **not blind** and is not the reported result. Two leaks: the
screenshot files were named after the rows, and two names carried `-false`; the rows file with the
expected verdicts sat in the same directory. It was re-run with the images copied under a deterministic
shuffle to `p1.png`..`p8.png` in a directory holding only images, with the key kept elsewhere, and a prompt
that carried the image path and the claim only (no listing, no other file, no browsing). Verdicts were the
same on seven rows; on the npm row the non-blind judge said inconclusive and the blind judge said failed.
Both runs are in JEV-works `kit/results/browser-crosscheck-computer-use-proxy-2026-09-28.json`.

The same leak existed in `scripts/workflow-parallel-corpus.js`: the Haiku labellers were told to read the
driver's results file, which carries `expect`, `verdict`, and `answers`. The driver now writes a manifest
per shard with `id`, `claim`, and the recording path only, and the labellers read that file and nothing
else. `scripts/calibrate.ts` is unchanged: it is where the two label sources are compared, after both exist.

## What this does and does not show

Shown: on literal claims about a page that has settled, a typed judge over text is one to two orders of
magnitude faster than a vision judge over the same page, and at least as accurate on this sample (n = 8,
in-sample claims, hand-set thresholds). On a known flow, Jev's gate and verify are 3× to 6× faster than
any model in the loop, with the page load as the floor.

Not shown: anything about Claude computer use as a product (desktop control, its own screenshot cadence,
its planner). The proxy has no desktop and gets one frame at a time from Vibium. A real run needs a
linked computer or the desktop app; `docs/LOCAL-DEMO.md` is the Mac setup, and the same eight pages and
the fixture login are the experiment to repeat there.
