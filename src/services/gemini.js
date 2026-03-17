const config = require('../config');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Get system prompt by content type
function getSystemPrompt(tipo) {
  const base = 'Eres el Director Creativo de MagnetCreative, el sistema de evaluacion de creativos de MagneTraffic. Evaluas contenido creativo para campanas digitales.\n\nResponde SOLO con JSON valido sin markdown ni texto adicional.';

  const schemas = {
    video: `${base}\n\nEvalua videos:\n1. Duracion optima (15-30s ads, <60s reels)\n2. Hook en primeros 3 segundos\n3. CTA claro y visible\n4. Ritmo y edicion\n5. Coherencia con el negocio\n6. Calidad del concepto\n7. Texto en pantalla legible\n8. Audio/musica apropiada\n\nJSON: {"score":0-100,"resumen":"2 oraciones","duracion_detectada":"string","hook_presente":true/false,"hook_descripcion":"string","cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    imagen: `${base}\n\nEvalua imagenes/disenos:\n1. Impacto visual inmediato\n2. Jerarquia de informacion\n3. Legibilidad del texto\n4. Contraste y colores\n5. CTA visible\n6. Coherencia con marca\n7. Formato correcto para plataforma\n8. Cumple guidelines de Meta Ads\n\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar","uso_recomendado":"feed|stories|reels|todos"}`,

    email: `${base}\n\nEvalua correos de email marketing:\n1. Linea de asunto efectiva\n2. Estructura clara (header, body, CTA)\n3. Copy persuasivo sin ser spam\n4. CTA visible y claro\n5. Personalizacion\n6. Longitud apropiada\n7. Mobile-friendly\n8. Cumple CAN-SPAM\n\nJSON: {"score":0-100,"resumen":"2 oraciones","asunto_efectivo":true/false,"estructura_clara":true/false,"cta_presente":true/false,"cta_descripcion":"string","fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    presentacion: `${base}\n\nEvalua presentaciones/slides:\n1. Claridad del mensaje por slide\n2. Diseno visual consistente\n3. Texto conciso (no parrafos largos)\n4. Flujo logico de informacion\n5. Branding consistente\n6. Impacto del primer slide\n7. CTA en slide final\n\nJSON: {"score":0-100,"resumen":"2 oraciones","slides_detectados":"string","primer_slide_impacto":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`,

    plantilla: `${base}\n\nEvalua plantillas/flyers:\n1. Impacto visual\n2. Jerarquia de informacion\n3. Texto legible y conciso\n4. Colores y branding\n5. CTA claro\n6. Adaptable a multiples usos\n\nJSON: {"score":0-100,"resumen":"2 oraciones","texto_legible":true/false,"cta_presente":true/false,"fortalezas":["lista"],"problemas":["lista"],"recomendaciones":[{"area":"string","detalle":"string","accion":"mantener|cambiar|eliminar"}],"veredicto":"aprobar|cambios|rechazar"}`
  };

  return schemas[tipo] || schemas.imagen;
}

// Convert Google Drive share link to direct download URL
function convertDriveUrl(url) {
  // Match Google Drive file links
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  // Already a direct link or other URL
  return url;
}

// Download file from URL and upload to Gemini
async function uploadUrlToGemini(fileUrl) {
  const directUrl = convertDriveUrl(fileUrl);
  console.log(`[Gemini] Downloading from URL: ${directUrl}`);

  // Download the file (follow redirects)
  const downloadRes = await fetch(directUrl, { redirect: 'follow' });
  if (!downloadRes.ok) throw new Error(`Failed to download file: ${downloadRes.status}`);

  const contentType = downloadRes.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  const fileSize = buffer.length;

  // Google Drive may return HTML for large files (virus scan warning)
  if (contentType.includes('text/html') && fileSize < 100000) {
    // Try confirm download for large files
    const html = buffer.toString('utf8');
    const confirmMatch = html.match(/confirm=([^&"]+)/);
    if (confirmMatch) {
      console.log(`[Gemini] Large file detected, confirming download...`);
      const confirmUrl = `${directUrl}&confirm=${confirmMatch[1]}`;
      const confirmRes = await fetch(confirmUrl, { redirect: 'follow' });
      if (!confirmRes.ok) throw new Error(`Failed to confirm download: ${confirmRes.status}`);
      const confirmBuffer = Buffer.from(await confirmRes.arrayBuffer());
      const confirmType = confirmRes.headers.get('content-type') || 'video/mp4';
      console.log(`[Gemini] Downloaded ${(confirmBuffer.length / 1024 / 1024).toFixed(2)} MB (${confirmType})`);
      return await uploadBufferToGemini(confirmBuffer, confirmType);
    }
    throw new Error('Google Drive returned HTML instead of file. Make sure the file is shared publicly.');
  }

  console.log(`[Gemini] Downloaded ${(fileSize / 1024 / 1024).toFixed(2)} MB (${contentType})`);
  return await uploadBufferToGemini(buffer, contentType);
}

// Upload buffer to Gemini
async function uploadBufferToGemini(buffer, contentType) {
  const fileSize = buffer.length;

  console.log(`[Gemini] Downloaded ${(fileSize / 1024 / 1024).toFixed(2)} MB (${contentType})`);

  // Upload to Gemini
  const response = await fetch(`${GEMINI_URL}/files?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
      'X-Goog-Upload-Header-Content-Type': contentType,
      'Content-Type': contentType,
    },
    body: buffer,
  });

  const data = await response.json();
  console.log(`[Gemini] Upload status: ${response.status}`);

  if (!data.file) {
    throw new Error(`Gemini upload failed: ${JSON.stringify(data).substring(0, 300)}`);
  }

  // Wait for processing
  let file = data.file;
  let attempts = 0;
  console.log(`[Gemini] File state: ${file.state}, name: ${file.name}`);

  while (file.state === 'PROCESSING' && attempts < 60) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await fetch(`${GEMINI_URL}/files/${file.name.split('/')[1]}?key=${config.geminiApiKey}`);
    file = await check.json();
    attempts++;
    if (attempts % 5 === 0) console.log(`[Gemini] Still processing... attempt ${attempts}`);
  }

  if (file.state !== 'ACTIVE') {
    throw new Error(`File processing failed. State: ${file.state}`);
  }

  console.log(`[Gemini] File ready: ${file.uri}`);
  return file;
}

