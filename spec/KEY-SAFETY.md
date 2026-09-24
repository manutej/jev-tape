# Key safety

Do not paste `TYPESAFE_API_KEY` into a Grok chat. This remote session is not your laptop.

Official create: https://console.typesafe.ai/keys
Official env: `TYPESAFE_API_KEY`
Official call: `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer` and `model: jev-1.13.0`.

Send back from a local run only: `response.model` and the answers object. Not the header. Not the key.
