// Spanish Conversation Companion — backend, single-file version for pasting
// directly into the Cloudflare dashboard's Worker code editor (no terminal,
// no wrangler needed). Functionally identical to index.js + units.js.
//
// Endpoints:
//   POST /api/chat      { unit: 0-6, messages: [{role, content}] }  -> { reply }
//   POST /api/tts       { text }                                     -> audio/mpeg
//   POST /api/feedback  { rating: 1-5, comment, unit }                -> { ok: true }
//   GET  /api/feedback  (header x-admin-key)                          -> feedback list (instructor use)

const UNITS = {
  0: {
    title: 'Gente en clase',
    summary: 'Saludar y despedirse; decir tu nombre y tu lugar de origen; preguntas básicas para pedir aclaraciones en clase; presentarte con datos sencillos (ciudad, palabra en español, escritor/a, cantante o grupo, serie de TV, director/a de cine, canción favorita).',
    patterns: [
      'Saludos y despedidas: Hola, ¿qué tal?, Adiós, Hasta luego',
      'Me llamo... / Soy de...',
      'Preguntas de control de la comunicación: ¿Cómo? ¿Perdón? ¿Qué significa...? ¿Cómo se dice...? ¿Cómo se escribe...?',
      'Presentarse con gustos culturales sencillos: Un/a escritor/a es..., Una canción es..., Una serie de TV es...'
    ]
  },
  1: {
    title: 'Gente que estudia español',
    summary: 'Números del 0 al 20; el alfabeto y deletrear; países de habla hispana y sus capitales; dar un número de teléfono o un correo electrónico; expresar intereses culturales; hablar, de forma respetuosa y sin generalizar, sobre estereotipos culturales y los diferentes acentos del español.',
    patterns: [
      'Artículos determinados: el, la, los, las',
      'Concordancia de género y número',
      'Pronombres sujeto + presente de "ser" (soy, eres, es, somos, sois, son)',
      'Demostrativos: este/a/os/as, esto',
      'Sí / no',
      'Números 0-20; el alfabeto; ¿Cómo se escribe...? ¿Se escribe con...?',
      'Me interesa.../Me gusta... (intereses culturales)'
    ]
  },
  2: {
    title: 'Gente con gente',
    summary: 'Dar información personal sencilla de otra persona: nacionalidad, edad, estado civil, profesión; describir el carácter y el aspecto físico de alguien; hablar de relaciones familiares (padres, hermanos/as, hijos/as); dar una razón sencilla con "porque".',
    patterns: [
      'Presente regular de los tres grupos: -ar (trabajar), -er (leer), -ir (escribir)',
      'Género y número de los adjetivos (simpático/a, trabajador/a, alto/alta)',
      'Números del 20 al 100',
      '¿Cuántos años tiene/s? Tengo... años',
      'Relaciones familiares: mi padre/madre, mi hermano/a, mi hijo/a',
      'Explicar con "porque"'
    ]
  },
  3: {
    title: 'Gente de vacaciones',
    summary: 'Hablar de gustos, intereses y preferencias de viaje; coincidir o discrepar sobre gustos; describir un lugar y los servicios que tiene; planear unas vacaciones sencillas (adónde ir, cómo viajar, dónde alojarse).',
    patterns: [
      'Verbos gustar / interesar / querer / preferir (presente)',
      'Coincidir/discrepar: a mí sí, a mí no, a mí también, a mí tampoco',
      'Hay / está(n) / tiene(n) para hablar de lugares y servicios',
      'Preguntas con qué, quién, dónde, cuándo, cómo',
      'Conector "porque"'
    ]
  },
  4: {
    title: 'Gente de compras',
    summary: 'Ir de compras: describir y valorar objetos, preguntar y decir precios, hablar de ropa y colores, decir qué necesitas u obligación de hacer algo, elegir un regalo sencillo para alguien.',
    patterns: [
      'Números a partir de 100',
      '¿Cuánto cuesta/n...? Cuesta/n...',
      'Tener que + infinitivo (obligación); Poder + infinitivo',
      'Un / uno / una',
      'Pronombres de objeto directo (lo, la, los, las) e indirecto (le, les) en frases simples',
      'Demostrativos: este, esta, estos, estas, esto',
      'Colores y ropa'
    ]
  },
  5: {
    title: 'Gente en forma',
    summary: 'Vocabulario de partes del cuerpo, deporte, hábitos de sueño y alimentación como TEMA LINGÜÍSTICO del libro; describir con qué frecuencia se hacen actividades cotidianas; usar, únicamente como práctica de la estructura gramatical del libro (no como consejo real), frases de ejemplo con "es bueno / es importante / hay que + infinitivo".',
    patterns: [
      'Presente de indicativo regular e irregular (dormir, hacer, ir, dar)',
      'Verbos reflexivos: levantarse, ponerse, relajarse, ducharse, vestirse',
      'Expresiones de frecuencia: siempre, muchas veces, frecuentemente, de vez en cuando, nunca',
      'Cuantificadores: poco, un poco, bastante, lo suficiente, mucho, demasiado',
      'Vocabulario de deportes y partes del cuerpo',
      'IMPORTANTE: estas estructuras de recomendación se practican solo como ejemplos gramaticales del libro (p. ej. "Es bueno dormir bien", como en el libro), nunca como consejo de salud real dirigido al estudiante.'
    ]
  },
  6: {
    title: 'Gente que come bien',
    summary: 'Vocabulario de alimentos y productos típicos de España y Latinoamérica; hablar de las características de un plato; pesos y medidas sencillos; pedir en un restaurante; los pasos muy simples de una receta.',
    patterns: [
      'Forma impersonal con "se": se come, se pone, se corta, se mezcla',
      'Cantidades: poco, un poco de, suficiente, mucho, demasiado, ningún/ninguna, nada de',
      'Pesos y medidas: un kilo de, un cuarto de kilo de, una botella de',
      'Para el restaurante: ¿Qué van a tomar? De primero.../De postre...; ¿Algo más? La cuenta, por favor',
      'Vocabulario de alimentos comunes en la cocina española y latinoamericana'
    ]
  }
};

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TTS_LANGUAGE_CODE = 'es-US';
const DEFAULT_TTS_VOICE_NAME = 'es-US-Neural2-B'; // Google Cloud TTS neutral male Latin American Spanish voice.
const DEFAULT_TTS_SPEAKING_RATE = 1.05; // slightly brisk — reads less flat/robotic than the 1.0 default
const DEFAULT_TTS_PITCH = 0;

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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

  const languageCode = env.GOOGLE_TTS_LANGUAGE_CODE || DEFAULT_TTS_LANGUAGE_CODE;
  const voiceName = env.GOOGLE_TTS_VOICE_NAME || DEFAULT_TTS_VOICE_NAME;
  const speakingRate = env.GOOGLE_TTS_SPEAKING_RATE ? Number(env.GOOGLE_TTS_SPEAKING_RATE) : DEFAULT_TTS_SPEAKING_RATE;
  const pitch = env.GOOGLE_TTS_PITCH ? Number(env.GOOGLE_TTS_PITCH) : DEFAULT_TTS_PITCH;

  const googleRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate, pitch }
      })
    }
  );

  if (!googleRes.ok) {
    const errText = await googleRes.text();
    return json({ error: 'Google TTS API error', detail: errText }, 502, env);
  }

  const data = await googleRes.json();
  const audioBytes = base64ToBytes(data.audioContent);

  return new Response(audioBytes, {
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
    if (url.pathname === '/api/debug' && request.method === 'GET') {
      // Temporary diagnostic — reveals only whether each secret is SET,
      // never the value. Safe to leave in, but fine to remove later.
      return json({
        hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
        hasGoogleTtsKey: Boolean(env.GOOGLE_TTS_API_KEY),
        hasAdminKey: Boolean(env.ADMIN_KEY),
        adminKeyLength: env.ADMIN_KEY ? env.ADMIN_KEY.length : 0,
        hasClassPasscode: Boolean(env.CLASS_PASSCODE),
        hasFeedbackKv: Boolean(env.FEEDBACK_KV)
      }, 200, env);
    }

    return json({ error: 'Not found' }, 404, env);
  }
};
