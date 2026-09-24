# Local Grok runbook

Use this file as the system note when this repo is the workspace of a **local** Grok / Cursor session.

## Secrets

- Read `.env` for `TYPESAFE_API_KEY`. Never print it. Never write it into a file that will be committed.
- If the key is missing, stop and tell the human to copy `.env.example` → `.env`.

## Allowed MCP

- Gmail: `gmail_search`, list labels, list drafts, create draft.
- GitHub: list commits, get file, search code, get me.
- Forbidden unless the human types the exact tool name after a recorded GREEN+C10: `gmail_send_draft`, `gmail_send_message`, `github___push_files`, merge, force-push.

## First turn

1. `npm test` (no key).
2. `npm run smoke` (key).
3. Search `in:sent newer_than:7d`. Summarize classes. Do not dump bodies into public files.
4. Qualify one proposed short reply. Do not send it.
