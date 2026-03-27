const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');
const { parseAIResponse } = require('./parse-ai-response');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Get system prompt by content type
function getSystemPrompt(tipo) {
  const base = `Eres el Director Creativo de MagnetCreative. Tu trabajo es:
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

Responde SOLO con JSON valido sin markdown ni texto adicional.`;

  const jsonFormat = '{"score":0-100,"resumen":"Desglose: [criterio: X/peso...]. Total: X/100. [2 oraciones resumen]","duracion_detectada":"string","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","hook_presente":true/false,"hook_descripcion":"string","fortalezas":["lista"],"problemas":["lista con VERSION CORREGIDA"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}';

  const schemas = {
    video: `${base}\n\nUsa la RUBRICA DE VIDEO del contexto. NO uses otra rubrica.\nPor cada problema, da VERSION CORREGIDA.\n\nJSON: ${jsonFormat}`,

    imagen: `${base}\n\nUsa la RUBRICA DE IMAGEN del contexto (con pesos especificos por criterio). NO uses otra rubrica.\nPor cada problema, da VERSION CORREGIDA.\n\nJSON: ${jsonFormat}`,

    email: `${base}\n\nUsa la RUBRICA DE EMAIL del contexto. NO uses otra rubrica.\nPor cada problema, reescribe la seccion.\n\nJSON: ${jsonFormat}`,

    presentacion: `${base}\n\nUsa la RUBRICA DE PRESENTACION del contexto. NO uses otra rubrica.\n\nJSON: ${jsonFormat}`,

    plantilla: `${base}\n\nUsa la RUBRICA DE IMAGEN del contexto (plantillas se evaluan igual). NO uses otra rubrica.\n\nJSON: ${jsonFormat}`
  };

  return schemas[tipo] || schemas.imagen;
}

// Analyze content with Gemini using a file already uploaded (URI from frontend)
async function analyzeContent(submission) {
  const tipo = submission.tipo;
  const systemPrompt = getSystemPrompt(tipo);

  const knowledgeContext = await buildKnowledgeContext(submission, submission._dbPool);

  const lang = submission.lang || 'es';
  const langInstruction = lang === 'en'
    ? '\n\nCRITICAL LANGUAGE RULE: You MUST write ALL text values in the JSON response in ENGLISH. This includes: resumen, every item in fortalezas array, every item in problemas array, every detalle in recomendaciones. The rubric is in Spanish but your RESPONSE must be in ENGLISH. Do NOT mix languages.'
    : '\n\nREGLA DE IDIOMA: Responde TODOS los campos de texto del JSON en ESPANOL.';

  let userContext = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userContext += `- Descripcion: ${submission.descripcion}\n`;
  userContext += knowledgeContext;
  if (submission._platformContext) userContext += submission._platformContext;
  userContext += langInstruction;
  userContext += '\nEvalua este creativo y genera tu evaluacion completa. Verifica dimensiones y formato para la plataforma.';

  let contents;

  if (tipo === 'email' || tipo === 'sms' || tipo === 'whatsapp') {
    // Text-based content: keep knowledge context and lang instruction
    userContext = `CONTENIDO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Contenido:\n${submission.contenido_email}\n\n${knowledgeContext}${langInstruction}\n\nEvalua usando la rubrica del contexto.`;
    contents = [{ role: 'user', parts: [{ text: userContext }] }];
  } else if (submission.gemini_file_uri) {
    const mimeTypes = {
      video: 'video/mp4', imagen: 'image/jpeg',
      presentacion: 'application/pdf', plantilla: 'image/jpeg'
    };
    contents = [{
      role: 'user',
      parts: [
        { fileData: { mimeType: mimeTypes[tipo] || 'image/jpeg', fileUri: submission.gemini_file_uri } },
        { text: userContext }
      ]
    }];
  } else {
    contents = [{ role: 'user', parts: [{ text: userContext }] }];
  }

  const hasFile = !!submission.gemini_file_uri && tipo !== 'email';
  // Use gemini-2.5-flash for all analysis
  const model = 'gemini-2.5-flash';
  console.log(`[Gemini] Analyzing: ${submission.titulo} (${tipo}), model: ${model}, URI: ${submission.gemini_file_uri || 'none'}`);

  const generationConfig = { temperature: 0.3, maxOutputTokens: 8192 };

  const controller = new AbortController();
  const timeoutMs = tipo === 'video' ? 120000 : 60000; // 120s for video, 60s for others
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${GEMINI_URL}/models/${model}:generateContent?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (data.error) {
    console.error(`[Gemini] API Error:`, JSON.stringify(data.error).substring(0, 500));
    throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // Extract text from all parts (skip thought parts from thinking mode)
  const parts = data.candidates?.[0]?.content?.parts || [];
  const allText = parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n');
  // Fallback: if no non-thought parts, try any text part
  const text = allText || parts.filter(p => p.text).map(p => p.text).join('\n') || '';
  console.log(`[Gemini] Response parts: ${parts.length}, text length: ${text.length}, first 300: ${text.substring(0, 300)}`);

  if (!text) {
    console.error(`[Gemini] Empty response. Full data:`, JSON.stringify(data).substring(0, 1000));
    throw new Error('Gemini returned empty response');
  }

  const parsed = parseAIResponse(text, 'Gemini');

  console.log(`[Gemini] Result: score=${parsed.score}, veredicto=${parsed.veredicto}, fortalezas=${(parsed.fortalezas||[]).length}, problemas=${(parsed.problemas||[]).length}`);
  return parsed;
}

// Return Gemini API key for frontend upload
function getApiKey() {
  return config.geminiApiKey;
}

module.exports = { analyzeContent, getApiKey };
