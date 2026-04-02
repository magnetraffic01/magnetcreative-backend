const config = require('../config');
const { analyzeWithClaude } = require('./claude');
const { analyzeContent: analyzeWithGemini } = require('./gemini');
const { parseAIResponse } = require('./parse-ai-response');

// Simple circuit breaker for AI providers
const circuitState = {
  claude: { failures: 0, lastFailure: 0, open: false },
  openai: { failures: 0, lastFailure: 0, open: false },
  gemini: { failures: 0, lastFailure: 0, open: false }
};
const CIRCUIT_THRESHOLD = 3; // failures before opening
const CIRCUIT_RESET_MS = 60000; // 1 min cooldown
const AI_CALL_TIMEOUT_MS = 60000; // 60s timeout per AI call

function isCircuitOpen(provider) {
  const state = circuitState[provider];
  if (!state.open) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(provider) {
  const state = circuitState[provider];
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    console.warn(`[CircuitBreaker] ${provider} circuit OPEN after ${state.failures} failures`);
  }
}

function recordSuccess(provider) {
  circuitState[provider].failures = 0;
  circuitState[provider].open = false;
}

function allCircuitsOpen() {
  return isCircuitOpen('claude') && isCircuitOpen('openai') && isCircuitOpen('gemini');
}

function gracefulFallbackResponse() {
  return {
    score: null,
    resumen: 'Todos los servicios de IA están temporalmente no disponibles. Tu creativo ha sido guardado y será analizado automáticamente cuando el servicio se restaure.',
    veredicto: 'pendiente',
    fortalezas: [],
    problemas: [],
    recomendaciones: [],
    ai_uso_recomendado: null
  };
}

// Wraps an async AI call with a timeout
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms))
  ]);
}

const PLATFORM_SPECS = {
  Facebook: {
    feed: '1080x1080 (1:1) o 1200x628 (1.91:1)',
    stories: '1080x1920 (9:16)',
    reels: '1080x1920 (9:16)',
    video_feed: 'Min 1280x720, max 60min, ratio 16:9 o 1:1',
    video_reels: '1080x1920 (9:16), max 90s',
    carousel: '1080x1080 (1:1), 2-10 cards',
    text_max: '125 chars primario, 40 chars titulo',
  },
  Instagram: {
    feed: '1080x1080 (1:1), 1080x1350 (4:5), 1080x566 (1.91:1)',
    stories: '1080x1920 (9:16)',
    reels: '1080x1920 (9:16), max 90s',
    carousel: '1080x1080 (1:1), 2-10 slides',
    texto_max: '2200 chars caption, primeros 125 visibles',
  },
  TikTok: {
    video: '1080x1920 (9:16), 15s-10min',
    imagen: '1080x1920 (9:16)',
    texto_max: '2200 chars',
  },
  Email: {
    ancho: '600px max para compatibilidad',
    imagenes: 'Max 200KB por imagen, formato JPG/PNG',
    texto: 'Subject max 50 chars, preheader 85-100 chars',
  },
  Otro: { general: 'Verificar specs de la plataforma destino' },
};

function getPlatformContext(plataforma) {
  const specs = PLATFORM_SPECS[plataforma] || PLATFORM_SPECS['Otro'];
  let context = `\n\nESPECIFICACIONES DE PLATAFORMA (${plataforma}):\n`;
  for (const [key, value] of Object.entries(specs)) {
    context += `- ${key}: ${value}\n`;
  }
  context += `\nEvalua si las dimensiones y formato son correctos para ${plataforma}.\n`;
  return context;
}

// ROUTING RULES:
// 1. Videos -> Gemini (only AI that can see video via file URI)
// 2. Images/Docs/Templates WITH base64 -> Claude (primary) -> OpenAI (fallback)
// 3. Emails (text) -> Claude -> OpenAI -> Gemini
// 4. Files with Gemini URI but no base64 -> Gemini (already uploaded there)

