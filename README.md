# Spanish Conversation Companion

A talking practice companion for Spanish language students. It prompts for
an optional anonymous star rating and comment, lets the student pick a unit
(0–6, matching the course's "Campus Difusión" textbook units), then holds a
simple, level-appropriate conversation on that unit's topics only — with
spoken replies (ElevenLabs) and a collapsible transcript.

- `spanish-companion.html` / `.css` / `.js` — the student-facing page.
- `worker/` — the Cloudflare Worker backend that holds the Claude and
  ElevenLabs API keys server-side (never exposed to the browser) and
  enforces the unit-topic restriction and the refusal rules (no health,
  mental-health, or controversial-topic advice — redirects to the
  instructor instead). See `worker/README.md` for deployment steps
  (both a no-terminal, Cloudflare-dashboard path and a `wrangler` CLI path).

## Quick start

1. Deploy `worker/dashboard-worker.js` as a Cloudflare Worker (see
   `worker/README.md`) and set your `ANTHROPIC_API_KEY` and
   `ELEVENLABS_API_KEY` as encrypted secrets there.
2. Set `WORKER_BASE_URL` in `spanish-companion.js` to your Worker's URL.
3. Publish this repo with GitHub Pages (Settings → Pages → deploy from
   branch) and share the resulting link with students.
