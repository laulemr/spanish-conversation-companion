# Spanish Conversation Companion — backend

This Cloudflare Worker keeps your Claude and ElevenLabs API keys server-side
so they never appear in the browser page or in this git repository. The
frontend (`../spanish-companion.html`) calls this Worker instead of calling
Anthropic/ElevenLabs directly.

## One-time setup

1. Install Wrangler (Cloudflare's CLI) if you don't have it:
   ```
   npm install -g wrangler
   ```
2. Log in to your Cloudflare account (free tier is enough):
   ```
   wrangler login
   ```
3. From this `worker/` folder, create the KV namespace used to store
   anonymous star-rating feedback:
   ```
   wrangler kv namespace create FEEDBACK_KV
   ```
   Copy the `id` it prints and paste it into `wrangler.toml` in place of
   `REPLACE_WITH_KV_NAMESPACE_ID`.
4. Store your API keys as encrypted secrets (you'll be prompted to paste
   each key — it is encrypted by Cloudflare and never touches this repo or
   any chat log):
   ```
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put ELEVENLABS_API_KEY
   ```
   Optional: also set an admin key to view feedback later:
   ```
   wrangler secret put ADMIN_KEY
   ```
5. Deploy:
   ```
   wrangler deploy
   ```
   Wrangler prints your Worker's URL, e.g.
   `https://spanish-conversation-companion.YOUR-SUBDOMAIN.workers.dev`.
6. Open `../spanish-companion.js` and set `WORKER_BASE_URL` to that URL.
7. (Recommended) Once you know the exact domain the `spanish-companion.html`
   page will be hosted from, edit `wrangler.toml` and set `ALLOWED_ORIGIN`
   to that domain instead of `"*"`, then `wrangler deploy` again — this
   stops other sites from using your Worker (and your API quota).

## Endpoints

- `POST /api/chat` — `{ unit: 0-6, messages: [...] }` → `{ reply }`. Proxies
  to Claude (model set via `ANTHROPIC_MODEL` secret/var, defaults to
  `claude-haiku-4-5-20251001`) with a system prompt built from
  `units.js` that restricts the conversation to the selected unit's topics
  and blocks health, mental-health, and controversial content.
- `POST /api/tts` — `{ text }` → MP3 audio. Proxies to ElevenLabs using the
  voice in `ELEVENLABS_VOICE_ID` (defaults to the premade male voice
  "Adam", `pNInz6obpgDQGcFmaJgB`). To use a different male voice, set:
  ```
  wrangler secret put ELEVENLABS_VOICE_ID
  ```
- `POST /api/feedback` — `{ rating: 1-5, comment }` → stores anonymously in
  KV. No auth (it's meant to be public and anonymous).
- `GET /api/feedback` — returns all stored feedback as JSON. Requires
  header `x-admin-key: <your ADMIN_KEY>`. Use this to review student
  ratings/comments, e.g.:
  ```
  curl -H "x-admin-key: YOUR_ADMIN_KEY" https://YOUR-WORKER-URL/api/feedback
  ```

## Changing what each unit is allowed to talk about

Edit `units.js` — each unit has a `summary` and a `patterns` list. The
system prompt in `index.js` only allows the model to use what's listed
there for the selected unit.

## Local testing (optional)

```
wrangler dev
```
This runs the Worker on `http://localhost:8787` using secrets from a local
`.dev.vars` file (create one with the same keys as above — this file is
already covered by the default Wrangler `.gitignore` behavior, but double
check it never gets committed).
