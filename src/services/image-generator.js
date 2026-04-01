const config = require('../config');
const { saveFile } = require('./file-storage');

// Brand identity per business for coherent image generation
const BRAND_CONTEXT = {
  TrebolLife: {
    colors: 'Green palette: dark green #1A6E3E, medium green #2D9E5F, light green #E8F5EE, cream #FFFCF5, gold #D4A017 for badges. NO blue or red.',
    style: 'Warm, family-oriented. Hispanic families (morena/olive skin, dark hair). Domestic/emotional scenes. Warm lighting. 3D Pixar/Disney illustration style preferred. NO corporate stock photos, NO white studio backgrounds.',
    tone: 'Empowering, warm, family-first. The CLIENT is the hero (StoryBrand). Headlines about what the client GAINS, not about how good the product is.',
    rules: 'NEVER say "seguro" or "insurance". It is a "membresia de descuentos de salud". Show real savings with numbers. Emotion first, data second.'
  },
  Traduce: {
    colors: 'Professional blues and whites. Clean, trustworthy. Accent with warm gold/orange.',
    style: 'Clean, professional, trustworthy. Show documents, certifications, official stamps. American flag elements for immigration context. Hispanic people in professional/hopeful settings.',
    tone: 'Warm, reassuring. "We know this document represents something important to you." Personal, uses "tu".',
    rules: 'Emphasize: 100% acceptance rate, certified translations, USCIS accepted. Show price ($13.99/page). Include phone number or WhatsApp.'
  },
  MagneTraffic: {
    colors: 'Dark blue #1a365d primary, gold #c8a45a secondary. Professional tech look.',
    style: 'Data-driven, professional, modern. Dashboard/analytics visual metaphors. Clean typography.',
    tone: 'Direct, professional, results-oriented. No exaggeration. "Real leads, not recycled lists."',
    rules: 'Show lead prices ($0.99/lead). Emphasize WhatsApp validated, opt-in verified, same-day delivery.'
  },
  FFL: {
    colors: 'Professional blues, greens for health. Warm and empathetic.',
    style: 'Empathetic, caring. Hispanic families in healthcare settings. Show real savings numbers.',
    tone: 'Empathy first - validate emotion/pain. Solution in 1-2 sentences. Spanish first.',
    rules: 'NEVER mention carrier names (Careington, 1Dental). Show savings: dental cleaning $135→$33 (76% off). Entry from $99/year.'
  },
  Dental: {
    colors: 'Fresh blues and whites. Clean, healthcare feel with accessible vibe.',
    style: 'Accessible, friendly. Focus on real savings with big numbers. Hispanic families.',
    tone: 'Friendly, focused on concrete savings. Empathy with dental pain.',
    rules: 'Show before/after prices. Immediate activation, no SSN needed, no credit check. 75K+ dentists.'
  },
  Salud: {
    colors: 'Healthcare blues and greens. Professional but accessible.',
    style: 'Informative, reassuring. Families accessing healthcare. Diverse Hispanic representation.',
    tone: 'Informative, reassuring. Options for everyone regardless of immigration status.',
    rules: 'Plans for ALL regardless of immigration status. Spanish-first. Help with ACA subsidies.'
  },
  BankyBlendz: {
    colors: 'Urban, bold. Black, gold, modern contrast.',
    style: 'Authentic, visual, modern, urban. Show transformations. High contrast, eye-catching.',
    tone: 'Confident, stylish. Let the work speak for itself.',
    rules: 'Focus on before/after transformations. TikTok and Instagram optimized.'
  }
};

/**
 * Generate an improved image based on AI recommendations.
 * If original image exists on disk, uses OpenAI image edit (sends original + instructions).
 * If no original image, generates from scratch using description.
 */
