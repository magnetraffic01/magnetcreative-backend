const config = require('../config');

// Dispatch submission to n8n for async AI analysis
async function dispatchToN8n(submission, pool) {
  if (!config.n8nWebhookUrl) {
    console.log('[Webhook] N8N_WEBHOOK_URL not configured, skipping async dispatch');
    return false;
  }

  try {
    const payload = {
      submission_id: submission.id,
      titulo: submission.titulo,
      tipo: submission.tipo,
      negocio: submission.negocio,
      plataforma: submission.plataforma || 'facebook',
      descripcion: submission.descripcion || '',
      objetivo: submission.objetivo || '',
      gemini_file_uri: submission.gemini_file_uri || null,
      contenido_email: submission.contenido_email || null,
      callback_url: `${config.frontendUrl.replace('studio.', 'creative.')}/submissions/analysis-callback`,
    };

    console.log(`[Webhook] Dispatching submission #${submission.id} to n8n`);

    const res = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': config.n8nApiKey || '',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[Webhook] n8n responded with ${res.status}`);
      return false;
    }

    console.log(`[Webhook] Submission #${submission.id} dispatched successfully`);
    return true;
  } catch (err) {
    console.error(`[Webhook] Failed to dispatch: ${err.message}`);
    return false;
  }
}

module.exports = { dispatchToN8n };
