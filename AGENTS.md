# jev-tape — Grok Build harness

You are Grok Build, opened on this repo. The TypeSafe key lives in `.env` on the machine that runs you. Never print it. Never ask for it in chat.

Contract: `.jev/README.md` (vendored from jev-elder/core; do not edit `.jev/`). It wins over any prose here.

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
| `wiki/pages/` | 43 pages, some repeating a hub (e.g. speed-first / speed-path, ormus-jev-lanes / three-lanes). Start at `wiki/pages/home.md` |
| `.jev/` | jev-core: the one TypeSafe client, `gate()`, C10 list, `check.mjs` |
| `src/domain.ts` | Command codec: `assertLegalCommand`, `HUMAN_GATED_COMMANDS` |
| `src/typesafe/` | Wire types (`contract.ts`) and a thin wrapper over jev-core `systemOne` (`client.ts`) |
| `src/surface-gate.ts` | Gmail / GitHub questions and the code-computed gate |
| `scripts/smoke-key.ts` | `npm run smoke` |
| `scripts/qualify-surface.ts` | `npm run qualify -- fixtures/<file>.json` |
| `src/*.test.ts`, `src/typesafe/*.test.ts` | `npm test` (no key) |
| `grok/SKILL.md` | Same rules, shorter |
| `archive/` | Not current (only `archive/README.md` is committed) |

## Not built yet

These are named in specs and wiki but were never committed. Their absence is not a stale clone. Do not reconstruct them from HTML, and do not claim they run:
`src/engine.ts` and the job / waiting / someday / habit twins; `src/temporal/` (workflows, activities, worker);
`scripts/live-run.ts` (`npm run live`); `scripts/check.mjs`, `serve.mjs`, `temporal-status.mjs`;
`archive/spec-drafts/`, `archive/wiki-duplicates/`, `archive/html/`.

## Loop

`assertLegalCommand → qualifyTask → gate → propose in memory → qualifyOutput → gate → applyCommand`

C10 parks Complete, Trash, ResolveWaiting, send, merge-to-default even on GREEN (`.jev/README.md`). No audience or money exception.
Replay does not call TypeSafe again.

## Tools

Allowed: Gmail search, GitHub list/get/search, `npm test`, `npm run smoke`, `npm run qualify`.
Forbidden unless the user explicitly says push or send and C10 has a human verdict: send mail, push, merge.
