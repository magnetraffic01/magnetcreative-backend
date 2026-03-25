const config = require('../config');
const { saveFile } = require('./file-storage');

/**
 * Generate an improved image using GPT-4o based on AI recommendations
 */
async function generateImprovedImage(submission, recommendations, pool) {
  const fortalezas = Array.isArray(recommendations.fortalezas) ? recommendations.fortalezas : [];
  const problemas = Array.isArray(recommendations.problemas) ? recommendations.problemas : [];
  const recomendaciones = Array.isArray(recommendations.recomendaciones) ? recommendations.recomendaciones : [];

  const promptText = buildPrompt({
    negocio: submission.negocio,
    plataforma: submission.plataforma,
    titulo: submission.titulo,
    descripcion: submission.descripcion,
    tipo: submission.tipo,
    fortalezas,
    problemas,
    recomendaciones,
    objetivo: submission.objetivo || submission.descripcion
  });

  console.log(`[Generation] Generating improved image for submission #${submission.id}`);
  console.log(`[Generation] Prompt length: ${promptText.length} chars`);

  const imageBuffer = await callOpenAIImageGeneration(promptText);
  const filename = saveFile(imageBuffer, `generated_${submission.id}.png`, `gen_${submission.id}`);

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
  const filename = saveFile(imageBuffer, `iteration_${submission.id}.png`, `iter_${submission.id}`);

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
function buildPrompt({ negocio, plataforma, titulo, descripcion, tipo, fortalezas, problemas, recomendaciones, objetivo }) {
  const platformSpecs = {
    facebook: 'Facebook ad creative, optimized for feed (1080x1080 or 1200x628)',
    instagram: 'Instagram ad creative, optimized for feed (1080x1080) or stories (1080x1920)',
    tiktok: 'TikTok ad creative, vertical format, bold and eye-catching',
    google: 'Google Display ad creative, clean and professional',
    youtube: 'YouTube ad thumbnail or display creative',
    email: 'Email marketing header image, professional and branded'
  };

  const platformContext = platformSpecs[plataforma] || `${plataforma} ad creative`;

  let prompt = `Create a professional ${platformContext} for a business called "${negocio}".

Title/Concept: ${titulo}
${descripcion ? `Description: ${descripcion}` : ''}
${objetivo ? `Objective: ${objetivo}` : ''}
Type: ${tipo || 'imagen'}

This is an IMPROVED version of an existing creative. `;

  if (fortalezas.length > 0) {
    prompt += `\n\nSTRENGTHS TO KEEP (these worked well in the original):
${fortalezas.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
  }

  if (problemas.length > 0) {
    prompt += `\n\nPROBLEMS TO FIX (these need improvement):
${problemas.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
  }

  if (recomendaciones.length > 0) {
    prompt += `\n\nRECOMMENDATIONS TO IMPLEMENT:
${recomendaciones.map((r, i) => {
  if (typeof r === 'object' && r !== null) {
    return `${i + 1}. [${r.area || r.titulo || ''}] ${r.detalle || r.descripcion || ''} (${r.accion || 'cambiar'})`;
  }
  return `${i + 1}. ${r}`;
}).join('\n')}`;
  }

  prompt += `\n\nIMPORTANT: Create a high-quality, professional advertising creative. Use clear typography, strong visual hierarchy, and appropriate brand colors. The image should be compelling and drive action. Do NOT include any watermarks or AI disclaimers.`;

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
 * Call OpenAI image generation API
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

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

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