async function generateImprovedImage(submission, recommendations, pool) {
  const fortalezas = Array.isArray(recommendations.fortalezas) ? recommendations.fortalezas : [];
  const problemas = Array.isArray(recommendations.problemas) ? recommendations.problemas : [];
  const recomendaciones = Array.isArray(recommendations.recomendaciones) ? recommendations.recomendaciones : [];

  // Try to load brand context from businesses table
  let brandFromDB = null;
  if (pool) {
    try {
      const bizResult = await pool.query('SELECT * FROM businesses WHERE name = $1 LIMIT 1', [submission.negocio]);
      if (bizResult.rows.length > 0) {
        const biz = bizResult.rows[0];
        brandFromDB = {
          colors: biz.colors || '',
          style: biz.visual_style || '',
          tone: biz.tone || '',
          rules: biz.rules || ''
        };
      }
    } catch (e) { /* businesses table may not exist */ }
  }

  const promptText = buildPrompt({
    negocio: submission.negocio,
    plataforma: submission.plataforma,
    titulo: submission.titulo,
    descripcion: submission.descripcion,
    tipo: submission.tipo,
    fortalezas,
    problemas,
    recomendaciones,
    objetivo: submission.objetivo || submission.descripcion,
    resumen: submission.ai_resumen,
    brandFromDB
  });

  // Try to get original image from disk for editing
  let originalImagePath = null;
  if (submission.archivo_url) {
    const { getFilePath } = require('./file-storage');
    originalImagePath = await getFilePath(submission.archivo_url);
  }

  console.log(`[Generation] Generating improved image for submission #${submission.id}`);
  console.log(`[Generation] Original image: ${originalImagePath ? 'found' : 'not found (generating from scratch)'}`);
  console.log(`[Generation] Prompt length: ${promptText.length} chars`);

  let imageBuffer;
  if (originalImagePath) {
    // EDIT mode: send original image + improvement instructions
    imageBuffer = await callOpenAIImageEdit(originalImagePath, promptText);
  } else {
    // GENERATE mode: create from scratch (no original available)
    imageBuffer = await callOpenAIImageGeneration(promptText);
  }
  const filename = await saveFile(imageBuffer, `generated_${submission.id}.png`, `gen_${submission.id}`);

  // Get current max version for this submission
  const versionResult = await pool.query(
    'SELECT COALESCE(MAX(version_number), 0) as max_version FROM submission_versions WHERE submission_id = $1',
    [submission.id]
  );
  const nextVersion = versionResult.rows[0].max_version + 1;

  // Insert version record
  const insertResult = await pool.query(`
    INSERT INTO submission_versions (submission_id, version_number, tipo, image_url, generation_prompt, generation_model, ai_score, ai_recomendaciones)
    VALUES ($1, $2, 'generated', $3, $4, 'gpt-image-1', $5, $6)
    RETURNING *
  `, [
    submission.id,
    nextVersion,
    filename,
    promptText,
    submission.ai_score,
    JSON.stringify(recomendaciones)
  ]);

  // Update submission
  await pool.query(
    'UPDATE submissions SET current_version = $1, generation_status = $2, updated_at = NOW() WHERE id = $3',
    [nextVersion, 'ready', submission.id]
  );

  console.log(`[Generation] Version ${nextVersion} created for submission #${submission.id}`);
  return insertResult.rows[0];
}

/**
 * Generate an iteration based on client feedback on a previous version
 */
async function generateIteration(submission, versionId, clientFeedback, pool) {
  // Get the previous version
  const prevResult = await pool.query(
    'SELECT * FROM submission_versions WHERE id = $1 AND submission_id = $2',
    [versionId, submission.id]
  );
  if (prevResult.rows.length === 0) {
    throw new Error('Version not found');
  }
  const prevVersion = prevResult.rows[0];

  // Save client feedback on previous version
  await pool.query(
    'UPDATE submission_versions SET client_feedback = $1, client_satisfied = false WHERE id = $2',
    [clientFeedback, versionId]
  );

  const promptText = buildIterationPrompt({
    negocio: submission.negocio,
    plataforma: submission.plataforma,
    titulo: submission.titulo,
    descripcion: submission.descripcion,
    tipo: submission.tipo,
    previousPrompt: prevVersion.generation_prompt,
    clientFeedback
  });

  console.log(`[Generation] Generating iteration for submission #${submission.id}, based on version #${prevVersion.version_number}`);

  const imageBuffer = await callOpenAIImageGeneration(promptText);
  const filename = await saveFile(imageBuffer, `iteration_${submission.id}.png`, `iter_${submission.id}`);

  // Next version number
  const versionResult = await pool.query(
    'SELECT COALESCE(MAX(version_number), 0) as max_version FROM submission_versions WHERE submission_id = $1',
    [submission.id]
  );
  const nextVersion = versionResult.rows[0].max_version + 1;

  const insertResult = await pool.query(`
    INSERT INTO submission_versions (submission_id, version_number, tipo, image_url, generation_prompt, generation_model, client_feedback)
    VALUES ($1, $2, 'iteration', $3, $4, 'gpt-image-1', $5)
    RETURNING *
  `, [
    submission.id,
    nextVersion,
    filename,
    promptText,
    clientFeedback
  ]);

  await pool.query(
    'UPDATE submissions SET current_version = $1, generation_status = $2, updated_at = NOW() WHERE id = $3',
    [nextVersion, 'ready', submission.id]
  );

  console.log(`[Generation] Iteration version ${nextVersion} created for submission #${submission.id}`);
  return insertResult.rows[0];
}

