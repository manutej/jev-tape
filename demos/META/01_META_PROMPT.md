# 01 · META-PROMPT — "build a jev demo"

The category: *an interactive, single-file demonstration that carries one construct of a judged process
(typed questions → one answer map per gate → code routes → recorded tape) onto one construct of a sibling
corpus, driven by that corpus's measured numbers, with a deterministic twin in place of the judge.*
What varies per instance: the two constructs, the state, the questions, the path, the stage drawing.
What stays fixed: the skeleton, the invariants, the twin, the provenance obligation.

This is the reusable scaffold. It contains no solved instance. `META/BUILDER-BRIEF.md` is one
valuation of it (ten instances); the brief is the example, this is the type.

```xml
<system>
  <role>You build one jev demo: a single HTML file that shows a judged, recorded process applied to
  a corpus construct, using only measured numbers, with a deterministic twin as the judge.</role>

  <invariants>
    <i id="no-judge-call">The page never calls the judge service and never names a key. It states that its judge is a twin.</i>
    <i id="provenance">Every number shown appears in a provenance table naming the file it came from.</i>
    <i id="replay">Replay re-emits recorded results; the POST counter does not change on replay.</i>
    <i id="local-red">A code-level RED is never overridden by a judge answer.</i>
    <i id="skeleton">topbar → hero → instrument(controls, stage) → tape-shows + counterpoint → provenance → footer.</i>
    <i id="twin-counterpoint">The second counterpoint says the judge is a twin.</i>
  </invariants>

  <slots>
    <slot name="JevConstruct"   type="enum{decision-gate, apply-last-loop, path-0, path-1, path-2, tape, dual-axis, lane-2-claim, lane-3-screen, C10, event-history}"/>
    <slot name="CorpusConstruct" type="str"/>              <!-- what on the other side it is carried onto -->
    <slot name="State"          type="json"/>              <!-- the snapshot every question shares -->
    <slot name="Questions"      type="map[id → Question(noul|choice|score)]"/>  <!-- one request per gate -->
    <slot name="Resolvers"      type="map[id → (State) → Answer]"/>             <!-- deterministic twin logic -->
    <slot name="Policy"         type="{theta: float, floor: float, noulGate: list[id], localRed: list[str]}"/>
    <slot name="Paths"          type="list[0|1|2|3]"/>
    <slot name="Stage"          type="SVGSpec"/>           <!-- one memorable interactive moment -->
    <slot name="Measured"       type="list[{number, file, note}]"/>
    <slot name="Counterpoint"   type="list[str] (len ≥ 2)"/>
    <slot name="Title"          type="sentence"/>          <!-- one declarative sentence, no colon -->
  </slots>

  <procedure>
    1. Name JevConstruct and CorpusConstruct. If the pairing needs a sentence to justify, write it as the hero aside ("The intersection.").
    2. Fix State from the data files only. If a needed number is absent, it is a gate (⊘), not an estimate.
    3. Write Questions with their types. A closed option set → choice; a graded property → score with 2–10 levels; a yes-ish property → noul. An open option set is not a judge question; route it to the reader (LLM) or to code.
    4. Write Resolvers as pure functions of State. They reproduce recorded outcomes where outcomes exist.
    5. Decide Paths: deterministic checks are path 0 and are recorded as code cells, not activities; every judge question that shares State travels in ONE request (path 1); shortlist-then-read is path 2; crash/replay/park is path 3.
    6. Design Stage: one drawing that changes when the person acts; no ambient motion; readable at 390 px.
    7. Bind Policy and run compose; a local RED short-circuits before any judge question.
    8. Fill Measured from the files used; fill Counterpoint with where this instrument is the wrong tool and with the twin disclosure.
    9. Verify: page gate (no console errors, no overflow, primary button drives it), composition gate, eye gate on the screenshots.
  </procedure>

  <output_contract>
    A single .html file loading only shared assets and shared data files; primary button id="run"; a rewind action; a provenance table; the tape mounted; passes the verification commands; a three-line report (path, what the stage does, what could not be verified).
  </output_contract>
</system>
```

## Refinement history (the monad's log, three passes)

1. Draft → critique: the first draft allowed "estimate if a number is missing". Edit: replaced with the gate
   rule (⊘), because an estimated statistic in a demo about claims discipline is the one unforgivable defect.
2. Critique: `Questions` did not say when *not* to ask the judge. Edit: added the open-option-set rule
   (anti-jobs) to step 3 and the path-0 rule to step 5.
3. Critique: the stage slot was untyped ("make it nice"). Edit: `SVGSpec` with the two constraints that
   matter (changes on action, readable at phone width). Fixpoint reached: the third critique produced no
   new edit.
