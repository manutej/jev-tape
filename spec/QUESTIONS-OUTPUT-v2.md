# Output gate instrument — v2 (operadic)

Respondent: `jev-1.13.0`, judging the command and the event proposed in memory for it. Nothing has been written.
Root (collapsed, same POST): **May the harness apply this proposed event now?** `(Command, Event) → Light{GREEN, AMBER, RED}` ▷ `allow_apply`

Root compose (filter-chain, fail-closed): RED if Q7 < 0.5 (the event does not do what was asked); AMBER if Q8 ≥ 0.5 (a field was invented) or Q9 < 0.5 (touches something outside JEV); GREEN otherwise, subject to the collapsed `allow_apply` under θ / top_prob_floor, and the local C10 floor.
Stars: leaves without children (Q6; Q7–Q9) carry no ★ of their own since a star there would buy a redundant collapsed call, not new evidence; stars are delegated to the per-factor subtrees.
OC check: composed light vs collapsed `allow_apply`, as on the task gate; disagreement is a recorded FINDING and the verdict takes the more conservative light.

**Q7 — Does the proposed event do what the command asked, and nothing more?** `→ Prob` ★
▷ `Q7`
  Compose: leaf. Below this is the field-by-field diff, which is code, not a question.

**Q8 — Does the event carry any field that was invented rather than carried from the command?** `→ Prob`
▷ `Q8`
  Compose: leaf.

**Q9 — Does the event change JEV state only, with no message, payment, push, or notification outside it?** `→ Prob` ★
▷ `Q9`
  Compose: leaf.

Count: 3 top-level + 1 collapsed root = 4 questions, one POST. Pack total across both gates: 28.
