# Test it in place: the Vibium team's runbook

Everything the brief claims can be reproduced from a fresh clone on your own machine with your own Vibium
binary. Nothing here sends mail, pushes code or spends money. Ten minutes for the no-key and login checks;
the bench and corpus runs take longer and need the model key.

## 1. What you need

| Need | Notes |
| --- | --- |
| Node 22.18 or newer | `node -v`. Older 22.x does not run `.ts` natively |
| Vibium | your own build or `npm install -g vibium`. `vibium --version`, `vibium ready browser`. If it is not on PATH, `export VIBIUM_BIN=/path/to/vibium` |
| `TYPESAFE_API_KEY` | the Jev key. `cp .env.example .env`, fill the first line, then `set -a && source .env && set +a`. Never commit `.env` |
| `XAI_API_KEY` | only for the model comparison (`npm run bench`) and the model fallback. Vibium reads it from `~/.config/vibium/ai.env` or the environment |
| A laptop, not a root container | leave `VIBIUM_CHROME_ARGS` unset. The `--no-sandbox` pair in the docs was for a cloud container |

```bash
git clone https://github.com/manutej/jev-tape.git && cd jev-tape
git checkout claude/nice-fermat-ky9qtz     # until it is merged
npm ci
```

## 2. The acceptance script

```bash
scripts/test-in-place.sh --no-key     # 1: tests, typecheck, the registry rebuilds, the page builds
scripts/test-in-place.sh              # adds 2: the key and pin; 3: the fixture login gated, verified and replayed
```

Expected: `pass 10 · fail 0 · skip 0`. What each line proves:

| Line | Proves |
| --- | --- |
| `npm test: pass 42` | the loop shape, twin-tested against a fake Vibium binary and a scripted judge; no key, no browser |
| `registry rebuilds to the committed file` | every number in `results/registry.json` comes from the committed result files |
| `smoke: key works, pin jev-1.13.0` | your key reaches Jev and answers with the pinned model |
| `login verified by Jev` | on the local fixture site, the submit was gated (Jev escalates on a sign-in; the script composes as the operator would), the landing was verified by the four login questions |
| `at most two Jev calls for the whole login (saw 2)` | reads and fills never call Jev; one gate, one verify |
| `replay from the tape: 0 calls` | the same flow a second time reads its answers from the tape |

The script writes its tape to `/tmp/tip-tape.jsonl` and runs Vibium under session `tip`, so it does not
touch a daemon you already have open.

## 3. Reproduce the headline numbers

```bash
npm run bench                                   # E5: eight real pages, same claim to Jev and to vibium check. ~6 min, needs XAI_API_KEY
npm run corpus -- --catalog fixtures/vibium/catalog-pages.json --rows 0-19 --workers 1 \
  --record recordings/ --out runs/mine.json --items runs/mine.items.json     # E9 shard with per-row recording zips
npm run calibrate -- runs/mine.json             # Brier and reliability bins from your own run
npm run judges                                  # rebuild docs/judges-comparison.html from the committed runs
npm run pick -- --url https://github.com/microsoft/vscode/issues --goal "search the issues by typing a query" --headless --stop   # E8
```

What to expect, and what would be a finding: Jev per decision 200 to 500 ms (a slower answer is network,
the answer itself is the same); `vibium check` 15 s to 2 min per page; on the bench Jev decides 6 of 8 and
escalates the Cloudflare-walled npm page and one false claim; a verdict Jev gets wrong against the page is
a finding, please send the row (`runs/mine.json` has it) and it goes into `results/incoming/`.

## 4. Direct queries against any page

```bash
vibium go https://news.ycombinator.com/ && vibium map          # refs like @e3 come from the map
npm run vibium -- --url https://news.ycombinator.com/ --click @e3 \
  --expect "the newest submissions page of Hacker News is showing" \
  --allow-host news.ycombinator.com --llm-fallback --headless --stop
```

Flags: `--fill @ref value` (tab edit, no call) · `--click @ref` or `--press Enter` (commit, one gate call) ·
`--expect "claim"` (one verify call) · `--verify-module login-verify` · `--allow-host H` · `--approve-escalate`
(you compose a parked step) · `--llm-fallback` (verify escalate goes to `vibium check`) · `--screenshots DIR`
· `--tape PATH` · `--replay`. Exit 0 the last verdict was true, 2 parked or refused or not verified, 1 error.
`docs/LOCAL-DEMO.md` has more, including `scripts/demo.sh --with-model` for the side-by-side login timing.

## 5. Where your results go

Keep the raw output committed where the run wrote it, write `results/incoming/<your-name>.json` in the schema
in `results/incoming/README.md` with the next free experiment id, run `npm run brief`, and the page and the
registry carry your rows. `docs/SOURCE-OF-TRUTH.md` is the protocol.

## 6. What to read

`docs/HANDOFF-VIBIUM-TEAM.md` (the executive summary and file index) · `docs/vibium-team-brief.html` (the
page) · `spec/SURFACES-VIBIUM.md` (the design and every measurement) · `docs/VIBIUM-BRIDGES.md` (the seven
bridges; the ask is number 6) · `packs/*.json` (the questions Jev is asked, verbatim).
