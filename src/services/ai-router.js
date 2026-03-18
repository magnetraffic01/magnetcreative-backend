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

// Download file from Gemini and convert to base64 for Claude/OpenAI
async function downloadGeminiFile(geminiFileUri, geminiFileName) {
  try {
    // Get file metadata to find download URL
    const name = geminiFileName || geminiFileUri.split('/').pop();
    const metaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${name}?key=${config.geminiApiKey}`
    );

    if (!metaRes.ok) {
      // Try using the URI directly as a download URL
      console.log(`[Download] Metadata fetch failed, trying direct URI`);
      return null;
    }

    const meta = await metaRes.json();
    const downloadUri = meta.uri;

    if (!downloadUri) {
      console.log(`[Download] No download URI in metadata`);
      return null;
    }

    // Download the actual file content
    const fileRes = await fetch(`${downloadUri}?key=${config.geminiApiKey}`);
    if (!fileRes.ok) {
      console.log(`[Download] File download failed: ${fileRes.status}`);
      return null;
    }

    const buffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = meta.mimeType || 'image/jpeg';

    console.log(`[Download] Got file: ${Math.round(base64.length / 1024)}KB, mime: ${mimeType}`);
    return { base64, mimeType };
  } catch (err) {
    console.error(`[Download] Error: ${err.message}`);
    return null;
  }
}

async function analyzeSubmission(submission, imageBase64, imageMimeType) {
  const tipo = submission.tipo;
  const plataforma = submission.plataforma || 'Facebook';

  // Inject platform specs
  submission._platformContext = getPlatformContext(plataforma);

  // ============ VIDEOS -> GEMINI ============
  if (tipo === 'video') {
    console.log(`[AI Router] Video -> Gemini`);
    return await analyzeWithGemini(submission);
  }

  // ============ NON-VIDEO ============
  // If no base64 provided but we have a Gemini URI, try to download it
  if (!imageBase64 && submission.gemini_file_uri && tipo !== 'email') {
    console.log(`[AI Router] No base64, trying to download from Gemini...`);
    const downloaded = await downloadGeminiFile(submission.gemini_file_uri, submission.gemini_file_name);
    if (downloaded) {
      imageBase64 = downloaded.base64;
      imageMimeType = downloaded.mimeType;
    }
  }

  // 1. Claude (PRIMARY)
  if (config.claudeApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Claude (primary), hasBase64: ${!!imageBase64}`);
      return await analyzeWithClaude(submission, imageBase64, imageMimeType);
    } catch (err) {
      console.error(`[AI Router] Claude failed: ${err.message}`);
    }
  }

  // 2. OpenAI (FALLBACK)
  if (config.openaiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> OpenAI (fallback 1), hasBase64: ${!!imageBase64}`);
      return await analyzeWithOpenAI(submission, imageBase64, imageMimeType);
    } catch (err) {
      console.error(`[AI Router] OpenAI failed: ${err.message}`);
    }
  }

  // 3. Gemini text-only (LAST RESORT)
  if (config.geminiApiKey) {
    try {
      console.log(`[AI Router] ${tipo} -> Gemini text-only (fallback 2)`);
      const textOnlySubmission = { ...submission, gemini_file_uri: null };
      return await analyzeWithGemini(textOnlySubmission);
    } catch (err) {
      console.error(`[AI Router] Gemini failed: ${err.message}`);
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
  if (data.error) {
    throw new Error(`OpenAI error: ${data.error.message || JSON.stringify(data.error)}`);
  }

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
    imagen: `${base}\nEvalua dimensiones, formato, y cumplimiento de specs de plataforma.\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"dimensiones_correctas":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,
    email: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","asunto_efectivo":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    presentacion: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,
    plantilla: `${base}\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"dimensiones_correctas":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };

  return schemas[tipo] || schemas.imagen;
}

module.exports = { analyzeSubmission };
