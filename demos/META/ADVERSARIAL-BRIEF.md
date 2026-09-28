# Adversarial cleanup brief — jev demos

You are an adversary with edit rights. Your job: find what is sloppy, wrong, or overclaimed in the
demos assigned to you, and FIX it in place. Read `META/BUILDER-BRIEF.md` first (rules, runtime, data).
Then this file. Do not edit `assets/*`, `data/*`, `record.mjs`, `index.html`, or demos not assigned to you.

## What changed since the demos were built (read carefully)

1. **Real judge answers now exist.** `data/recorded.js` holds answers recorded from a real
   `POST /v1/systemone` (model `jev-1.13.0`) for each page's default-state request(s). Every page loads it.
   `JEV.twin.systemOne` returns the recorded map when the request matches (same state + questions) and
   turns the top-bar pill green ("recorded TypeSafe answers · date"). Otherwise the twin answers.
   **Consequence: your page must handle real answer shapes.** Real Score answers carry fractional
   `score` values (e.g. 3.97) and a `confidence`; real Choice `probabilities` may omit keys; nouls are
   real floats. Demo 04 currently throws `Cannot read properties of undefined (reading 'toFixed')` when
   the recorded answers flow in. Any code that assumes the twin's exact shape is a defect. Copy must say
   "recorded judge answers" when the pill is green and "twin" otherwise; use
   `res.recorded === true` from the systemOne result to branch. When the real judge disagrees with what
   the page's twin would have said, the page shows the real answer and says so in the reasons list
   (e.g. demo 01: the real judge gave `reader_spec_equivalent` GREEN at only p=0.39, which compose
   turns into AMBER via the top_prob_floor: that is a finding, show it).
2. **Every demo now opens with a question.** Above the `h1`, replace the `.n` line ("demo NN of 10 ·
   name") with a `.q` line: the question this demo exists to answer, phrased so a reader sees why the
   investigation is worth their time. It is a question about how jev / jev-tape is useful in practice
   (when should a judge decide, when code, when a human; what does recording buy; what does one batched
   request cost vs many). Keep the demo number as a small prefix inside the same line. Examples of the
   register (write your own for your demos, one sentence, ends with a question mark):
   - 01 "If a pack is lossless for the builder, why did its reader fail at depth 7, and what check would have caught it before the model call?"
   - 04 "When 514 units follow one convention, why pay a reader for all of them instead of one judge call and a shortlist?"
   - 09 "If the worker dies between the screen and the write, how do we know the blocked line stays blocked?"
   Add the CSS for `.q` in your page-local `<style>`: `.hero .q{font-family:var(--display);font-style:italic;font-size:clamp(18px,2.2vw,24px);line-height:1.3;color:var(--amber);max-width:34ch;margin-bottom:14px}` and `.hero .q small{display:block;font-style:normal;font-family:var(--mono);font-size:12px;color:var(--dim);margin-bottom:6px}` — the small line holds "demo NN of 10".

## Adversarial checklist (score each, fix every failure)

- **Empty or wrong stage at rest.** Before Run, does the stage already show something true and legible
  (the state), not a blank box? After Run, is every label inside the drawing, non-overlapping, ≥10px?
  Check both desk and phone screenshots.
- **Copy overclaims.** Any sentence that says or implies a live judge call, a proof, "beats", repo-scale
  savings, or that the twin's number is a measurement. Any number in prose that is not in the provenance
  table. Any hype word. Any "WORD — fragment" label. Any ALL-CAPS label.
- **Dead or misleading controls.** Buttons that do nothing in some state; toggles whose effect is not
  visible; a Rewind that leaves stale stamps/lamps; Replay that changes the POST counter.
- **Tape honesty.** Path-0 checks must be `code` cells, judge calls `activity` with `post:true`, replays
  reuse. If the page records a POST for something that is not a judge call, fix it.
- **Real-answer robustness.** Run the page with recorded answers (they load by default) and with the
  twin (`window.JEV_DATA.recorded=null` before clicking) — both must work, no console errors, and the
  page must say which it used.
- **Reasons list.** Every verdict has reasons a reader can follow; no "every axis clear" when an axis was
  actually AMBER.
- **Counterpoint honesty.** The second counterpoint must now say: the judge answers shown are recorded
  from one real call on the default state when the pill is green, and computed by a twin otherwise; the
  page never calls the judge itself.
- **Phone.** No horizontal overflow; controls usable; SVG text legible or the stage offers a list fallback.

## Verification (mandatory before you report)

```
cd /home/user/jev-tape/demos
node shoot.mjs NN-name.html          # ok at desk + phone
node META/oc-check.mjs               # your pages pass 18/18
node -e "…JS parse gate from BUILDER-BRIEF…"
```
Also drive the page once with recorded answers and once with the twin (Playwright snippet: goto, click
`#run`, wait 3s, collect `pageerror`s) and look at the screenshots you take.

Report: per demo, the list of defects you found (one line each, "found → fixed" or "found → left, why"),
and the question you wrote. Nothing else.