async function analyzeSubmission(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  submission._platformContext = getPlatformContext(submission.plataforma || 'Facebook');

  console.log(`[AI Router] tipo=${tipo}, hasBase64=${!!imageBase64}, hasGeminiURI=${!!submission.gemini_file_uri}`);

  // If all circuits are open, return graceful fallback immediately
  if (allCircuitsOpen()) {
    console.warn('[AI Router] All circuits open - returning graceful fallback');
    return gracefulFallbackResponse();
  }

  // ===== RULE 1: Videos & Presentations -> Gemini =====
  if (tipo === 'video' || (tipo === 'presentacion' && submission.gemini_file_uri)) {
    if (!isCircuitOpen('gemini')) {
      try {
        console.log(`[AI Router] ${tipo} -> Gemini`);
        const result = await withTimeout(analyzeWithGemini(submission), AI_CALL_TIMEOUT_MS);
        recordSuccess('gemini');
        return result;
      } catch (err) {
        console.error(`[AI Router] Gemini failed: ${err.message}`);
        recordFailure('gemini');
      }
    } else {
      console.warn(`[AI Router] Gemini circuit open, skipping for ${tipo}`);
    }
  }

  // ===== RULE 2: Non-video WITH base64 -> Claude (Anthropic) =====
  if (imageBase64) {
    // Try Claude first
    if (config.claudeApiKey && !isCircuitOpen('claude')) {
      try {
        console.log(`[AI Router] ${tipo} + base64 -> Claude (Anthropic)`);
        const result = await withTimeout(analyzeWithClaude(submission, imageBase64, imageMimeType), AI_CALL_TIMEOUT_MS);
        recordSuccess('claude');
        return result;
      } catch (err) {
        console.error(`[AI Router] Claude failed: ${err.message}`);
        recordFailure('claude');
      }
    } else if (isCircuitOpen('claude')) {
      console.warn(`[AI Router] Claude circuit open, skipping`);
    }
    // Fallback to OpenAI
    if (config.openaiApiKey && !isCircuitOpen('openai')) {
      try {
        console.log(`[AI Router] ${tipo} + base64 -> OpenAI (fallback)`);
        const result = await withTimeout(analyzeWithOpenAI(submission, imageBase64, imageMimeType), AI_CALL_TIMEOUT_MS);
        recordSuccess('openai');
        return result;
      } catch (err) {
        console.error(`[AI Router] OpenAI failed: ${err.message}`);
        recordFailure('openai');
      }
    } else if (isCircuitOpen('openai')) {
      console.warn(`[AI Router] OpenAI circuit open, skipping`);
    }
  }

  // ===== RULE 3: Emails -> Claude -> OpenAI -> Gemini =====
  if (tipo === 'email') {
    if (config.claudeApiKey && !isCircuitOpen('claude')) {
      try {
        console.log(`[AI Router] email -> Claude`);
        const result = await withTimeout(analyzeWithClaude(submission, null, null), AI_CALL_TIMEOUT_MS);
        recordSuccess('claude');
        return result;
      } catch (err) {
        console.error(`[AI Router] Claude email failed: ${err.message}`);
        recordFailure('claude');
      }
    } else if (isCircuitOpen('claude')) {
      console.warn(`[AI Router] Claude circuit open, skipping email`);
    }
    if (config.openaiApiKey && !isCircuitOpen('openai')) {
      try {
        console.log(`[AI Router] email -> OpenAI`);
        const result = await withTimeout(analyzeWithOpenAI(submission, null, null), AI_CALL_TIMEOUT_MS);
        recordSuccess('openai');
        return result;
      } catch (err) {
        console.error(`[AI Router] OpenAI email failed: ${err.message}`);
        recordFailure('openai');
      }
    } else if (isCircuitOpen('openai')) {
      console.warn(`[AI Router] OpenAI circuit open, skipping email`);
    }
  }

  // ===== RULE 4: Has Gemini URI but no base64 -> Gemini =====
  if (submission.gemini_file_uri && !isCircuitOpen('gemini')) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini (file URI, no base64)`);
      const result = await withTimeout(analyzeWithGemini(submission), AI_CALL_TIMEOUT_MS);
      recordSuccess('gemini');
      return result;
    } catch (err) {
      console.error(`[AI Router] Gemini with file failed: ${err.message}`);
      recordFailure('gemini');
    }
  } else if (submission.gemini_file_uri && isCircuitOpen('gemini')) {
    console.warn(`[AI Router] Gemini circuit open, skipping file URI`);
  }

  // ===== LAST RESORT: Gemini text-only =====
  if (config.geminiApiKey && !isCircuitOpen('gemini')) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini text-only (last resort)`);
      const result = await withTimeout(analyzeWithGemini({ ...submission, gemini_file_uri: null }), AI_CALL_TIMEOUT_MS);
      recordSuccess('gemini');
      return result;
    } catch (err) {
      console.error(`[AI Router] Gemini text-only failed: ${err.message}`);
      recordFailure('gemini');
    }
  } else if (isCircuitOpen('gemini')) {
    console.warn(`[AI Router] Gemini circuit open, skipping text-only last resort`);
  }

  // If we get here after exhausting all providers, check if circuits caused it
  if (allCircuitsOpen()) {
    console.warn('[AI Router] All circuits now open - returning graceful fallback');
    return gracefulFallbackResponse();
  }

  throw new Error('Todos los proveedores de IA fallaron.');
}

