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

Allowed: Gmail search, GitHub list/get/search, `npm test`, `npm run smoke`, `npm run qualify`.
Forbidden unless the user explicitly says push or send and C10 has a human verdict: send mail, push, merge.