/**
 * Build a detailed prompt for initial generation from AI recommendations
 */
function buildPrompt({ negocio, plataforma, titulo, descripcion, tipo, fortalezas, problemas, recomendaciones, objetivo, resumen, brandFromDB }) {
  const platformSpecs = {
    facebook: '1080x1080 square for Facebook feed. Mobile-first. Less than 20% text (Meta rule).',
    instagram: '1080x1080 square for Instagram feed. Visual-first, minimal text, scroll-stopping.',
    tiktok: '1080x1920 vertical for TikTok. Bold, high contrast, eye-catching, urban feel.',
    email: '600px wide email header. Clean, professional, one clear CTA.',
    otro: 'General marketing creative. Professional, clear hierarchy.'
  };

  const brand = brandFromDB || BRAND_CONTEXT[negocio] || { colors: '', style: '', tone: '', rules: '' };
  const platformContext = platformSpecs[plataforma?.toLowerCase()] || platformSpecs['otro'];

  let prompt = `You are an expert advertising creative designer. Create a HIGH-CONVERTING ad image.

BUSINESS: ${negocio}
CONCEPT: ${titulo}
${descripcion ? `CONTEXT: ${descripcion}` : ''}
OBJECTIVE: ${objetivo || 'leads'}
PLATFORM: ${platformContext}

BRAND IDENTITY (MUST FOLLOW):
- Colors: ${brand.colors}
- Visual style: ${brand.style}
- Tone: ${brand.tone}
- Rules: ${brand.rules}

${resumen ? `AI EVALUATION SUMMARY OF ORIGINAL: ${resumen}` : ''}`;

  if (fortalezas.length > 0) {
    prompt += `\n\nKEEP THESE (they work well):
${fortalezas.slice(0, 5).map((f, i) => `- ${f}`).join('\n')}`;
  }

  if (problemas.length > 0) {
    prompt += `\n\nFIX THESE PROBLEMS:
${problemas.slice(0, 5).map((p, i) => `- ${p}`).join('\n')}`;
  }

  if (recomendaciones.length > 0) {
    prompt += `\n\nAPPLY THESE CHANGES:
${recomendaciones.slice(0, 5).map((r) => {
  if (typeof r === 'object' && r !== null) {
    return `- ${r.area || r.titulo || 'General'}: ${r.detalle || r.descripcion || ''} → ${r.accion || 'cambiar'}`;
  }
  return `- ${r}`;
}).join('\n')}`;
  }

  prompt += `

DESIGN REQUIREMENTS:
1. ONE dominant focal point - no visual clutter
2. Clear visual hierarchy: headline → benefit → CTA
3. Text must be LARGE and LEGIBLE on mobile (imagine viewing on a phone)
4. Strong CTA button or text that drives action (NOT "learn more" - use "Call now", "Get quote", etc.)
5. Brand colors MUST match the palette above
6. If targeting Hispanic audience: warm, family, community imagery - NO stereotypes
7. Professional quality - this is a PAID advertisement
8. NO watermarks, NO AI disclaimers, NO stock photo feel
9. Include contact method if relevant (phone, WhatsApp)
10. The image must work as a STANDALONE ad - message clear without reading description`;

  return prompt;
}

/**
 * Build prompt for iteration based on client feedback
 */
function buildIterationPrompt({ negocio, plataforma, titulo, descripcion, tipo, previousPrompt, clientFeedback }) {
  let prompt = `Create an IMPROVED version of an advertising creative for "${negocio}" (${plataforma}).

Title/Concept: ${titulo}
${descripcion ? `Description: ${descripcion}` : ''}
Type: ${tipo || 'imagen'}

The previous version was generated with this context:
${previousPrompt}

CLIENT FEEDBACK on the previous version (apply these changes):
${clientFeedback}

IMPORTANT: Keep what worked from the previous version but apply the client's feedback. Create a high-quality, professional advertising creative with clear typography, strong visual hierarchy, and appropriate colors. Do NOT include any watermarks or AI disclaimers.`;

  return prompt;
}

