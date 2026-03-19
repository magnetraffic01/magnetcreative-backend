const config = require('../config');

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

function parseJsonField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return val;
}

function buildChatSystemPrompt(submission) {
  const fortalezas = parseJsonField(submission.ai_fortalezas);
  const problemas = parseJsonField(submission.ai_problemas);
  const recomendaciones = parseJsonField(submission.ai_recomendaciones);

  return `Eres el Director Creativo de MagnetCreative. Ya evaluaste este creativo y ahora el disenador quiere discutir la evaluacion contigo.

CONTEXTO DEL CREATIVO EVALUADO:
- Titulo: ${submission.titulo}
- Tipo: ${submission.tipo}
- Negocio: ${submission.negocio}
- Plataforma: ${submission.plataforma || 'facebook'}
- Score: ${submission.ai_score}/100
- Veredicto: ${submission.ai_veredicto}
- Resumen: ${submission.ai_resumen}

FORTALEZAS DETECTADAS:
${fortalezas.map(f => `- ${f}`).join('\n') || '- Ninguna'}

PROBLEMAS DETECTADOS:
${problemas.map(p => `- ${p}`).join('\n') || '- Ninguno'}

RECOMENDACIONES:
${recomendaciones.map(r => `- ${r.area || r.titulo || ''}: ${r.detalle || r.descripcion || ''} (${r.accion || ''})`).join('\n') || '- Ninguna'}

INSTRUCCIONES:
- Responde en espanol, de forma clara y directa
- Puedes defender tu evaluacion o reconocer puntos validos del usuario
- Da consejos practicos y especificos cuando te pregunten
- Si el usuario debate el score, argumenta con evidencia de lo que detectaste
- Mantente profesional pero accesible
- Respuestas concisas (2-4 parrafos maximo)`;
}

async function chatWithAI(systemPrompt, messages) {
  if (config.claudeApiKey) {
    try {
      return await chatWithClaude(systemPrompt, messages);
    } catch (err) {
      console.error(`[Chat] Claude failed: ${err.message}`);
    }
  }
  if (config.openaiApiKey) {
    try {
      return await chatWithOpenAI(systemPrompt, messages);
    } catch (err) {
      console.error(`[Chat] OpenAI failed: ${err.message}`);
    }
  }
  throw new Error('No hay proveedor de IA disponible para el chat');
}

async function chatWithClaude(systemPrompt, messages) {
  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(`Claude: ${data.error.message}`);
  return data.content?.[0]?.text || '';
}

async function chatWithOpenAI(systemPrompt, messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 1500,
      temperature: 0.5
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { buildChatSystemPrompt, chatWithAI };
