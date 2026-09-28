# Source of truth: Jev × Vibium results

One registry, one protocol, one page. Read this before adding, quoting, or presenting any result.

## What is canonical

| Layer | Canonical file | Built by | Never |
| --- | --- | --- | --- |
| Raw measurements | JEV-works `kit/results/browser-*-2026-09-28.json`; jev-tape `results/raw/*.rows.json`; the spec sections named in the registry | the scripts that ran the experiment | edited after the run |
| **Registry** | jev-tape **`results/registry.json`** | `npm run registry` (`scripts/build-registry.mjs`) | edited by hand |
| Incoming results from other sessions | jev-tape `results/incoming/*.json` (schema in `results/incoming/README.md`) | the session that produced them | added without a source file |
| The page | jev-tape `docs/vibium-team-brief.html`, published copy https://claude.ai/artifact/WbfHE1ZKWmNGeR92iyx2d6 | `npm run brief` (registry, then `scripts/build-brief.mjs` over `docs/vibium-team-brief.src.html`) | edited directly (edit the `.src.html`) |
| Executive handoff | jev-tape `docs/HANDOFF-VIBIUM-TEAM.md` | by hand, numbers copied from the registry totals | carrying a number the registry does not |
| Session state | jev-tape `docs/HANDOFF-2026-09-28.md`, JEV-works `handoffs/vibium-browser.md` | by hand | |
| Questions | JEV-works `kit/modules/contexts/browser.*.json` (canonical); jev-tape `packs/*.json` (runtime copy, `loadPack` fails closed on drift) | by hand, then `kit/modules/cli.ts lint` | diverging |
| Design chrome | jev-tape `.claude/skills/ormus-chrome/` (vendored from the Ormus Fusion design system) | re-vendor from `Ormus-Solutions/ormus-brand` | restyled per page |

The registry is what every number on the page and in the handoff traces to. Its totals are computed, not
typed: `experiments`, `rows`, `jevCalls`, `verifyDecided`, `verifyRight`, `verifyWrong`, `verifyEscalates`,
`labelledRows`, `labelledRight`, `pages`, `sites`, `judges`. The page reads them as `{{placeholders}}`, so it
cannot disagree with the registry. Two charts on the page (per-decision time, login three ways) are hand-set
to E5, E6, E11 and E12; if those experiments change, change the chart.

## Registry schema

Top level: `schema`, `builtAt`, `jev`, `vibium`, `model`, `totals`, `experiments[]`, `rows[]`.

Experiment: `id` (`E<n>`, unique), `title`, `kind` (`lab` on recorded pages · `live` against real pages ·
`proxy` a stand-in for a tool that was not available), `n`, `date`, `jev`, `model`, `what`, `result` (the
number with its n and baseline), `stamp` + `stampWord`, `file` (the committed file it traces to), `source`
(the incoming file, when not built in).

Row: `exp`, `id` (unique within the experiment), `task`, `site`, `url`, `claim`, `expect`, `kind`, then
per judge: `jev`/`jevP`/`jevMs`/`jevOk`, `model`/`modelMs`/`modelOk`, `sonnet`/`sonnetMs`/`sonnetOk`;
`note`, `file`. `jevOk` is set only when a label exists. `jev` is a verdict word (`passed`, `failed`,
`escalate`, `stopped`, `none`) or, for question sets, the answers as text.

Stamps (a glyph and a word, never a color): ⚖ measured with a real number · ✓ accept · ± refine · ? speculative
· ⊘ gate, unmeasured, with the measurement that would strike it named · ◐ partial, below the sample floor ·
◆ ratified law.

## Adding results (GROW)

1. Keep the raw file where the experiment wrote it (JEV-works `kit/results/` for kit runs; jev-tape
   `results/raw/` for runtime runs, with page text stripped). Commit it.
2. Write `results/incoming/<source>.json` in the schema above: one experiment entry per experiment, one row per
   measurement, every one naming its file. Take the next free `E<n>`.
3. `npm run brief`. The build fails on a duplicate id, a missing field, an unknown stamp or an unknown
   experiment; fix the incoming file, never the registry.
4. Read the new totals it prints. Update the two handoffs where they quote a total; add a line to the
   experiment table in `docs/HANDOFF-VIBIUM-TEAM.md`.
5. Commit `results/incoming/*.json`, `results/registry.json`, `docs/vibium-team-brief.html` together.
   Republish the page from the built file.

Results that are not measurements (a design, a bridge, a plan) do not go in the registry; they go in the
page's Prospects section with a stamp, and in `docs/VIBIUM-BRIDGES.md`.

## Rules for numbers

Every number carries its n, its baseline and whether thresholds were fitted. In-sample claims are said to
be in-sample. A gate that is not yet measured is written as ⊘ with the measurement that would strike it, not
as an estimate. A wrong label is a finding about the label (E10, the "PDF" served as text/plain), not a
wrong verdict. No threshold moves because a result disappointed.

## Reading order for a new session

1. This file. 2. `results/registry.json` totals. 3. `docs/HANDOFF-VIBIUM-TEAM.md` (executive, file index).
4. `docs/HANDOFF-2026-09-28.md` (state, next steps, rails). 5. `spec/SURFACES-VIBIUM.md` §8 for the method
behind each experiment. 6. JEV-works `handoffs/vibium-browser.md` for the lab side.
