# HANDOFF — jev demos (written for a cold session)

Branch: `claude/blissful-ride-baii3b` in both `manutej/jev-tape` and `manutej/wiring-and-the-whole`.
Gallery artifact (private): https://claude.ai/artifact/BghiRD4cLhXuk1evW1yt3q

## What exists
- `jev-tape/demos/` — ten single-file interactive demos + `index.html`, sharing `assets/tape.css`
  (design system) and `assets/tape.js` (Tape recorder, twin judge, composeAnswers, helpers).
- `demos/build-data.mjs` → `data/*.js`: every number read from repo files (53 sources hashed). Real
  cl100k token counts (tiktoken installed under `wiring-and-the-whole/experiments/node_modules`).
- `demos/record.mjs` → `data/recorded.js`: REAL TypeSafe answers, recorded once (9 POSTs on 2026-09-28,
  model `jev-1.13.0`) for each page's default-state request. Pages replay them (green pill) and fall
  back to the twin for any other state. Re-run with a key in the environment to refresh; it never
  re-POSTs a request already on disk (tape rule).
- `demos/shoot.mjs` (Playwright screenshots + console/overflow gate), `demos/META/oc-check.mjs`
  (composition gate, 18 checks/page), `META/` docs: meta-plan, meta-prompt, OC gate, provenance,
  ledger, builder brief, adversarial brief.
- `wiring-and-the-whole/demos/README.md` + README bullet + dashboard nav link back to the demos.

## What is real vs simulated
- Real: all experiment numbers, handler graphs, packs, token counts, witness booleans; the recorded
  judge answers in `data/recorded.js`.
- Simulated: the twin's answers for any page state that was not recorded (e.g. toggles moved). The
  pill says which is in use. No page calls the network.

## State at handoff
- Adversarial cleanup pass in progress by two agents (demos 01–05, 06–10): real-answer robustness
  (demo 04 threw on fractional scores), sloppy visuals, overclaiming copy, and an opening question
  line (`.q`) per demo so each page starts with why it matters. `index.html` already carries the
  meta question.
- After their reports: run `node shoot.mjs`, `node META/oc-check.mjs`, commit, push, republish the
  artifact (same file path as before, from the scratchpad copy of index.html with the doctype
  stripped; supporting files via `files`).

## Known limits
- Screenshots in the sandbox use fallback fonts (Google Fonts blocked); live pages use Fraunces / IBM Plex.
- Recorded answers cover default state only; a state change routes to the twin and the pill flips back.
- Demos 03, 08, 10 make no judge request by design (path 0 / witness).

## Commands
```
node demos/build-data.mjs            # rebuild data from both repos
set -a && source .env && set +a && node demos/record.mjs   # record real answers (key stays local)
cd demos && node shoot.mjs && node META/oc-check.mjs
```
