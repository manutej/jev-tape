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

If the key is missing, `npm run live` and `npm run smoke` exit 1. They will not invent a verdict.

## Run locally (Node 22+)

```bash
git clone git@github.com:manutej/jev-tape.git
cd jev-tape
cp .env.example .env          # then edit
set -a && source .env && set +a

npm run smoke                 # GET /v1/models + one pinned POST
npm test                      # twins, no TypeSafe needed
npm run live -- "I can make Oct 2 from 9:00-10:00 CT"
```

`smoke` and `live` call TypeSafe. They do **not** send Gmail and do **not** push GitHub.

## Run with local Grok + MCP (pull mail, do not send)

Local Grok can see your connected Gmail / GitHub MCP. This repo does not embed those credentials.

1. Open this repo as the workspace.
2. Search sent mail or list commits (read tools only).
3. Write a fixture under `fixtures/` (see `fixtures/example-availability.json`).
4. `npm run qualify -- fixtures/example-availability.json`
5. Read printed `model` + answers. The script will not send.

Details: [`docs/LOCAL-GROK.md`](docs/LOCAL-GROK.md). Key safety: [`spec/KEY-SAFETY.md`](spec/KEY-SAFETY.md). Browser demo from your terminal: [`docs/LOCAL-DEMO.md`](docs/LOCAL-DEMO.md).

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
| Vibium (browser) | Sensor + actuator. `map` / `text` / `url` in, verbs out. Commit verbs gated, steps verified. `spec/SURFACES-VIBIUM.md` |

Not a fourth product. Not Cloud Event History.

## Commands

```
npm test          # engine + twins — no key
npm run check     # FIRE still unrepresentable
npm run temporal  # scripts match spec/TEMPORAL.md
npm run smoke     # key required — pin check
npm run live      # key required — one Capture
npm run qualify   # key required — fixture JSON in, verdict out
npm run vibium    # key required — one typed browser flow: gate the click, verify the page, ≤ 2 POSTs
```
