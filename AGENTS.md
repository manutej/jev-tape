# jev-tape — Grok Build harness

You are Grok Build, opened on this repo. The TypeSafe key lives in `.env` on the machine that runs you. Never print it. Never ask for it in chat.

Pin: `jev-1.13.0`. Endpoint: `POST https://api.typesafe.ai/v1/systemone`.
Queue name, when Temporal is on: `jev-tape`.
Missing key = fail closed. Do not invent a GREEN.

## What is true in this tree

| Path | Role |
| --- | --- |
| `spec/SPEC-v1-TAPE.md` | Locked instance spec |
| `spec/SPEC-v1-SPEED.md` | FAST vs TAPE |
| `spec/TEMPORAL.md` | Scripts must match this file |
| `spec/SURFACES-GMAIL-GITHUB.md` | Gmail / GitHub cut |
| `spec/SURFACES-VIBIUM.md` | Browser cut: Vibium verbs → paths, two packs, ≤ 2 POSTs per step |
| `packs/` | Question packs in JEV-works Context format. Canonical copies + lint live in JEV-works |
| `src/vibium/` | Browser twin: cli shim, decide, pack, tape, step |
| `wiki/pages/` | 43 pages. Start at `wiki/pages/home.md` |
| `src/` | In-process twins. Apply last |
| `scripts/` | npm test, smoke, live, qualify |
| `grok/SKILL.md` | Same rules, shorter |
| `archive/` | Not current |

If a file named above is missing from a clone, the clone is behind. Do not reconstruct v1 from HTML.

## Loop

`assertLegalCommand → qualifyTask → gate → propose in memory → qualifyOutput → gate → applyCommand`

C10 parks Complete, Trash, ResolveWaiting, send, and merge-to-default even on GREEN.
Replay does not call TypeSafe again.

## Tools

Allowed: Gmail search, GitHub list/get/search, `npm test`, `npm run smoke`, `npm run qualify`, `npm run vibium` on an allowlisted host (commit verbs are gated; C10 targets park).
Forbidden unless the user explicitly says push or send and C10 has a human verdict: send mail, push, merge.

## Presenting HTML

Pages under `docs/` may be plain, or wear the Ormus design chrome via the repo skill `.claude/skills/ormus-chrome/` (tokens, component layer, brand rules, page template, chart rules). It is one option, chosen when a page is for the firm, leadership, a client or a partner team; `docs/vibium-team-brief.html` is the worked example. To use it from any project, copy the skill folder to `~/.claude/skills/ormus-chrome/`.