// OpenAI fallback - uses SAME knowledge base and rubrics as Claude/Gemini
async function analyzeWithOpenAI(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const { buildKnowledgeContext } = require('./knowledge-base');

  const knowledgeContext = await buildKnowledgeContext(submission, submission._dbPool);

  const lang = submission.lang || 'es';
  const langInstruction = lang === 'en'
    ? '\nCRITICAL LANGUAGE RULE: You MUST write ALL text values in ENGLISH. The rubric is in Spanish but your RESPONSE must be in ENGLISH. Do NOT mix languages.'
    : '\nREGLA DE IDIOMA: Responde TODOS los campos de texto en ESPANOL.';

  const systemPrompt = `Eres el Director Creativo de MagnetCreative. Tu trabajo es:
1. EVALUAR usando UNICAMENTE la rubrica que viene en el CONTEXTO (NO inventes tu propia rubrica)
2. ENSENAR dando VERSION CORREGIDA de cada problema
3. Dar ALTERNATIVAS listas para copiar y usar

REGLA CRITICA DE SCORING:
- La rubrica con los criterios y sus PESOS viene en el contexto del mensaje
- Evalua CADA criterio por separado usando el peso que indica la rubrica
- El score FINAL es la SUMA de todos los criterios con sus pesos
- MUESTRA el desglose: "Scroll-stopping: 14/18, StoryBrand: 10/15, CTA: 8/12..."
- La misma pieza SIEMPRE debe dar el MISMO score
- Si score >= 70: veredicto = "aprobar". Si 40-69: "cambios". Si <40: "rechazar"

Responde SOLO con JSON valido sin markdown ni texto adicional.
JSON: {"score":0-100,"resumen":"Desglose: [criterio: X/peso...]. Total: X/100. [2 oraciones resumen]","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","hook_presente":true/false,"hook_descripcion":"string","fortalezas":["lista"],"problemas":["lista con VERSION CORREGIDA"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`;

  let userText = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n`;
  if (submission.descripcion) userText += `- Descripcion: ${submission.descripcion}\n`;
  userText += knowledgeContext;
  userText += langInstruction;
  userText += '\nEvalua este creativo usando la rubrica del contexto.';

  let messages;
  if (tipo === 'email' || tipo === 'sms' || tipo === 'whatsapp') {
    messages = [{ role: 'user', content: `CONTENIDO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Contenido:\n${submission.contenido_email}\n${knowledgeContext}${langInstruction}\n\nEvalua usando la rubrica del contexto.` }];
  } else if (imageBase64) {
    messages = [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` } },
      { type: 'text', text: userText }
    ]}];
  } else {
    messages = [{ role: 'user', content: userText }];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, ...messages], max_tokens: 4000, temperature: 0.3 }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();
  if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
  const text = data.choices?.[0]?.message?.content || '';
  const parsed = parseAIResponse(text, 'OpenAI');
  console.log(`[OpenAI] score=${parsed.score}, veredicto=${parsed.veredicto}`);
  return parsed;
}

module.exports = { analyzeSubmission };
