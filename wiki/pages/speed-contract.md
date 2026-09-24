---
id: speed-contract
title: Speed contract
---

# Speed contract for the execution engine

Skip the LLM when a typed question will do. Batch every question that shares a snapshot. Spend expensive compute only on a shortlist. Record the answer so a crash cannot pay for it again.

Ladder: code → one TypeSafe POST → LLM generate → Temporal park.
