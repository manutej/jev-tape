---
id: typesafe-activity
title: TypeSafe is an Activity
---

# TypeSafe is an Activity

`POST /v1/systemone` is a non-deterministic effect. It lives in an Activity so the result is written once to Event History.

qualifyTask / qualifyOutput call TypeSafe. Workflow isolate must not fetch. Replay does not POST again.