// Analyze content with Gemini
async function analyzeContent(submission) {
  const tipo = submission.tipo;
  const systemPrompt = getSystemPrompt(tipo);

  let userContext = `CREATIVO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Tipo: ${tipo}\n- Plataforma: ${submission.plataforma || 'facebook'}\n- Formato: ${submission.formato || 'No especificado'}\n`;
  if (submission.descripcion) userContext += `- Descripcion: ${submission.descripcion}\n`;
  userContext += '\nEvalua este creativo y genera tu evaluacion completa.';

  let contents;

  if (tipo === 'email') {
    userContext = `CORREO A EVALUAR:\n- Titulo: ${submission.titulo}\n- Negocio: ${submission.negocio}\n- Contenido:\n${submission.contenido_email}\n\nEvalua este correo y genera tu evaluacion.`;
    contents = [{ role: 'user', parts: [{ text: userContext }] }];
  } else if (submission.gemini_file_uri) {
    const mimeTypes = {
      video: 'video/mp4',
      imagen: 'image/jpeg',
      presentacion: 'application/pdf',
      plantilla: 'image/jpeg'
    };
    contents = [{
      role: 'user',
      parts: [
        { fileData: { mimeType: mimeTypes[tipo] || 'image/jpeg', fileUri: submission.gemini_file_uri } },
        { text: userContext }
      ]
    }];
  } else {
    contents = [{ role: 'user', parts: [{ text: userContext }] }];
  }

  console.log(`[Gemini] Analyzing submission: ${submission.titulo} (${tipo})`);

  const response = await fetch(`${GEMINI_URL}/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 1024 } }
    })
  });

  const data = await response.json();
  console.log(`[Gemini] Analysis response status: ${response.status}`);

  const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';

  let parsed = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = { score: 50, resumen: text.substring(0, 500), fortalezas: [], problemas: ['Error parsing AI response'], recomendaciones: [], veredicto: 'cambios' };
  }

  console.log(`[Gemini] Result: score=${parsed.score}, veredicto=${parsed.veredicto}`);
  return parsed;
}

module.exports = { uploadUrlToGemini, analyzeContent };
