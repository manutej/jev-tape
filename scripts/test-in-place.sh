#!/usr/bin/env bash
# Acceptance run for the Vibium team: proves the loop on your machine, with your Vibium binary.
#   scripts/test-in-place.sh            no-key checks, then the keyed checks if TYPESAFE_API_KEY is set
#   scripts/test-in-place.sh --no-key   only the checks that need no key and no browser
# Needs: Node >= 22.18, `vibium` on PATH or VIBIUM_BIN. Nothing here sends mail, pushes code or spends money.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0; skip=0
ok()   { pass=$((pass+1)); printf '  PASS  %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL  %s\n' "$1"; }
skp()  { skip=$((skip+1)); printf '  SKIP  %s\n' "$1"; }
B=${VIBIUM_BIN:-vibium}

echo "1  no key, no browser"
node -e 'const v=process.versions.node.split(".").map(Number); process.exit(v[0]>22||(v[0]===22&&v[1]>=18)?0:1)' && ok "node $(node -v) >= 22.18" || bad "node $(node -v) is below 22.18"
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null 2>&1
out=$(npm test 2>&1); echo "$out" | grep -q "^# fail 0" && ok "npm test: $(echo "$out" | grep -E '^# pass' | tr -d '#')" || { bad "npm test"; echo "$out" | grep -E "not ok|Error" | head -5; }
npx tsc --noEmit >/dev/null 2>&1 && ok "typecheck" || bad "typecheck"
cp results/registry.json /tmp/registry.before.json
node scripts/build-registry.mjs >/dev/null 2>&1 && node -e '
const a=JSON.parse(require("fs").readFileSync("/tmp/registry.before.json")),b=JSON.parse(require("fs").readFileSync("results/registry.json"));
delete a.builtAt; delete b.builtAt; process.exit(JSON.stringify(a)===JSON.stringify(b)?0:1)' && ok "registry rebuilds to the committed file ($(node -e 'const r=require("./results/registry.json");console.log(r.totals.experiments+" experiments, "+r.totals.rows+" rows")'))" || bad "registry drift: run npm run registry and commit"
git checkout -q results/registry.json 2>/dev/null || true
node scripts/build-brief.mjs >/dev/null 2>&1 && ok "brief builds" || bad "brief build"; git checkout -q docs/vibium-team-brief.html 2>/dev/null || true
if command -v "$B" >/dev/null 2>&1; then ok "vibium found: $($B --version 2>/dev/null | head -1)"; else skp "vibium not on PATH (set VIBIUM_BIN); keyed checks need it"; fi

if [ "${1:-}" = "--no-key" ]; then echo; echo "pass $pass · fail $fail · skip $skip"; exit $((fail>0)); fi
echo; echo "2  with the TypeSafe key"
if [ -z "${TYPESAFE_API_KEY:-}" ]; then skp "TYPESAFE_API_KEY not set: source .env, then re-run"; echo; echo "pass $pass · fail $fail · skip $skip"; exit $((fail>0)); fi
out=$(npm run smoke 2>&1); echo "$out" | grep -q "jev-1.13.0" && ok "smoke: key works, pin jev-1.13.0" || { bad "smoke"; echo "$out" | tail -3; }
if ! command -v "$B" >/dev/null 2>&1; then echo; echo "pass $pass · fail $fail · skip $skip"; exit $((fail>0)); fi

echo; echo "3  with the browser: the fixture login, gated and verified, then replayed"
node scripts/fixture-site.mjs 8787 >/tmp/fixture.log 2>&1 & FIX=$!
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null http://127.0.0.1:8787/login && break; sleep 0.5; done
export VIBIUM_SESSION=tip
run=(npm run vibium -- --url http://127.0.0.1:8787/login --fill @e1 tomsmith --fill @e2 'SuperSecretPassword!' --click @e3 --expect "the person is signed in and the secure area is showing" --verify-module login-verify --allow-host 127.0.0.1 --approve-escalate --headless --tape /tmp/tip-tape.jsonl)
rm -f /tmp/tip-tape.jsonl
out=$("${run[@]}" 2>&1); code=$?
echo "$out" | grep -qE '"verify":\s*"?(true|verified)' && ok "login verified by Jev (exit $code)" || { bad "login step (exit $code)"; echo "$out" | grep -E '"route"|error' | tail -8; }
calls=$(echo "$out" | grep -oE '"judgeCalls":\s*[0-9]+' | tail -1 | grep -oE '[0-9]+$'); [ -n "$calls" ] && [ "$calls" -le 2 ] && ok "at most two Jev calls for the whole login (saw $calls)" || bad "expected <= 2 Jev calls, saw ${calls:-none}"
out=$("${run[@]}" --replay 2>&1); echo "$out" | grep -qE '"judgeCalls":\s*0' && ok "replay from the tape: 0 calls" || bad "replay still made calls"
$B daemon stop --session tip >/dev/null 2>&1 || true; kill $FIX >/dev/null 2>&1 || true; $B daemon stop --session tip --json >/dev/null 2>&1 || true
echo; echo "pass $pass · fail $fail · skip $skip"
echo "next: npm run bench (needs XAI_API_KEY, ~6 min), npm run corpus -- --catalog fixtures/vibium/catalog-pages.json --rows 0-9 --workers 1 --record recordings/ --out runs/tip.json"
exit $((fail>0))
