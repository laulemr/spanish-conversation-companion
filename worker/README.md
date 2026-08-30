# Spanish Conversation Companion — backend

This Cloudflare Worker keeps your Claude and Google Cloud Text-to-Speech API
keys server-side so they never appear in the browser page or in this git
repository. The frontend (`../spanish-companion.html`) calls this Worker
instead of calling Anthropic/Google directly.

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
   wrangler secret put GOOGLE_TTS_API_KEY
   ```
   Get the Google key from Google Cloud Console: enable the **Cloud
   Text-to-Speech API** on a project, then Credentials → Create Credentials
   → API key. Restricting the key to that one API is recommended.
   Optional: also set an admin key to view feedback later:
   ```
   wrangler secret put ADMIN_KEY
   ```
   Recommended: set a class passcode so strangers can't call your Worker
   directly and burn through your API credits. Pick any short phrase and
   share it with your students:
   ```
   wrangler secret put CLASS_PASSCODE
   ```
   The frontend already has a passcode entry screen wired up to send this
   as the `x-class-passcode` header. If you skip this step, the Worker
   stays open to anyone who has the page link.
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
- `POST /api/tts` — `{ text }` → MP3 audio. Proxies to Google Cloud
  Text-to-Speech using the voice in `GOOGLE_TTS_VOICE_NAME` (defaults to
  `es-US-Neural2-B`, a neutral male Latin American Spanish voice) and
  language `GOOGLE_TTS_LANGUAGE_CODE` (defaults to `es-US`). To use a
  different voice — e.g. a Spain accent — preview options at
  cloud.google.com/text-to-speech, then set:
  ```
  wrangler secret put GOOGLE_TTS_VOICE_NAME
  wrangler secret put GOOGLE_TTS_LANGUAGE_CODE
  ```
  (e.g. `es-ES-Neural2-B` with language code `es-ES` for a Spain accent
  instead). For a more natural, less flat/robotic delivery, tune two more
  optional variables (Google's ranges: `speakingRate` 0.25–4.0, `pitch`
  −20.0–20.0 semitones; defaults are `1.05` and `0`):
  ```
  wrangler secret put GOOGLE_TTS_SPEAKING_RATE
  wrangler secret put GOOGLE_TTS_PITCH
  ```
  For a noticeably more conversational/expressive voice (at a higher
  per-character price than Neural2 — check current rates at
  cloud.google.com/text-to-speech/pricing before switching), try a
  Chirp3-HD voice instead, e.g. `es-US-Chirp3-HD-Puck` via
  `GOOGLE_TTS_VOICE_NAME`.
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
