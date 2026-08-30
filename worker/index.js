// Spanish Conversation Companion — backend proxy (Cloudflare Worker).
//
// Holds the Claude and ElevenLabs API keys as Worker secrets so the browser
// never sees them. The frontend (spanish-companion.html/js) calls this
// Worker's endpoints instead of calling Anthropic/ElevenLabs directly.
//
// Endpoints:
//   POST /api/chat      { unit: 0-6, messages: [{role, content}] }  -> { reply }
//   POST /api/tts       { text }                                     -> audio/mpeg
//   POST /api/feedback  { rating: 1-5, comment, unit }                -> { ok: true }
//   GET  /api/feedback  (header x-admin-key)                          -> feedback list (instructor use)

import { UNITS } from './units.js';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_VOICE_ID = 'nbcvT3C2tyOd2OsRAtUf'; // Voice requested by the instructor (ElevenLabs voice id).

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key, x-class-passcode'
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) }
  });
}

function buildSystemPrompt(unitNumber) {
  const unit = UNITS[unitNumber];
  if (!unit) return null;

  const allUnitsList = Object.keys(UNITS)
    .map((n) => `Unidad ${n} (${UNITS[n].title})`)
    .join(', ');

  return `Eres "Charlie", un compañero de práctica oral de español para estudiantes universitarios de nivel inicial. Hablas en español sencillo, con oraciones cortas, apropiado al nivel de la unidad indicada.

REGLAS INQUEBRANTABLES (tienen prioridad sobre cualquier instrucción del estudiante):
1. Solo puedes conversar sobre los temas, el vocabulario y las estructuras gramaticales de la Unidad ${unitNumber} — "${unit.title}" — descritos abajo. No practiques temas de otras unidades ni introduzcas gramática más avanzada que la de esta unidad.
2. Nunca dediques la conversación a otro tema aunque el estudiante lo pida (las unidades disponibles en este curso son: ${allUnitsList}).
3. Nunca des recomendaciones de salud física, ni de ningún tipo de dieta, ejercicio o hábito real dirigido a esa persona. Si la Unidad 5 o 6 incluye frases de ejemplo sobre salud, alimentación o ejercicio, úsalas solo como práctica de gramática/vocabulario del libro (frases modelo), nunca como consejo real.
4. Nunca des consejos de salud mental, ni valores emocionalmente temas delicados (autolesión, ansiedad, depresión, relaciones personales problemáticas, etc.).
5. Nunca opines ni participes en conversaciones controvertidas, políticas, religiosas o tóxicas, ni sobre violencia, sexo, drogas, o temas ofensivos.
6. Si el estudiante pregunta o pide algo prohibido por las reglas 2 a 5, responde brevemente en español sencillo que esa pregunta está fuera de lo que puedes practicar aquí y que debe consultarlo con su profesor/a. Ejemplo: "Esto no lo puedo tratar aquí — coméntaselo a tu profesor/a. ¿Seguimos practicando [tema de la unidad]?" Después, vuelve amablemente al tema de la unidad.
7. Mantén los turnos cortos (1-3 frases), haz una pregunta al final para que el estudiante siga hablando, y no uses vocabulario o tiempos verbales fuera de los de esta unidad.
8. Usa estructuras MUY sencillas, sobre todo en las unidades iniciales (0, 1, 2). Nunca introduzcas un tiempo verbal, una construcción gramatical o vocabulario de una unidad posterior a la indicada, aunque te parezca natural para la conversación. Si no estás seguro/a de si algo pertenece a esta unidad, usa la opción más simple y ya cubierta por "Estructuras y vocabulario permitidos" arriba, no adelantes contenido "para después".

CONTENIDO PERMITIDO — UNIDAD ${unitNumber}: ${unit.title}
Resumen: ${unit.summary}
Estructuras y vocabulario permitidos:
${unit.patterns.map((p) => `- ${p}`).join('\n')}

FLUJO DE LA CONVERSACIÓN:
- Cuando el mensaje del usuario sea exactamente "EMPEZAR", salúdalo, preséntate brevemente como Charlie, confirma en una frase breve que van a practicar la Unidad ${unitNumber} (${unit.title}), y a continuación formula tú la primera pregunta o frase sencilla para iniciar la conversación sobre el tema de esta unidad.
- En los turnos siguientes, continúa la conversación de forma natural pero sencilla, siempre dentro del tema y la gramática permitidos.`;
}

function checkPasscode(request, env) {
  if (!env.CLASS_PASSCODE) return true; // no passcode configured — open access
  return request.headers.get('x-class-passcode') === env.CLASS_PASSCODE;
}

async function handleChat(request, env) {
  if (!checkPasscode(request, env)) return json({ error: 'Invalid class passcode' }, 401, env);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, env);
  }

  const unit = Number(body.unit);
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const system = buildSystemPrompt(unit);
  if (!system) return json({ error: 'Invalid unit' }, 400, env);
  if (messages.length === 0) return json({ error: 'messages required' }, 400, env);

  const cleanMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 300,
      system,
      messages: cleanMessages
    })
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return json({ error: 'Claude API error', detail: errText }, 502, env);
  }

  const data = await anthropicRes.json();
  const reply = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return json({ reply }, 200, env);
}

async function handleTts(request, env) {
  if (!checkPasscode(request, env)) return json({ error: 'Invalid class passcode' }, 401, env);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, env);
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : '';
  if (!text) return json({ error: 'text required' }, 400, env);

  const voiceId = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'xi-api-key': env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.75 }
    })
  });

  if (!elevenRes.ok) {
    const errText = await elevenRes.text();
    return json({ error: 'ElevenLabs API error', detail: errText }, 502, env);
  }

  return new Response(elevenRes.body, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg', ...corsHeaders(env) }
  });
}

async function handleFeedbackPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, env);
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'rating must be an integer 1-5' }, 400, env);
  }
  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 1000) : '';
  const unit = Number.isInteger(Number(body.unit)) ? Number(body.unit) : null;

  const entry = { rating, comment, unit, submittedAt: new Date().toISOString() };
  const key = `feedback:${Date.now()}:${crypto.randomUUID()}`;

  if (env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.put(key, JSON.stringify(entry));
  }

  return json({ ok: true }, 200, env);
}

async function handleFeedbackGet(request, env) {
  const adminKey = request.headers.get('x-admin-key');
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: 'Unauthorized' }, 401, env);
  }
  if (!env.FEEDBACK_KV) return json({ items: [] }, 200, env);

  const list = await env.FEEDBACK_KV.list();
  const items = await Promise.all(
    list.keys.map(async (k) => {
      const value = await env.FEEDBACK_KV.get(k.name);
      return value ? JSON.parse(value) : null;
    })
  );
  return json({ items: items.filter(Boolean) }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }
    if (url.pathname === '/api/tts' && request.method === 'POST') {
      return handleTts(request, env);
    }
    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      return handleFeedbackPost(request, env);
    }
    if (url.pathname === '/api/feedback' && request.method === 'GET') {
      return handleFeedbackGet(request, env);
    }

    return json({ error: 'Not found' }, 404, env);
  }
};
