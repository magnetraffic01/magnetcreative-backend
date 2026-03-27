const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');
const { parseAIResponse } = require('./parse-ai-response');

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

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
    imagen: `${base}\n\nRUBRICA DE IMAGEN (10 criterios, suma = score final):\n1. Impacto visual inmediato (10 pts): captura atencion en <1 segundo\n2. Jerarquia de informacion (10 pts): titulo > beneficio > CTA claramente ordenados\n3. Legibilidad del texto (10 pts): tamano, contraste, fuente legible en mobile\n4. Paleta de colores (10 pts): coherente con marca, contraste efectivo\n5. CTA visible y claro (10 pts): accion directa, NO "conoce mas"\n6. Coherencia con marca/negocio (10 pts): colores, tono, estilo correcto\n7. Formato plataforma (10 pts): dimensiones correctas, <20% texto para Meta\n8. Guidelines Meta Ads (10 pts): no misleading, no texto excesivo\n9. Calidad profesional (10 pts): sin pixelacion, sin marcas de agua\n10. Conexion emocional (10 pts): el publico se identifica\n\nCalcula: sumaPuntos = criterio1 + criterio2 + ... + criterio10\nEl score es sumaPuntos (0-100).\nSi score >= 70: veredicto = "aprobar". Si 40-69: "cambios". Si <40: "rechazar".\n\nPor cada problema, incluye la VERSION CORREGIDA en detalle de la recomendacion.\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio1: X/10, criterio2: X/10...]. Total: X/100. [2 oraciones de resumen]","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista con version corregida"],"recomendaciones":[{"area":"string","detalle":"problema + VERSION CORREGIDA lista para usar","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    email: `${base}\n\nRUBRICA DE EMAIL (10 criterios, suma = score final):\n1. Linea de asunto (10 pts): genera curiosidad, <50 chars, no spam\n2. Estructura (10 pts): header, body, CTA, footer claros\n3. Copy persuasivo (10 pts): natural, no robot, emotional\n4. CTA claro (10 pts): visible, directo, con urgencia\n5. Personalizacion (10 pts): nombre, contexto, segmentacion\n6. Longitud (10 pts): apropiada, escaneable\n7. Mobile-friendly (10 pts): parrafos cortos, botones grandes\n8. Compliance CAN-SPAM (10 pts): unsubscribe, direccion\n9. Tono de marca (10 pts): coherente con negocio\n10. Valor para el lector (10 pts): aporta, no solo vende\n\nPor cada problema, reescribe la seccion corregida.\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio1: X/10...]. Total: X/100. [resumen]","asunto_efectivo":true/false,"estructura_clara":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    presentacion: `${base}\n\nRUBRICA DE PRESENTACION (10 criterios, suma = score final):\n1. Primer slide impactante (10 pts)\n2. Diseno visual consistente (10 pts)\n3. Texto conciso por slide (10 pts)\n4. Flujo logico (10 pts)\n5. Branding consistente (10 pts)\n6. CTA final claro (10 pts)\n7. Imagenes/graficos efectivos (10 pts)\n8. Legibilidad (10 pts)\n9. Storytelling/narrativa (10 pts)\n10. Profesionalismo (10 pts)\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio: X/10...]. Total: X/100. [resumen]","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    plantilla: `${base}\n\nRUBRICA DE PLANTILLA (10 criterios, suma = score final):\n1. Impacto visual (10 pts)\n2. Jerarquia de informacion (10 pts)\n3. Texto legible y conciso (10 pts)\n4. Paleta profesional (10 pts)\n5. CTA claro (10 pts)\n6. Balance texto/imagen (10 pts)\n7. Calidad de imagenes (10 pts)\n8. Adaptabilidad (10 pts)\n9. Contacto visible (10 pts)\n10. Credibilidad/profesionalismo (10 pts)\n\nJSON: {"score":0-100,"resumen":"Desglose: [criterio: X/10...]. Total: X/100. [resumen]","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista con correccion"],"recomendaciones":[{"area":"string","detalle":"problema + CORRECCION","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
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
    ? '\n\nIMPORTANT: Respond ALL text fields (resumen, fortalezas, problemas, recomendaciones, veredicto descriptions) in ENGLISH.'
    : '\n\nIMPORTANTE: Responde TODOS los campos de texto (resumen, fortalezas, problemas, recomendaciones, descripciones) en ESPANOL.';

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
