const config = require('../config');
const { buildKnowledgeContext } = require('./knowledge-base');

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

// Get system prompt by content type
function getSystemPrompt(tipo) {
  const base = 'Eres el Director Creativo de MagnetCreative, el sistema de evaluacion de creativos de MagneTraffic. Evaluas contenido creativo para campanas digitales.\n\nResponde SOLO con JSON valido sin markdown ni texto adicional.';

  const schemas = {
    imagen: `${base}\n\nEvalua imagenes/disenos para Meta Ads:\n1. Impacto visual inmediato - captura atencion en menos de 1 segundo\n2. Jerarquia de informacion clara\n3. Legibilidad del texto (tamano, contraste, fuente)\n4. Contraste y paleta de colores efectiva\n5. CTA visible y claro\n6. Coherencia con la marca y el negocio\n7. Formato correcto para la plataforma destino\n8. Cumple guidelines de Meta Ads (poco texto, no misleading)\n9. Calidad profesional de la imagen\n10. Emocion que transmite y conexion con el publico\n\nJSON: {"score":0-100,"resumen":"2-3 oraciones","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    email: `${base}\n\nEvalua correos de email marketing:\n1. Linea de asunto - genera curiosidad sin ser spam\n2. Estructura clara (header, body, CTA, footer)\n3. Copy persuasivo y natural, no suena a robot\n4. CTA visible, claro y con urgencia\n5. Personalizacion (usa nombre, contexto)\n6. Longitud apropiada (no muy largo)\n7. Mobile-friendly (parrafos cortos, botones grandes)\n8. Cumple CAN-SPAM (unsubscribe, direccion fisica)\n9. Tono de voz adecuado para el negocio\n10. Valor para el lector (no solo vende)\n\nJSON: {"score":0-100,"resumen":"2-3 oraciones","asunto_efectivo":true/false,"estructura_clara":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    presentacion: `${base}\n\nEvalua presentaciones/slides:\n1. Claridad del mensaje por slide - una idea por slide\n2. Diseno visual consistente en todas las slides\n3. Texto conciso (no parrafos largos, maximo 6 lineas)\n4. Flujo logico de informacion (problema -> solucion -> CTA)\n5. Branding consistente (colores, logo, fuentes)\n6. Impacto del primer slide - engancha al lector\n7. CTA claro en la ultima slide\n8. Uso efectivo de imagenes y graficos\n9. Contraste y legibilidad\n10. Profesionalismo general\n\nJSON: {"score":0-100,"resumen":"2-3 oraciones","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    plantilla: `${base}\n\nEvalua plantillas, flyers y brochures:\n1. Impacto visual - llama la atencion inmediatamente\n2. Jerarquia de informacion (titulo > subtitulo > cuerpo > CTA)\n3. Texto legible y conciso\n4. Paleta de colores profesional y coherente con la marca\n5. CTA claro y visible\n6. Balance entre texto e imagenes\n7. Calidad de las imagenes usadas\n8. Adaptabilidad a diferentes usos\n9. Informacion de contacto visible\n10. Profesionalismo y credibilidad\n\nJSON: {"score":0-100,"resumen":"2-3 oraciones","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };

  return schemas[tipo] || schemas.imagen;
}

// Analyze image with Claude (base64)
async function analyzeWithClaude(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const systemPrompt = getSystemPrompt(tipo);

  const knowledgeContext = buildKnowledgeContext(submission);

  let userText = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userText += `- Descripcion: ${submission.descripcion}\n`;
  userText += knowledgeContext;
  userText += '\nEvalua este creativo y genera tu evaluacion completa.';

  let content;

  if (tipo === 'email') {
    // Text-only for emails
    content = [{
      type: 'text',
      text: `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n\nEvalua este correo y genera tu evaluacion.`
    }];
  } else if (imageBase64) {
    // Image analysis
    content = [
      {
        type: 'image',
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

  const response = await fetch(CLAUDE_URL, {
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
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  let parsed = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = { score: 50, resumen: text.substring(0, 500), fortalezas: [], problemas: ['Error parsing AI response'], recomendaciones: [], veredicto: 'cambios' };
  }

  console.log(`[Claude] Result: score=${parsed.score}, veredicto=${parsed.veredicto}`);
  return parsed;
}

module.exports = { analyzeWithClaude };
