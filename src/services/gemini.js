const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');
const { parseAIResponse } = require('./parse-ai-response');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Get system prompt by content type
function getSystemPrompt(tipo) {
  const base = `Eres el Director Creativo de MagnetCreative. Tu trabajo es:
1. EVALUAR usando la rubrica punto por punto (NO inventar scores)
2. ENSENAR dando VERSION CORREGIDA de cada problema
3. Dar ALTERNATIVAS listas para copiar y usar

REGLA CRITICA DE SCORING:
- Evalua CADA criterio de la rubrica por separado (0-10 puntos cada uno)
- El score FINAL es la SUMA de todos los criterios
- Si un criterio tiene peso de 15 pts y cumple parcialmente, da 8/15
- MUESTRA el desglose en el resumen: "Impacto visual: 8/15, CTA: 12/15..."
- La misma imagen SIEMPRE debe dar el MISMO score si se evalua 2 veces
- NO redondees arbitrariamente. Sé preciso y consistente.

Responde SOLO con JSON valido sin markdown ni texto adicional.`;

  const schemas = {
    video: `${base}\n\nRUBRICA DE VIDEO (10 criterios, suma = score final):\n1. Hook primeros 3 segundos (10 pts): captura atencion inmediata\n2. Duracion optima para plataforma (10 pts): adecuada al formato\n3. CTA claro y visible (10 pts): accion directa, NO "conoce mas"\n4. Ritmo y edicion (10 pts): mantiene atencion, cortes dinamicos\n5. Coherencia con negocio/marca (10 pts): colores, tono, estilo correcto\n6. Calidad del concepto/story (10 pts): narrativa clara y persuasiva\n7. Texto en pantalla legible (10 pts): tamano, contraste, duracion\n8. Audio/musica apropiada (10 pts): complementa, no distrae\n9. Formato correcto plataforma (10 pts): dimensiones, orientacion\n10. Conexion emocional (10 pts): el publico se identifica\n\nCalcula: sumaPuntos = criterio1 + criterio2 + ... + criterio10\nEl score es sumaPuntos (0-100).\nSi score >= 70: veredicto = "aprobar". Si 40-69: "cambios". Si <40: "rechazar".\n\nPor cada problema, incluye la VERSION CORREGIDA en detalle de la recomendacion.\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio1: X/10, criterio2: X/10...]. Total: X/100. [2 oraciones de resumen]","duracion_detectada":"string","hook_presente":true/false,"hook_descripcion":"string","cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista con version corregida"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    imagen: `${base}\n\nRUBRICA DE IMAGEN (10 criterios, suma = score final):\n1. Impacto visual inmediato (10 pts): captura atencion en <1 segundo\n2. Jerarquia de informacion (10 pts): titulo > beneficio > CTA claramente ordenados\n3. Legibilidad del texto (10 pts): tamano, contraste, fuente legible en mobile\n4. Paleta de colores (10 pts): coherente con marca, contraste efectivo\n5. CTA visible y claro (10 pts): accion directa, NO "conoce mas"\n6. Coherencia con marca/negocio (10 pts): colores, tono, estilo correcto\n7. Formato plataforma (10 pts): dimensiones correctas, <20% texto para Meta\n8. Guidelines Meta Ads (10 pts): no misleading, no texto excesivo\n9. Calidad profesional (10 pts): sin pixelacion, sin marcas de agua\n10. Conexion emocional (10 pts): el publico se identifica\n\nCalcula: sumaPuntos = criterio1 + criterio2 + ... + criterio10\nEl score es sumaPuntos (0-100).\nSi score >= 70: veredicto = "aprobar". Si 40-69: "cambios". Si <40: "rechazar".\n\nPor cada problema, incluye la VERSION CORREGIDA en detalle de la recomendacion.\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio1: X/10, criterio2: X/10...]. Total: X/100. [2 oraciones de resumen]","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista con version corregida"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    email: `${base}\n\nRUBRICA DE EMAIL (10 criterios, suma = score final):\n1. Linea de asunto (10 pts): genera curiosidad, <50 chars, no spam\n2. Estructura (10 pts): header, body, CTA, footer claros\n3. Copy persuasivo (10 pts): natural, no robot, emotional\n4. CTA claro (10 pts): visible, directo, con urgencia\n5. Personalizacion (10 pts): nombre, contexto, segmentacion\n6. Longitud (10 pts): apropiada, escaneable\n7. Mobile-friendly (10 pts): parrafos cortos, botones grandes\n8. Compliance CAN-SPAM (10 pts): unsubscribe, direccion\n9. Tono de marca (10 pts): coherente con negocio\n10. Valor para el lector (10 pts): aporta, no solo vende\n\nPor cada problema, reescribe la seccion corregida.\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio1: X/10...]. Total: X/100. [resumen]","asunto_efectivo":true/false,"estructura_clara":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    presentacion: `${base}\n\nRUBRICA DE PRESENTACION (10 criterios, suma = score final):\n1. Primer slide impactante (10 pts)\n2. Diseno visual consistente (10 pts)\n3. Texto conciso por slide (10 pts)\n4. Flujo logico (10 pts)\n5. Branding consistente (10 pts)\n6. CTA final claro (10 pts)\n7. Imagenes/graficos efectivos (10 pts)\n8. Legibilidad (10 pts)\n9. Storytelling/narrativa (10 pts)\n10. Profesionalismo (10 pts)\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio: X/10...]. Total: X/100. [resumen]","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    plantilla: `${base}\n\nRUBRICA DE PLANTILLA (10 criterios, suma = score final):\n1. Impacto visual (10 pts)\n2. Jerarquia de informacion (10 pts)\n3. Texto legible y conciso (10 pts)\n4. Paleta profesional (10 pts)\n5. CTA claro (10 pts)\n6. Balance texto/imagen (10 pts)\n7. Calidad de imagenes (10 pts)\n8. Adaptabilidad (10 pts)\n9. Contacto visible (10 pts)\n10. Credibilidad/profesionalismo (10 pts)\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio: X/10...]. Total: X/100. [resumen]","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
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
    ? '\n\nIMPORTANT: Respond ALL text fields (resumen, fortalezas, problemas, recomendaciones) in ENGLISH.'
    : '\n\nIMPORTANTE: Responde TODOS los campos de texto (resumen, fortalezas, problemas, recomendaciones) en ESPANOL.';

  let userContext = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userContext += `- Descripcion: ${submission.descripcion}\n`;
  userContext += knowledgeContext;
  if (submission._platformContext) userContext += submission._platformContext;
  userContext += langInstruction;
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
  // Use gemini-2.5-flash for all analysis
  const model = 'gemini-2.5-flash';
  console.log(`[Gemini] Analyzing: ${submission.titulo} (${tipo}), model: ${model}, URI: ${submission.gemini_file_uri || 'none'}`);

  const generationConfig = { temperature: 0.3, maxOutputTokens: 8192 };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
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
