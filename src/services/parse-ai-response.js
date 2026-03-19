// Robust multi-strategy JSON parser for AI responses (Gemini, Claude, OpenAI)
// Handles: markdown wrappers, thinking text before JSON, control chars in strings, pretty-printed JSON

function parseAIResponse(text, provider = 'AI') {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let parsed = {};
  let parseSuccess = false;

  // Strategy 1: Direct JSON.parse (works for clean or pretty-printed JSON)
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
      parseSuccess = true;
    }
  } catch (e1) {
    console.warn(`[${provider}] Strategy 1 failed: ${e1.message}`);

    // Strategy 2: Fix control chars ONLY inside JSON string values, then parse
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        // Replace control chars only inside quoted strings (not between properties)
        let jsonStr = match[0].replace(/"(?:[^"\\]|\\.)*"/g, (str) => {
          return str.replace(/[\x00-\x1F]/g, (ch) => {
            if (ch === '\n') return '\\n';
            if (ch === '\r') return '\\r';
            if (ch === '\t') return '\\t';
            return ' ';
          });
        });
        parsed = JSON.parse(jsonStr);
        parseSuccess = true;
        console.log(`[${provider}] Strategy 2 succeeded (control char fix in strings)`);
      }
    } catch (e2) {
      console.warn(`[${provider}] Strategy 2 failed: ${e2.message}`);

      // Strategy 3: Brace-matching + replace ALL newlines with spaces (lossy but works)
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
            // Replace all newlines with spaces - safe because JSON whitespace is flexible
            let jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
            jsonStr = jsonStr.replace(/[\r\n]+/g, ' ');
            parsed = JSON.parse(jsonStr);
            parseSuccess = true;
            console.log(`[${provider}] Strategy 3 succeeded (newlines to spaces)`);
          }
        }
      } catch (e3) {
        console.warn(`[${provider}] Strategy 3 failed: ${e3.message}`);

        // Strategy 4: Extract individual fields with regex (last resort)
        try {
          const scoreMatch = cleaned.match(/"score"\s*:\s*(\d+)/);
          const resumenMatch = cleaned.match(/"resumen"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const veredictoMatch = cleaned.match(/"veredicto"\s*:\s*"(aprobar|cambios|rechazar)"/);
          const fortalezasMatch = cleaned.match(/"fortalezas"\s*:\s*\[([\s\S]*?)\]/);
          const problemasMatch = cleaned.match(/"problemas"\s*:\s*\[([\s\S]*?)\]/);

          if (scoreMatch) {
            parsed = {
              score: parseInt(scoreMatch[1]),
              resumen: resumenMatch ? resumenMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : 'Evaluacion completada (parsing parcial)',
              veredicto: veredictoMatch ? veredictoMatch[1] : 'cambios',
              fortalezas: fortalezasMatch ? (fortalezasMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1)) : [],
              problemas: problemasMatch ? (problemasMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1)) : [],
              recomendaciones: []
            };
            parseSuccess = true;
            console.log(`[${provider}] Strategy 4 succeeded (regex extraction, score=${parsed.score})`);
          }
        } catch (e4) {
          console.error(`[${provider}] Strategy 4 failed: ${e4.message}`);
        }
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
