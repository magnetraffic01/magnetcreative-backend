const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');
const { parseAIResponse } = require('./parse-ai-response');

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

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

  const jsonFormat = '{"score":0-100,"resumen":"Desglose: [criterio: X/peso...]. Total: X/100. [2 oraciones resumen]","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","hook_presente":true/false,"hook_descripcion":"string","fortalezas":["lista"],"problemas":["lista con VERSION CORREGIDA"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}';

  const schemas = {
    imagen: `${base}\n\nUsa la RUBRICA DE IMAGEN del contexto (con pesos especificos por criterio). NO uses otra rubrica.\nPor cada problema, da VERSION CORREGIDA.\n\nJSON: ${jsonFormat}`,

    email: `${base}\n\nUsa la RUBRICA DE EMAIL del contexto. NO uses otra rubrica.\nPor cada problema, reescribe la seccion.\n\nJSON: ${jsonFormat}`,

    presentacion: `${base}\n\nUsa la RUBRICA DE PRESENTACION del contexto. NO uses otra rubrica.\n\nJSON: ${jsonFormat}`,

    plantilla: `${base}\n\nUsa la RUBRICA DE IMAGEN del contexto (plantillas se evaluan igual que imagenes). NO uses otra rubrica.\n\nJSON: ${jsonFormat}`
  };

  return schemas[tipo] || schemas.imagen;
}

// Analyze image with Claude (base64)
async function analyzeWithClaude(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const systemPrompt = getSystemPrompt(tipo);

  const knowledgeContext = await buildKnowledgeContext(submission, submission._dbPool);

  const lang = submission.lang || 'es';
  const langInstruction = lang === 'en'
    ? '\n\nCRITICAL LANGUAGE RULE: You MUST write ALL text values in the JSON response in ENGLISH. This includes: resumen, every item in fortalezas array, every item in problemas array, every detalle in recomendaciones, cta_descripcion, hook_descripcion. The rubric criteria names are in Spanish but your RESPONSE must be in ENGLISH. Do NOT mix languages.'
    : '\n\nREGLA DE IDIOMA: Responde TODOS los campos de texto del JSON en ESPANOL.';

  let userText = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userText += `- Descripcion: ${submission.descripcion}\n`;
  userText += knowledgeContext;
  if (submission._platformContext) userText += submission._platformContext;
  userText += langInstruction;
  userText += '\nEvalua este creativo y genera tu evaluacion completa. Verifica que las dimensiones y formato sean correctos para la plataforma destino.';

  let content;

  if (tipo === 'email') {
    // Text-only for emails
    content = [{
      type: 'text',
      text: `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n\nEvalua este correo y genera tu evaluacion.`
    }];
  } else if (imageBase64) {
    // Detect if PDF/document or image
    const isPdf = imageMimeType === 'application/pdf';
    const contentType = isPdf ? 'document' : 'image';
    content = [
      {
        type: contentType,
        source: {
          type: 'base64',
          media_type: imageMimeType || 'image/jpeg',
          data: imageBase64
        }
      },
      { type: 'text', text: userText }
    ];
  } else {
    content = [{ type: 'text', text: userText }];
  }

  console.log(`[Claude] Analyzing: ${submission.titulo} (${tipo})`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (data.error) {
    console.error(`[Claude] API Error:`, JSON.stringify(data.error).substring(0, 500));
    throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = data.content?.[0]?.text || '';
  console.log(`[Claude] Response length: ${text.length}, first 200: ${text.substring(0, 200)}`);

  const parsed = parseAIResponse(text, 'Claude');

  console.log(`[Claude] Result: score=${parsed.score}, veredicto=${parsed.veredicto}, fortalezas=${(parsed.fortalezas || []).length}, problemas=${(parsed.problemas || []).length}`);
  return parsed;
}

module.exports = { analyzeWithClaude };
