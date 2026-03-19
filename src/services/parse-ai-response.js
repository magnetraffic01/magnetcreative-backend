// Robust multi-strategy JSON parser for AI responses (Gemini, Claude, OpenAI)
// Handles: markdown wrappers, pretty-printed JSON, control chars in strings, truncated responses

function parseAIResponse(text, provider = 'AI') {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let parsed = {};

  // Strategy 1: Direct JSON.parse (works for clean or pretty-printed valid JSON)
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
      return parsed;
    }
  } catch (e1) {
    console.log(`[${provider}] Strategy 1 failed: ${e1.message}`);
  }

  // Strategy 2: Fix control chars ONLY inside JSON string values, then parse
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let jsonStr = match[0].replace(/"(?:[^"\\]|\\.)*"/g, (str) => {
        return str.replace(/[\x00-\x1F]/g, (ch) => {
          if (ch === '\n') return '\\n';
          if (ch === '\r') return '\\r';
          if (ch === '\t') return '\\t';
          return ' ';
        });
      });
      parsed = JSON.parse(jsonStr);
      console.log(`[${provider}] Strategy 2 succeeded (control char fix in strings)`);
      return parsed;
    }
  } catch (e2) {
    console.log(`[${provider}] Strategy 2 failed: ${e2.message}`);
  }

  // Strategy 3: Replace ALL newlines with spaces then parse (lossy but handles most cases)
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let jsonStr = match[0].replace(/[\r\n]+/g, ' ');
      parsed = JSON.parse(jsonStr);
      console.log(`[${provider}] Strategy 3 succeeded (newlines to spaces)`);
      return parsed;
    }
  } catch (e3) {
    console.log(`[${provider}] Strategy 3 failed: ${e3.message}`);
  }

  // Strategy 4: Extract individual fields with regex (handles truncated JSON)
  const scoreMatch = cleaned.match(/"score"\s*:\s*(\d+)/);
  if (scoreMatch) {
    const resumenMatch = cleaned.match(/"resumen"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const veredictoMatch = cleaned.match(/"veredicto"\s*:\s*"(aprobar|cambios|rechazar)"/);
    const fortalezasMatch = cleaned.match(/"fortalezas"\s*:\s*\[([\s\S]*?)\]/);
    const problemasMatch = cleaned.match(/"problemas"\s*:\s*\[([\s\S]*?)\]/);

    parsed = {
      score: parseInt(scoreMatch[1]),
      resumen: resumenMatch ? resumenMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : 'Evaluacion completada (respuesta truncada)',
      veredicto: veredictoMatch ? veredictoMatch[1] : 'cambios',
      fortalezas: fortalezasMatch ? (fortalezasMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1)) : [],
      problemas: problemasMatch ? (problemasMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1)) : [],
      recomendaciones: []
    };

    // Try to also extract recomendaciones if available
    const recsBlock = cleaned.match(/"recomendaciones"\s*:\s*\[([\s\S]*)\]/);
    if (recsBlock) {
      const recMatches = recsBlock[1].matchAll(/"area"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"detalle"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"accion"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
      parsed.recomendaciones = [...recMatches].map(m => ({ area: m[1], detalle: m[2], accion: m[3] }));
    }

    console.log(`[${provider}] Strategy 4 succeeded (regex extraction, score=${parsed.score}, fortalezas=${parsed.fortalezas.length}, problemas=${parsed.problemas.length})`);
    return parsed;
  }

  console.error(`[${provider}] All strategies failed. Raw text (first 500): ${text.substring(0, 500)}`);
  return {
    score: 50,
    resumen: 'Error: La IA no genero un formato valido. Intenta de nuevo.',
    fortalezas: [],
    problemas: ['La IA no genero formato JSON valido'],
    recomendaciones: [],
    veredicto: 'cambios'
  };
}

module.exports = { parseAIResponse };
