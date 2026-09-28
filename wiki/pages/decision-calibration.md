---
id: decision-calibration
title: Decision calibration
type: Concept
---

# Decision calibration

The mid-band on this tape (`NOUL_MID_LOW 0.4`, `NOUL_MID_HIGH 0.6` in `src/typesafe/contract.ts`) is hand-set. It labels an answer as AMBER. It does not license a GREEN write.

A GREEN that lets code apply is a bounded error claim: a cut fitted on a fit split, held on holdout, within an error budget declared per effect class before any data. That method, and its code, live in JEV-works (`kit/threshold.ts`, `kit/gate/route.ts`, gates G8 and G9). The doctrine and the map of vocabularies live in jev-elder `fusion/DECISION-CALIBRATION.md`.

Ormus routes map onto this tape without renaming: auto = GREEN, review = AMBER, block = RED, escalate_human = C10 park. C10 stays a park whatever the number.

Related: [[c10-human-gate]] [[ormus-jev]] [[three-lanes]] [[fire]] [[typesafe-activity]]