/**
 * Call OpenAI image EDIT API - sends original image + improvement instructions
 * Uses gpt-image-1 which supports image input for editing
 */
async function callOpenAIImageEdit(imagePath, promptText) {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const fs = require('fs');
  const safePrompt = promptText.substring(0, 4000);

  console.log(`[Generation] Using image edit mode with original: ${imagePath}`);

  // Use FormData to send image + prompt to the edits endpoint
  const { FormData, File } = require('node:buffer').Blob ? { FormData: globalThis.FormData, File: globalThis.File } : {};

  // Read original image
  const imageBuffer = await fs.promises.readFile(imagePath);
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('model', 'gpt-image-1');
  formData.append('image[]', imageBlob, 'original.png');
  formData.append('prompt', safePrompt);
  formData.append('n', '1');
  formData.append('size', '1024x1024');
  formData.append('quality', 'high');

  const controller = new AbortController();
  const editTimeout = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
      },
      body: formData,
      signal: controller.signal
    });
  } finally {
    clearTimeout(editTimeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Generation] Image edit failed: ${response.status} - ${errorText.substring(0, 300)}`);
    // Fallback to generation from scratch
    console.log('[Generation] Falling back to generation from scratch...');
    return callOpenAIImageGeneration(promptText);
  }

  const data = await response.json();

  if (data.data?.[0]?.b64_json) {
    const result = Buffer.from(data.data[0].b64_json, 'base64');
    console.log(`[Generation] Image edit successful (${Math.round(result.length / 1024)}KB)`);
    return result;
  }
  if (data.data?.[0]?.url) {
    const imgRes = await fetch(data.data[0].url);
    const arrayBuf = await imgRes.arrayBuffer();
    const result = Buffer.from(arrayBuf);
    console.log(`[Generation] Image edit downloaded (${Math.round(result.length / 1024)}KB)`);
    return result;
  }

  throw new Error('OpenAI returned no image data from edit');
}

/**
 * Call OpenAI image generation API (from scratch)
 * Tries gpt-image-1 first, falls back to dall-e-3
 */
async function callOpenAIImageGeneration(promptText) {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.');
  }

  // Truncate prompt to 4000 chars (DALL-E limit)
  const safePrompt = promptText.substring(0, 4000);

  // Try models in order: gpt-image-1, dall-e-3
  const models = ['gpt-image-1', 'dall-e-3'];

  for (const model of models) {
    try {
      console.log(`[Generation] Trying model: ${model}`);

      const body = {
        model,
        prompt: safePrompt,
        n: 1,
        size: '1024x1024',
      };

      // gpt-image-1 supports b64_json, dall-e-3 uses url
      if (model === 'gpt-image-1') {
        body.quality = 'high';
        body.response_format = 'b64_json';
      } else {
        body.quality = 'standard';
        body.response_format = 'b64_json';
      }

      const controller = new AbortController();
      const genTimeout = setTimeout(() => controller.abort(), 120000);
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } finally {
        clearTimeout(genTimeout);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Generation] ${model} failed: ${response.status} - ${errorText.substring(0, 300)}`);

        // If model not found or not available, try next
        if (response.status === 404 || response.status === 400) continue;

        // For auth errors or rate limits, throw immediately
        throw new Error(`OpenAI ${model}: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();

      // Handle b64_json response
      if (data.data?.[0]?.b64_json) {
        const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
        console.log(`[Generation] ${model}: Image generated (${Math.round(imageBuffer.length / 1024)}KB)`);
        return imageBuffer;
      }

      // Handle URL response (download and convert to buffer)
      if (data.data?.[0]?.url) {
        console.log(`[Generation] ${model}: Downloading image from URL...`);
        const imgRes = await fetch(data.data[0].url);
        if (!imgRes.ok) throw new Error('Failed to download generated image');
        const arrayBuf = await imgRes.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuf);
        console.log(`[Generation] ${model}: Image downloaded (${Math.round(imageBuffer.length / 1024)}KB)`);
        return imageBuffer;
      }

      console.error(`[Generation] ${model}: No image data in response`);
    } catch (err) {
      console.error(`[Generation] ${model} error:`, err.message);
      // If last model, rethrow
      if (model === models[models.length - 1]) throw err;
      // Otherwise try next model
      console.log(`[Generation] Trying next model...`);
    }
  }

  throw new Error('All image generation models failed');
}

module.exports = { generateImprovedImage, generateIteration };
