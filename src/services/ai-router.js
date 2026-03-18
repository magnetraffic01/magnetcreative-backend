const config = require('../config');
const { analyzeWithClaude } = require('./claude');
const { analyzeContent: analyzeWithGemini } = require('./gemini');

// Route analysis to the right AI based on content type
// Videos -> Gemini (can see video)
// Everything else -> Claude (1st) -> OpenAI (2nd) -> Gemini (3rd)

async function analyzeSubmission(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;

  // Videos always go to Gemini (only one that can analyze video files)
  if (tipo === 'video') {
    console.log(`[AI Router] Video -> Gemini`);
    return await analyzeWithGemini(submission);
  }

  // If file is already uploaded to Gemini (has URI) and no base64 provided,
  // use Gemini directly since it already has the file
  if (submission.gemini_file_uri && !imageBase64 && tipo !== 'email') {
    console.log(`[AI Router] ${tipo} -> Gemini (file already uploaded, no base64)`);
    return await analyzeWithGemini(submission);
  }

  // For images with base64, emails, etc: try Claude first
  // Fallback: OpenAI -> Gemini

  // 1. Try Claude (Anthropic)
  if (config.claudeApiKey && (imageBase64 || tipo === 'email')) {
    try {
      console.log(`[AI Router] ${tipo} -> Claude (primary)`);
      return await analyzeWithClaude(submission, imageBase64, imageMimeType);
    } catch (err) {
      console.error(`[AI Router] Claude failed: ${err.message}`);
    }
  }

  // 2. Try OpenAI
  if (config.openaiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> OpenAI (fallback 1)`);
      return await analyzeWithOpenAI(submission, imageBase64, imageMimeType);
    } catch (err) {
      console.error(`[AI Router] OpenAI failed: ${err.message}`);
    }
  }

  // 3. Try Gemini (text-only for non-video)
  if (config.geminiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini (fallback 2)`);
      return await analyzeWithGemini(submission);
    } catch (err) {
      console.error(`[AI Router] Gemini failed: ${err.message}`);
    }
  }

  throw new Error('All AI providers failed');
}

// OpenAI analysis
async function analyzeWithOpenAI(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const systemPrompt = getOpenAISystemPrompt(tipo);

  let userText = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n`;
  if (submission.descripcion) userText += `- Descripcion: ${submission.descripcion}\n`;
  userText += '\nEvalua este creativo y genera tu evaluacion completa.';

  let messages;

  if (tipo === 'email') {
    messages = [{
      role: 'user',
      content: `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n\nEvalua este correo.`
    }];
  } else if (imageBase64) {
    messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
        { type: 'text', text: userText }
      ]
    }];
  } else {
    messages = [{ role: 'user', content: userText }];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 4000,
      temperature: 0.3
    })
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  let parsed = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = { score: 50, resumen: text.substring(0, 500), fortalezas: [], problemas: ['Error parsing AI response'], recomendaciones: [], veredicto: 'cambios' };
  }

  console.log(`[OpenAI] Result: score=${parsed.score}, veredicto=${parsed.veredicto}`);
  return parsed;
}

function getOpenAISystemPrompt(tipo) {
  const base = 'Eres el Director Creativo de MagnetCreative. Evaluas contenido creativo para campanas digitales. Responde SOLO con JSON valido sin markdown.';

  const schemas = {
    imagen: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,
    email: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","asunto_efectivo":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    presentacion: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    plantilla: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };

  return schemas[tipo] || schemas.imagen;
}

module.exports = { analyzeSubmission };
