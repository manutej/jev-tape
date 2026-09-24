# SPEC-v1-TAPE — JEV durable judged process

Status: **candidate-final**. Pin: `jev-1.13.0`. Queue: `jev-tape`.
The operad names questions. TypeSafe answers them once per gate. Code gates. Temporal records the answer across crash, wait, and replay.

## 1. Identity

| Slot | Value |
| --- | --- |
| Name | jev-tape |
| Judge | `POST https://api.typesafe.ai/v1/systemone` |
| Pin | `jev-1.13.0` (never `jev-latest` in production) |
| Auth | `TYPESAFE_API_KEY` on the worker. Missing key = fail closed |
| Runtime | In-process twin now. Temporal Cloud when `TEMPORAL_ADDRESS` is set |

Three planes: Operad owns questions. TypeSafe owns one answer map per gate. Temporal owns Event History.

## 2–7. Loop

`assertLegalCommand → qualifyTask → gate → propose in memory → qualifyOutput → gate → applyCommand`.

composeAnswers is code. Dual axes. Judge Choice cannot override a local RED. Worklist: RED → residual. Continue-As-New every 8.

## 8. Temporal

TypeSafe is an Activity. Replay does not call TypeSafe again. See `spec/TEMPORAL.md`.

## 9. Workflows

JevCorrectnessWorkflow, WaitingWorkflow, HabitWorkflow, SomedayReviewWorkflow. TASK_QUEUE `jev-tape`.

## 10. FIRE

No TypeSafe in the Workflow isolate. No apply-then-qualify. No `jev-latest` after thresholds. No key in git, chat, or Vercel client.

## 11–15

First ship: Capture + Waiting twins. Still open: one live TypeSafe Capture before calling v1 final.
Speed addendum: `spec/SPEC-v1-SPEED.md`. Surfaces: `spec/SURFACES-GMAIL-GITHUB.md`.
