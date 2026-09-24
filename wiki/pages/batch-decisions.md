---
id: batch-decisions
title: Batch decisions
---

# Batch decisions

Ask every typed question that shares a snapshot in one POST. Then act once. Sequential Q1→mutate→Q2 pays latency per question and drifts state.

On this tape task pack and output pack are already batches. Do not split primitive-picker / fail-closed-gate / judge into three Activities.
