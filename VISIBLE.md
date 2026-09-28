# Visible occupancy — what a model should read

This repo is the source of record. Read **in this order**. Ignore `archive/`.

## 1. Picture (5 minutes)

1. `README.md` — where the key lives; what this is
2. `VISIBLE.md` — this file
3. `wiki/pages/home.md` — hubs
4. `wiki/pages/three-planes.md` — TypeSafe answers / code gates / Temporal records
5. `llms.txt` — machine index

## 2. Locked specs (do not reopen casually)

| File | Status |
| --- | --- |
| `spec/SPEC-v1-TAPE.md` | instance spec. Two gates. Apply last. Pin `jev-1.13.0`. |
| `spec/SPEC-v1-SPEED.md` | addendum. Paths 0–3. Does not replace v1. |
| `spec/TEMPORAL.md` | script contract. Task queue `jev-tape`. |
| `spec/KEY-SAFETY.md` | key never in chat / git / Vercel client |
| `spec/SURFACES-GMAIL-GITHUB.md` | Gmail + GitHub catalogs from historical traces |
| `spec/SETUP-TYPESAFE-KEY.md` | create key at console.typesafe.ai/keys |

## 3. Wiki hubs (doctrine, not a fifth product)

- `wiki/pages/home.md`
- `wiki/pages/three-planes.md`
- `wiki/pages/typesafe-activity.md`
- `wiki/pages/pin-jev-1-13-0.md`
- `wiki/pages/temporal-activity.md`
- `wiki/pages/temporal-replay.md`
- `wiki/pages/apply-last-loop.md`
- `wiki/pages/c10-human-gate.md`
- `wiki/pages/fire.md`
- `wiki/pages/first-ship.md`
- `wiki/pages/completed-spec.md`
- `wiki/pages/operad-questions.md`
- `wiki/pages/ormus-jev.md`
- `wiki/pages/three-lanes.md`
- `wiki/pages/decision-calibration.md`
- `wiki/pages/speed-path.md`
- `wiki/pages/harness-vs-process.md`
- `wiki/pages/surfaces-gmail-github.md`

Sibling wiki pages that repeat a hub live in `archive/wiki-duplicates/`.

## 4. Code the model can treat as the engine

- `src/typesafe/` — pin, compile, compose, client
- `src/engine.ts` — in-process unit, apply last
- `src/temporal/` — wrappers + activities
- `scripts/smoke-key.ts` / `live-run.ts` / `qualify-surface.ts`

## 5. Not visible (on purpose)

`archive/` — draft specs, overlapping speed writeups, HTML dumps, course stubs.
They are history. They are not occupancy.
