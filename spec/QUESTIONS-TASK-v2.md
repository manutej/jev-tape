# Task gate instrument — v2 (operadic)

Respondent: `jev-1.13.0`, judging one command and its payload (for a Capture, one mail item: text, subject, sender name, date, category).
Root (collapsed, asked in the same POST as the tree): **May a harness apply this command now without a person looking at it?** `Command → Light{GREEN, AMBER, RED}` ▷ `allow_now`
Meaning of the light for Capture: GREEN = file it, no one needs to see it. AMBER = a person must see it (C10 park). RED = refuse to file.
Legality is decided in code before any question is asked (`assertLegalCommand`); an illegal command is RED with 0 POSTs.

Root compose (filter-chain, fail-closed):
RED if Q5 composes RED, or the collapsed `allow_now` says RED.
AMBER if any of: Q1 < 0.5, Q2 in the mid-band or < 0.5, Q3 composes `irreversible`, Q4 ≥ 0.6, Q5 composes AMBER, or the collapsed `allow_now` is GREEN below θ / top_prob_floor.
GREEN otherwise. A local C10 AMBER is a floor the judge cannot raise.
OC check: the composed light is compared with the collapsed `allow_now`. Agreement is recorded. Disagreement is a FINDING recorded on the verdict with the kernel (the children that drove the composed light); the verdict takes the more conservative light. Never silent.

Stars: leaves without children (Q6; Q7–Q9) carry no ★ of their own since a star there would buy a redundant collapsed call, not new evidence; stars are delegated to the per-factor subtrees.
Answering economics for the judge: every node is answered in one POST; the compose rules below turn leaves into parents in code. ★ marks the node that carries the most information about its parent.

**Q1 — Is this exactly one intent about exactly one item?** `→ Prob` ★
▷ `Q1`
  **Q1.1 — Does the text ask for more than one distinct thing to be done?** `→ Prob`
  ▷ `Q1_1`
  **Q1.2 — Does the text describe a project of several steps over time rather than a single next action?** `→ Prob`
  ▷ `Q1_2`
  **Q1.3 — Is the text purely informational, asking the recipient for nothing at all?** `→ Prob`
  ▷ `Q1_3`
  Compose Q1: single = (1 − Q1.1) ∧ (1 − Q1.2), as min; Q1.3 does not lower it (an informational item is still one Reference item). Compared with the collapsed Q1.

**Q2 — Can a harness decide what to do with this from the payload alone?** `→ Prob` ★
▷ `Q2`
  **Q2.1 — Does deciding require knowing a specific person's preference or relationship to the recipient?** `→ Prob`
  ▷ `Q2_1`
  **Q2.2 — Does deciding require a fact that is not in the text, such as a date, a price, or a prior agreement?** `→ Prob`
  ▷ `Q2_2`
  **Q2.3 — Is the sender asking the recipient to make a judgment call or choose between options?** `→ Prob` ★
  ▷ `Q2_3`
  Compose Q2: can_branch = 1 − max(Q2.1, Q2.2, Q2.3). A mid-band result (0.4–0.6) demotes the root to AMBER. Compared with the collapsed Q2.

**Q3 — If this is applied and turns out to be wrong, what does undoing it cost?** `→ Key{free, cheap, irreversible}` ★
▷ `Q3`
  **Q3.1 — Would applying this cause a message to be sent to another person?** `→ Prob`
  ▷ `Q3_1`
  **Q3.2 — Would applying this move money or change a payment, account, or credential?** `→ Prob`
  ▷ `Q3_2`
  **Q3.3 — Would applying this delete, close, or complete something another person relies on?** `→ Prob`
  ▷ `Q3_3`
  Compose Q3: irreversible if max(Q3.1, Q3.2, Q3.3) ≥ 0.5, else free. Compared with the collapsed Q3 (a Key vs a Key).

**Q4 — Does the item ask the recipient to act outside the JEV domain?** `→ Prob` ★
▷ `Q4`
  **Q4.1 — Does the text request a reply, confirmation, or acknowledgement?** `→ Prob`
  ▷ `Q4_1`
  **Q4.2 — Does the text request a payment, bank details, or a signature?** `→ Prob` ★
  ▷ `Q4_2`
  **Q4.3 — Does the text request a login, a password reset, a code entry, or another account action?** `→ Prob`
  ▷ `Q4_3`
  **Q4.4 — Does the text request that a file, document, or deliverable be produced or sent?** `→ Prob`
  ▷ `Q4_4`
  Compose Q4: outside = max(Q4.1, Q4.2, Q4.3, Q4.4). ≥ 0.6 means a person must see it (AMBER). Compared with the collapsed Q4.

**Q5 — Is it risky to file this without a person seeing it?** `→ Light{GREEN, AMBER, RED}` ★
▷ `Q5`
  **Q5.1 — Does the text press for action within hours?** `→ Prob`
  ▷ `Q5_1`
  **Q5.2 — Does the text look like phishing, a scam, or an impersonation of a known sender or service?** `→ Prob` ★
  ▷ `Q5_2`
  **Q5.3 — Does the text concern the recipient's money, legal standing, employment, or health?** `→ Prob`
  ▷ `Q5_3`
  **Q5.4 — Is the sender a real person known to the recipient rather than an automated system?** `→ Prob`
  ▷ `Q5_4`
  Compose Q5: RED if Q5.2 ≥ 0.6; AMBER if Q5.1 ≥ 0.6 or Q5.3 ≥ 0.6; GREEN otherwise. Q5.4 is a weight: a known person doubles the AMBER pull of Q5.1. Compared with the collapsed Q5.

**Q6 — Which kind of JEV item is this?** `→ Key{action, waiting, reference, someday, noise}`
▷ `Q6`
  Compose: leaf; feeds the projection and the harness layers, not the light. No children: a deeper level could not change the answer.

Count: 6 top-level + 17 leaves + 1 collapsed root = 24 questions, one POST.
