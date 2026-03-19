const config = require('../config');
const { analyzeWithClaude } = require('./claude');
const { analyzeContent: analyzeWithGemini } = require('./gemini');

// Platform dimension specs for evaluation
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
  Otro: {
    general: 'Verificar specs de la plataforma destino',
  },
};

function getPlatformContext(plataforma) {
  const specs = PLATFORM_SPECS[plataforma] || PLATFORM_SPECS['Otro'];
  let context = `\n\nESPECIFICACIONES DE PLATAFORMA (${plataforma}):\n`;
  for (const [key, value] of Object.entries(specs)) {
    context += `- ${key}: ${value}\n`;
  }
  context += `\nEvalua si las dimensiones y formato del creativo son correctos para ${plataforma}. Penaliza si no cumple las medidas recomendadas.\n`;
  return context;
}

// Route analysis to the right AI:
// - Videos -> Gemini (only AI that can see video files via URI)
// - Images/Presentations/Plantillas with gemini_file_uri -> Gemini (file already uploaded there)
// - Images with base64 (no URI) -> Claude -> OpenAI
// - Emails (text only) -> Claude -> OpenAI -> Gemini

async function analyzeSubmission(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const plataforma = submission.plataforma || 'Facebook';

  // Inject platform specs
  submission._platformContext = getPlatformContext(plataforma);

  // ============ FILES ALREADY IN GEMINI (video, image, pdf) -> USE GEMINI ============
  if (submission.gemini_file_uri && tipo !== 'email') {
    console.log(`[AI Router] ${tipo} -> Gemini (file already uploaded, URI: ${submission.gemini_file_uri})`);
    try {
      return await analyzeWithGemini(submission);
    } catch (err) {
      console.error(`[AI Router] Gemini with file failed: ${err.message}`);
      // If Gemini fails with file, try text-only as fallback
      console.log(`[AI Router] ${tipo} -> Gemini text-only fallback`);
      try {
        const textOnlySub = { ...submission, gemini_file_uri: null };
        return await analyzeWithGemini(textOnlySub);
      } catch (err2) {
        console.error(`[AI Router] Gemini text-only also failed: ${err2.message}`);
      }
    }
  }

  // ============ IMAGES WITH BASE64 (no Gemini URI) -> CLAUDE ============
  if (imageBase64 && config.claudeApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Claude (has base64)`);
      return await analyzeWithClaude(submission, imageBase64, imageMimeType);
    } catch (err) {
      console.error(`[AI Router] Claude failed: ${err.message}`);
    }
  }

  // ============ EMAILS -> CLAUDE -> OPENAI -> GEMINI ============
  if (tipo === 'email') {
    if (config.claudeApiKey) {
      try {
        console.log(`[AI Router] email -> Claude`);
        return await analyzeWithClaude(submission, null, null);
      } catch (err) {
        console.error(`[AI Router] Claude email failed: ${err.message}`);
      }
    }
    if (config.openaiApiKey) {
      try {
        console.log(`[AI Router] email -> OpenAI`);
        return await analyzeWithOpenAI(submission, null, null);
      } catch (err) {
        console.error(`[AI Router] OpenAI email failed: ${err.message}`);
      }
    }
  }

  // ============ LAST RESORT: GEMINI TEXT-ONLY ============
  if (config.geminiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini text-only (last resort)`);
      const textOnlySub = { ...submission, gemini_file_uri: null };
      return await analyzeWithGemini(textOnlySub);
    } catch (err) {
      console.error(`[AI Router] Gemini text-only failed: ${err.message}`);
    }
  }

  throw new Error('Todos los proveedores de IA fallaron. Verifica las API keys.');
}

// OpenAI analysis
async function analyzeWithOpenAI(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const systemPrompt = getOpenAISystemPrompt(tipo);

  let userText = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n`;
  if (submission.descripcion) userText += `- Descripcion: ${submission.descripcion}\n`;
  if (submission._platformContext) userText += submission._platformContext;
  userText += '\nEvalua este creativo y genera tu evaluacion completa.';

  let messages;

  if (tipo === 'email') {
    messages = [{
      role: 'user',
      content: `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n${submission._platformContext || ''}\n\nEvalua este correo.`
    }];
  } else if (imageBase64) {
    messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` } },
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
  if (data.error) throw new Error(`OpenAI error: ${data.error.message || JSON.stringify(data.error)}`);

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
    imagen: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"dimensiones_correctas":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,
    email: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","asunto_efectivo":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    presentacion: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    plantilla: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"dimensiones_correctas":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };
  return schemas[tipo] || schemas.imagen;
}

module.exports = { analyzeSubmission };
