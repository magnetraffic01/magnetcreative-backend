const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Get system prompt by content type
function getSystemPrompt(tipo) {
  const base = 'Eres el Director Creativo de MagnetCreative, el sistema de evaluacion de creativos de MagneTraffic. Evaluas contenido creativo para campanas digitales.\n\nResponde SOLO con JSON valido sin markdown ni texto adicional.';

  const schemas = {
    video: `${base}\n\nEvalua videos:\n1. Duracion optima (15-30s ads, <60s reels)\n2. Hook en primeros 3 segundos\n3. CTA claro y visible\n4. Ritmo y edicion\n5. Coherencia con el negocio\n6. Calidad del concepto\n7. Texto en pantalla legible\n8. Audio/musica apropiada\n\nJSON: {"score":0-100,"resumen":"2 oraciones","duracion_detectada":"string","hook_presente":true/false,"hook_descripcion":"string","cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    imagen: `${base}\n\nEvalua imagenes/disenos:\n1. Impacto visual inmediato\n2. Jerarquia de informacion\n3. Legibilidad del texto\n4. Contraste y colores\n5. CTA visible\n6. Coherencia con marca\n7. Formato correcto para plataforma\n8. Cumple guidelines de Meta Ads\n\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    email: `${base}\n\nEvalua correos de email marketing:\n1. Linea de asunto efectiva\n2. Estructura clara (header, body, CTA)\n3. Copy persuasivo sin ser spam\n4. CTA visible y claro\n5. Personalizacion\n6. Longitud apropiada\n7. Mobile-friendly\n8. Cumple CAN-SPAM\n\nJSON: {"score":0-100,"resumen":"2 oraciones","asunto_efectivo":true/false,"estructura_clara":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    presentacion: `${base}\n\nEvalua presentaciones/slides:\n1. Claridad del mensaje por slide\n2. Diseno visual consistente\n3. Texto conciso (no parrafos largos)\n4. Flujo logico de informacion\n5. Branding consistente\n6. Impacto del primer slide\n7. CTA en slide final\n\nJSON: {"score":0-100,"resumen":"2 oraciones","slides_detectados":"string","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    plantilla: `${base}\n\nEvalua plantillas/flyers:\n1. Impacto visual\n2. Jerarquia de informacion\n3. Texto legible y conciso\n4. Colores y branding\n5. CTA claro\n6. Adaptable a multiples usos\n\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };

  return schemas[tipo] || schemas.imagen;
}

// Analyze content with Gemini using a file already uploaded (URI from frontend)
async function analyzeContent(submission) {
  const tipo = submission.tipo;
  const systemPrompt = getSystemPrompt(tipo);

  const knowledgeContext = await buildKnowledgeContext(submission, submission._dbPool);

  let userContext = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userContext += `- Descripcion: ${submission.descripcion}\n`;
  userContext += knowledgeContext;
  if (submission._platformContext) userContext += submission._platformContext;
  userContext += '\nEvalua este creativo y genera tu evaluacion completa. Verifica dimensiones y formato para la plataforma.';

  let contents;

  if (tipo === 'email') {
    userContext = `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n\nEvalua este correo y genera tu evaluacion.`;
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
  // Use gemini-2.0-flash for file analysis (more stable), 2.5-flash for text-only
  const model = hasFile ? 'gemini-2.0-flash' : 'gemini-2.5-flash';
  console.log(`[Gemini] Analyzing: ${submission.titulo} (${tipo}), model: ${model}, URI: ${submission.gemini_file_uri || 'none'}`);

  const generationConfig = { temperature: 0.3, maxOutputTokens: 4000 };
  if (!hasFile) {
    generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  }

  const response = await fetch(`${GEMINI_URL}/models/${model}:generateContent?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error(`[Gemini] API Error:`, JSON.stringify(data.error).substring(0, 500));
    throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';
  console.log(`[Gemini] Response text length: ${text.length}`);

  if (!text) {
    console.error(`[Gemini] Empty response. Full data:`, JSON.stringify(data).substring(0, 1000));
    throw new Error('Gemini returned empty response');
  }

  let parsed = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (parseErr) {
    console.error(`[Gemini] Parse error: ${parseErr.message}. Text: ${text.substring(0, 300)}`);
    parsed = { score: 50, resumen: text.substring(0, 500), fortalezas: [], problemas: ['Error parsing AI response'], recomendaciones: [], veredicto: 'cambios' };
  }

  console.log(`[Gemini] Result: score=${parsed.score}, veredicto=${parsed.veredicto}`);
  return parsed;
}

// Return Gemini API key for frontend upload
function getApiKey() {
  return config.geminiApiKey;
}

module.exports = { analyzeContent, getApiKey };
