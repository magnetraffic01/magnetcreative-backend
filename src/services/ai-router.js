const config = require('../config');
const { analyzeWithClaude } = require('./claude');
const { analyzeContent: analyzeWithGemini } = require('./gemini');
const { parseAIResponse } = require('./parse-ai-response');

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

  // ===== RULE 1: Videos & Presentations -> Gemini =====
  if (tipo === 'video' || (tipo === 'presentacion' && submission.gemini_file_uri)) {
    console.log(`[AI Router] ${tipo} -> Gemini`);
    return await analyzeWithGemini(submission);
  }

  // ===== RULE 2: Non-video WITH base64 -> Claude (Anthropic) =====
  if (imageBase64) {
    // Try Claude first
    if (config.claudeApiKey) {
      try {
        console.log(`[AI Router] ${tipo} + base64 -> Claude (Anthropic)`);
        return await analyzeWithClaude(submission, imageBase64, imageMimeType);
      } catch (err) {
        console.error(`[AI Router] Claude failed: ${err.message}`);
      }
    }
    // Fallback to OpenAI
    if (config.openaiApiKey) {
      try {
        console.log(`[AI Router] ${tipo} + base64 -> OpenAI (fallback)`);
        return await analyzeWithOpenAI(submission, imageBase64, imageMimeType);
      } catch (err) {
        console.error(`[AI Router] OpenAI failed: ${err.message}`);
      }
    }
  }

  // ===== RULE 3: Emails -> Claude -> OpenAI -> Gemini =====
  if (tipo === 'email') {
    if (config.claudeApiKey) {
      try {
        console.log(`[AI Router] email -> Claude`);
        return await analyzeWithClaude(submission, null, null);
      } catch (err) { console.error(`[AI Router] Claude email failed: ${err.message}`); }
    }
    if (config.openaiApiKey) {
      try {
        console.log(`[AI Router] email -> OpenAI`);
        return await analyzeWithOpenAI(submission, null, null);
      } catch (err) { console.error(`[AI Router] OpenAI email failed: ${err.message}`); }
    }
  }

  // ===== RULE 4: Has Gemini URI but no base64 -> Gemini =====
  if (submission.gemini_file_uri) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini (file URI, no base64)`);
      return await analyzeWithGemini(submission);
    } catch (err) {
      console.error(`[AI Router] Gemini with file failed: ${err.message}`);
    }
  }

  // ===== LAST RESORT: Gemini text-only =====
  if (config.geminiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini text-only (last resort)`);
      return await analyzeWithGemini({ ...submission, gemini_file_uri: null });
    } catch (err) {
      console.error(`[AI Router] Gemini text-only failed: ${err.message}`);
    }
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
- La rubrica con los criterios y sus PESOS viene en el contexto
- Evalua CADA criterio por separado usando el peso que indica la rubrica
- El score FINAL es la SUMA de todos los criterios con sus pesos
- MUESTRA el desglose en el resumen
- Si score >= 70: veredicto = "aprobar". Si 40-69: "cambios". Si <40: "rechazar"

Responde SOLO con JSON valido sin markdown.
JSON: {"score":0-100,"resumen":"Desglose: [criterio: X/peso...]. Total: X/100.","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"","hook_presente":true/false,"hook_descripcion":"","fortalezas":[""],"problemas":["con VERSION CORREGIDA"],"recomendaciones":[{"area":"","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`;

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
