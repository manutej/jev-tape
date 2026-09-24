# Set up TYPESAFE_API_KEY

Create the key yourself. Do not paste it into a chat or a public repo.

1. Open https://console.typesafe.ai/keys
2. Create a key. Copy it once.
3. `cp .env.example .env` and put the key on the first line.
4. `set -a && source .env && set +a`
5. `npm run smoke`

Still illegal after the key exists: `gmail_send_*`, GitHub push/merge from a harness, committing `.env`, requesting `jev-latest`.
