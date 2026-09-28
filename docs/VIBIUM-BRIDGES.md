# Integration bridges between Jev and Vibium

Seven ways Jev can sit inside Vibium work, ordered from what exists today to what needs Go changes
upstream. Each names what it costs, what it buys, and where the code goes. Only the first two exist.

| # | Bridge | Where | Vibium changes | Status |
| --- | --- | --- | --- | --- |
| 1 | **CLI wrapper** | jev-tape `src/vibium/` | none | shipped, measured |
| 2 | **Skill** | fork branch `feat/jev-typed-gate`: `skills/jev/SKILL.md` | docs only | written, local, not pushed |
| 3 | **Recording reader** | jev-tape, reads `record stop` zips | none | designed (calibration) |
| 4 | **MCP tools** | jev-tape exposes `jev_gate`, `jev_verify`, `jev_pick` over stdio | none | proposed |
| 5 | **Playbook gate** | Hermetic's `run inspect|walk` packs → Jev → `report linear` | none (reads pack dirs) | proposed |
| 6 | **Loop hooks** | `clicker/internal/verifier/loop.go`: `--gate CMD`, `--verify CMD` | Go, PR-sized | proposed |
| 7 | **Native provider** | `clicker/internal/verifier/providers.go`: `typesafe` as a verifier provider for literal claims | Go, larger | later |

## 1. CLI wrapper (today)

jev-tape shells out to `vibium --json` for every read and verb. Code classifies verbs, gates commits
with one Jev call, verifies with one Jev call, records answers on a tape, parks C10 targets. Nothing
inside Vibium knows Jev exists. Cost: a Node process beside the binary. Buys: everything measured in
`spec/SURFACES-VIBIUM.md` §8. Limit: refs must be known ahead (from `map`), and the planner is still
whoever writes the step list.

## 2. Skill (written)

`skills/jev/SKILL.md` teaches an agent that already uses Vibium's `browser` and `check` skills when to
call the jev-tape loop instead of spending a model turn. Docs only; the PR to HermeticOrmus after the
loop is tested from the operator's machine. Cost: nothing at run time. Buys: adoption by any agent
that reads skills.

## 3. Recording reader (designed, `docs/PARALLEL-SPEND.md`)

`vibium record start --screenshots` … `record stop -o <id>.zip` per row. The zip is the proof of the
action: actions plus screenshots. Jev never reads images; a Haiku labeller does, answering the row's
claim from the last frame alone. Those labels calibrate Jev's probabilities per question and per
kind (`scripts/calibrate.ts`). Later: Jev over the recording's trace text (`check -i zip` already
exists for the model; the same input for a typed judge is a small extension of the corpus runner).

## 4. MCP tools (proposed)

Vibium ships `vibium mcp` (stdio). jev-tape can ship a sibling MCP server with three tools:
`jev_gate({url,title,action,target,textExcerpt})`, `jev_verify({claim, before, after, diff})`,
`jev_pick({goal, map})`. Any agent that already has Vibium's MCP tools gets Jev beside them with no
CLI wrapper. Cost: ~200 lines in jev-tape, no Vibium change. Buys: Claude Code, Gemini CLI, and
Cursor users get the typed gate as a tool. Risk: the agent, not code, then decides when to call it;
the rails (C10 park, refuse is final) must live inside the tool, not in the prompt.

## 5. Playbook gate (proposed, fits Hermetic's unmerged branches)

`vibium run inspect|walk` writes a pack directory (`run.json`, screenshots, zip) and `report linear`
files it as a signed issue. A Jev pack over `run.json` decides in ~250 ms whether the pack is worth
filing: `hasBrokenLine`, `brokenIsReal`, `duplicateOfPrior` (code), `worthAnIssue`. Cost: one pack in
JEV-works, one script. Buys: no junk tickets, and the first Jev use the upstream author would see in
his own feature. Needs `feat/run-playbooks` and `feat/linear-tasks` to land upstream first.

## 6. Loop hooks (proposed, Go)

Inside `run` and `check`, the verifier loop calls browser tools one at a time. Two optional hooks:
`--gate CMD` runs before every mutating tool call with the pending call and a snapshot on stdin,
expecting `auto | park | refuse`; `--verify CMD` runs after each step with the claim and the snapshot,
expecting `true | false | escalate`. jev-tape provides both commands. Cost: a Go change in
`clicker/internal/verifier/loop.go` plus flags on `run`/`check`, PR-sized. Buys: the model plans,
Jev gates every action the model takes, and the loop's own budget (24 actions, 3 minutes) stops
burning on forks a typed judge settles. This is the bridge that changes `run`'s cost.

## 7. Native provider (later)

`VIBIUM_AI_PROVIDER=typesafe` for `check` on literal claims: the verifier asks Jev the step-verify
pack instead of running a tool loop, and falls back to the configured model when Jev escalates.
Cost: a provider adapter in Go, plus a policy for which claims are literal. Buys: `vibium check`
itself becomes sub-second on most claims with no change for the user. Only after 3 and 6 show the
calibration holds.

## Order

1 and 2 are done. 3 next (it is the measurement the whole thing rests on). 4 in parallel if agents
other than the corpus runner need Jev. 5 when Hermetic's branches merge. 6 is the PR worth writing
with him. 7 after 6 has numbers.
