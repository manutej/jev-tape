#!/usr/bin/env bash
# The live demo, end to end, from a terminal on your own machine. Needs TYPESAFE_API_KEY exported and
# `vibium` on PATH (or VIBIUM_BIN). XAI_API_KEY is needed only for the --with-model comparison.
#
#   scripts/demo.sh                 login on the local fixture site with Jev, then replay, then Hacker News, then an element pick
#   scripts/demo.sh --with-model    also runs the model-only login (vibium run + check) for the timing comparison
#   scripts/demo.sh --headed        show the browser window (default headless)
#
# Nothing here sends mail, pushes code, or spends money. The only sites touched are 127.0.0.1, news.ycombinator.com,
# and github.com (read only).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${TYPESAFE_API_KEY:-}" ] || { echo "TYPESAFE_API_KEY is not set (source .env or ~/.zshrc)"; exit 1; }
HEADLESS=--headless; WITH_MODEL=0
for a in "$@"; do case "$a" in --headed) HEADLESS="";; --with-model) WITH_MODEL=1;; esac; done
PORT=${FIXTURE_PORT:-8787}
now(){ date +%s; }
say(){ printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/5  fixture site on http://127.0.0.1:$PORT"
node scripts/fixture-site.mjs "$PORT" >/dev/null 2>&1 & SITE=$!
trap 'kill $SITE 2>/dev/null || true' EXIT
sleep 1

say "2/5  login with Jev: gate the submit, operator policy composes, verify the landing (expect 2 calls, then 0 on replay)"
t=$(now)
VIBIUM_SESSION=demo-login npm run --silent vibium -- --url "http://127.0.0.1:$PORT/login" \
  --fill @e1 tomsmith --fill @e2 'SuperSecretPassword!' --click @e3 \
  --expect "the user is signed in and sees the secure area" --verify-module login-verify \
  --allow-host 127.0.0.1 --approve-escalate $HEADLESS --stop | grep -E '^\{"(action|steps)' || true
echo "login with Jev: $(( $(now) - t )) s"

say "3/5  the same login replayed from the tape"
VIBIUM_SESSION=demo-replay npm run --silent vibium -- --replay --url "http://127.0.0.1:$PORT/login" \
  --fill @e1 tomsmith --fill @e2 'SuperSecretPassword!' --click @e3 \
  --expect "the user is signed in and sees the secure area" --verify-module login-verify \
  --allow-host 127.0.0.1 --approve-escalate $HEADLESS --stop | grep -E '^\{"steps' || true

if [ "$WITH_MODEL" = 1 ]; then
  say "3b   model only: vibium run + vibium check (needs XAI_API_KEY; takes 30–60 s)"
  B=${VIBIUM_BIN:-vibium}; export VIBIUM_SESSION=demo-model
  t=$(now); $B --json $HEADLESS go "http://127.0.0.1:$PORT/login" >/dev/null
  $B --json run --provider "${VIBIUM_AI_PROVIDER:-xai}" --model "${VIBIUM_AI_MODEL:-grok-4.6}" --reasoning-effort "" \
    "Log in with username tomsmith and password SuperSecretPassword! and stop when the secure area is showing" | head -c 300; echo
  $B --json check --provider "${VIBIUM_AI_PROVIDER:-xai}" --model "${VIBIUM_AI_MODEL:-grok-4.6}" --reasoning-effort "" \
    "the user is signed in and sees the secure area" | head -c 200; echo
  echo "login with the model only: $(( $(now) - t )) s"; $B --json daemon stop >/dev/null || true
fi

say "4/5  a real site: Hacker News, click 'new', gated and verified with no person and no model"
VIBIUM_SESSION=demo-hn npm run --silent vibium -- --url https://news.ycombinator.com/ --click @e3 \
  --expect "the newest submissions page of Hacker News is showing" --allow-host news.ycombinator.com \
  --llm-fallback $HEADLESS --stop | grep -E '^\{"(action|steps)' || true

say "5/5  a direct query: which element on the vscode issues page is the search box?"
VIBIUM_SESSION=demo-pick npm run --silent pick -- --url https://github.com/microsoft/vscode/issues \
  --goal "search the issues by typing a query" --goal "pay for a GitHub subscription" $HEADLESS --stop || true

say "done. Tape: runs/vibium-tape.jsonl · spec: spec/SURFACES-VIBIUM.md"
