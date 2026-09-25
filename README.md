# jev-tape

TypeSafe qualifies. Code gates. Temporal records.

This repo is meant to run on **your machine** (local Grok, local Node).
The TypeSafe API key stays on that machine. It is never committed and never pasted into a chat.

Pin: `jev-1.13.0`. Queue: `jev-tape`. Fail closed. Apply last.

## Where to put your key

1. Create a key at [console.typesafe.ai/keys](https://console.typesafe.ai/keys).
2. Copy `.env.example` → `.env` in this repo root (`.env` is gitignored).

```bash
cp .env.example .env
```

3. Edit `.env` so it looks like:

```
TYPESAFE_API_KEY=ts_your_key_here
TYPESAFE_DEFAULT_MODEL=jev-1.13.0
TYPESAFE_BASE_URL=https://api.typesafe.ai
```

4. Load it into the shell you will run:

```bash
set -a && source .env && set +a
echo "key loaded: ${#TYPESAFE_API_KEY} chars"   # prints length only
```

Do **not** put the key in this README, any committed file, Vercel HTML, a Grok chat, or a browser CORS proxy.

If the key is missing, `npm run smoke` and `npm run qualify` exit 1. They will not invent a verdict.

## Run locally (Node 22+)

```bash
git clone git@github.com:manutej/jev-tape.git
cd jev-tape
cp .env.example .env          # then edit
set -a && source .env && set +a

npm run smoke                 # GET /v1/models + one pinned POST
npm test                      # codec, client, gate tests; no TypeSafe needed
```

`smoke` and `qualify` call TypeSafe. They do **not** send Gmail and do **not** push GitHub.

## Run with local Grok + MCP (pull mail, do not send)

Local Grok can see your connected Gmail / GitHub MCP. This repo does not embed those credentials.

1. Open this repo as the workspace.
2. Search sent mail or list commits (read tools only).
3. Write a fixture under `fixtures/` (see `fixtures/example-availability.json`).
4. `npm run qualify -- fixtures/example-availability.json`
5. Read printed `model`, answers and the gate (computed in code, θ smoke-only, so it never applies). The script will not send.

Details: [`docs/LOCAL-GROK.md`](docs/LOCAL-GROK.md). Key safety: [`spec/KEY-SAFETY.md`](spec/KEY-SAFETY.md).

| Allowed MCP | Forbidden until you explicitly flip a local flag |
| --- | --- |
| `gmail_search`, get message, create draft | `gmail_send_message`, `gmail_send_draft` |
| `github___list_commits`, search, get file | `github___push_files`, merge |

## What this is

| Layer | Role |
| --- | --- |
| `manutej/jev` | Operad names the questions |
| TypeSafe `jev-1.13.0` | Hosted judge. Answers only |
| This repo | Two gates + in-process Temporal twin |
| Your Gmail / GitHub MCP | Read surfaces. Writes stay parked |

Not a fourth product. Not Cloud Event History.

## Commands

```
npm test          # codec, client, gate — no key
npm run smoke     # key required — pin check
npm run qualify   # key required — fixture JSON in, answers + code gate out
node .jev/check.mjs --tests "npm test"   # what CI runs
```

Contract: `.jev/README.md`. Not built yet: engine, Temporal files, `npm run live` (see AGENTS.md).
