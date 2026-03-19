// Robust multi-strategy JSON parser for AI responses (Gemini, Claude, OpenAI)
// Handles: markdown wrappers, thinking text before JSON, control chars in strings, malformed JSON

function parseAIResponse(text, provider = 'AI') {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  let parsed = {};
  let parseSuccess = false;

  // Strategy 1: Direct greedy regex + JSON.parse (works for clean responses)
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
      parseSuccess = true;
    }
  } catch (e1) {
    console.warn(`[${provider}] Parse strategy 1 failed: ${e1.message}`);

    // Strategy 2: Brace-matching to find exact JSON boundaries + control char fix
    try {
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart !== -1) {
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < cleaned.length; i++) {
          if (cleaned[i] === '{') braceCount++;
          else if (cleaned[i] === '}') braceCount--;
          if (braceCount === 0) { jsonEnd = i; break; }
        }
        if (jsonEnd !== -1) {
          let jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
          // Fix control characters inside string values
          jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (ch) => {
            if (ch === '\n') return '\\n';
            if (ch === '\r') return '\\r';
            if (ch === '\t') return '\\t';
            return '';
          });
          parsed = JSON.parse(jsonStr);
          parseSuccess = true;
          console.log(`[${provider}] Strategy 2 succeeded (brace matching + control char fix)`);
        }
      }
    } catch (e2) {
      console.warn(`[${provider}] Parse strategy 2 failed: ${e2.message}`);

      // Strategy 3: Extract individual fields with regex
      try {
        const scoreMatch = cleaned.match(/"score"\s*:\s*(\d+)/);
        const resumenMatch = cleaned.match(/"resumen"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);
        const veredictoMatch = cleaned.match(/"veredicto"\s*:\s*"(aprobar|cambios|rechazar)"/);
        const fortalezasMatch = cleaned.match(/"fortalezas"\s*:\s*\[([\s\S]*?)\]/);
        const problemasMatch = cleaned.match(/"problemas"\s*:\s*\[([\s\S]*?)\]/);

        if (scoreMatch) {
          parsed = {
            score: parseInt(scoreMatch[1]),
            resumen: resumenMatch ? resumenMatch[1].replace(/\\"/g, '"') : 'Evaluacion completada (parsing parcial)',
            veredicto: veredictoMatch ? veredictoMatch[1] : 'cambios',
            fortalezas: fortalezasMatch ? (fortalezasMatch[1].match(/"([^"]*)"/g) || []).map(s => s.replace(/"/g, '')) : [],
            problemas: problemasMatch ? (problemasMatch[1].match(/"([^"]*)"/g) || []).map(s => s.replace(/"/g, '')) : [],
            recomendaciones: []
          };
          parseSuccess = true;
          console.log(`[${provider}] Strategy 3 succeeded (regex field extraction, score=${parsed.score})`);
        }
      } catch (e3) {
        console.error(`[${provider}] Parse strategy 3 failed: ${e3.message}`);
      }
    }
  }

  if (!parseSuccess) {
    console.error(`[${provider}] All parse strategies failed. Raw text (first 800): ${text.substring(0, 800)}`);
    parsed = {
      score: 50,
      resumen: 'Error: La IA no genero un formato valido. Intenta de nuevo.',
      fortalezas: [],
      problemas: ['La IA no genero formato JSON valido'],
      recomendaciones: [],
      veredicto: 'cambios'
    };
  }

  return parsed;
}

module.exports = { parseAIResponse };
