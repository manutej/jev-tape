# Run the Vibium surface from your own terminal

Everything runs on your machine. The TypeSafe key stays in your shell. Nothing sends mail, pushes code, or spends money.

## What you need

| Need | Where it comes from |
| --- | --- |
| Node ≥ 22.18 | `/opt/homebrew/bin/node` (v25) works; v22.17 does not run `.ts` natively |
| `vibium` on PATH | `npm install -g vibium` (26.8.21) or the nightly you already have under `~/.local/bin`. Check with `vibium --version` and `vibium ready browser` |
| Chrome for Testing | `vibium install` once; `vibium paths` shows where |
| `TYPESAFE_API_KEY` | already exported in `~/.zshrc`, or `cp .env.example .env` here and `set -a && source .env && set +a` |
| `XAI_API_KEY` | only for the model comparison and the model fallback. `~/.config/vibium/ai.env` is loaded by vibium itself |

No `VIBIUM_CHROME_ARGS` on a laptop. The `--no-sandbox --ignore-certificate-errors` pair was for a root container behind a TLS proxy.

## Set up

```bash
git clone git@github.com:manutej/jev-tape.git && cd jev-tape
git checkout claude/nice-fermat-ky9qtz          # until it is merged
npm test                                        # 13 twins, no browser, no key
npm run smoke                                   # proves the key and the pin jev-1.13.0
vibium ready ai --provider xai --model grok-4.6 # optional: proves the model path
```

## The demo, one command

```bash
scripts/demo.sh                 # login with Jev, replay from the tape, Hacker News, an element pick
scripts/demo.sh --with-model    # adds the model-only login for the side-by-side timing
scripts/demo.sh --headed        # watch the browser
```

## Direct queries

One typed step against any page. Refs (`@e3`) come from `vibium map`; run `vibium go URL && vibium map` first to see them.

```bash
# gate a click and verify the landing, with the model as fallback on the verify
npm run vibium -- --url https://news.ycombinator.com/ --click @e3 \
  --expect "the newest submissions page of Hacker News is showing" \
  --allow-host news.ycombinator.com --llm-fallback --headless --stop

# fill + submit on a real site (GitHub: the first fill may not stick in its React search box; verify will say so)
npm run vibium -- --url https://github.com/microsoft/vscode/issues \
  --fill @e34 "is:issue is:open label:bug" --press Enter \
  --expect "the issues list is filtered to open issues labelled bug" \
  --allow-host github.com --llm-fallback --headless --screenshots ./shots --stop

# which element is the one for a goal? (one Choice over the whole map, escape "none")
npm run pick -- --url https://github.com/microsoft/vscode/issues \
  --goal "search the issues by typing a query" --goal "open the pull requests tab" --headless --stop

# same claim to Jev and to vibium check on eight real pages
npm run bench

# replay any flow with zero calls
npm run vibium -- --replay ...same arguments...
```

Flags on `npm run vibium`: `--fill @ref value` (tab edit, no call) · `--click @ref` / `--press Enter` (commit, one gate call) · `--expect "claim"` (one verify call) · `--verify-module login-verify` · `--allow-host H` (repeatable) · `--approve-escalate` (you compose a parked step) · `--llm-fallback` (verify escalate → `vibium check`) · `--screenshots DIR` · `--corpus states.json` (append every snapshot for JEV-works) · `--tape PATH` · `--replay`.

Exit codes: 0 the last verdict was true · 2 parked, refused, or not verified · 1 error or missing key.

## Read the results

Every line is JSON: `route` (read, tab-edit, nav, auto, auto-llm, human, human-compose, refuse, escalate, refused-host), `gate` and `verify` verdicts, `judgeCalls`, and `ms` per stage. The `gate answers:` and `verify answers:` lines are Jev's raw probabilities. `runs/vibium-tape.jsonl` holds every request and answer; a second identical run reads from it.

## Where it goes wrong, and what it means

| Symptom | Meaning |
| --- | --- |
| `route: escalate` on a login submit | Jev read "signing in changes server state" as mutatesWorld ~0.8. Approve with `--approve-escalate`, or name routine commits in policy. Not a threshold to move |
| `refused-host` | the page's hostname is not in `--allow-host` |
| `stale ref @eN` | the map changed; re-run `vibium map` and use the new ref |
| `NavError … empty document` | the host did not answer in time; the step reloaded once and gave up |
| verify `false` on a real site | check the screenshot before blaming Jev: on GitHub it was right |
