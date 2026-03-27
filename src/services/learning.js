/**
 * Learning system: extracts patterns from AI evaluations and stores them
 * as knowledge base entries for future reference.
 */

async function recordLearning(pool, submission, analysis) {
  try {
    const negocio = submission.negocio;
    const tipo = submission.tipo;
    const score = analysis.score || 0;
    const objetivo = submission.objetivo || 'general';

    // Only learn from evaluations with enough data
    if (!analysis.fortalezas?.length && !analysis.problemas?.length) return;

    // Build learning content from this evaluation
    const learnings = [];

    // High-scoring submissions: their strengths become best practices
    if (score >= 80 && analysis.fortalezas?.length > 0) {
      learnings.push(`BUENAS PRACTICAS (score ${score}/100): ${analysis.fortalezas.slice(0, 3).join('. ')}`);
    }

    // Low-scoring submissions: their problems become warnings
    if (score < 50 && analysis.problemas?.length > 0) {
      learnings.push(`ERRORES COMUNES (score ${score}/100): ${analysis.problemas.slice(0, 3).join('. ')}`);
    }

    // Recommendations that appear repeatedly become standard rules
    if (analysis.recomendaciones?.length > 0) {
      const recs = analysis.recomendaciones.slice(0, 3).map(r => {
        if (typeof r === 'object') return `${r.area || ''}: ${r.detalle || r.descripcion || ''}`;
        return r;
      });
      learnings.push(`RECOMENDACIONES FRECUENTES: ${recs.join('. ')}`);
    }

    if (learnings.length === 0) return;

    const content = learnings.join('\n\n');

    const tenantId = submission.tenant_id || null;

    // Check if we already have a learning entry for this negocio+tipo+objetivo
    const existing = await pool.query(
      `SELECT id, contenido FROM knowledge_base
       WHERE negocio = $1 AND categoria = $2 AND tipo = 'rules'
       AND titulo LIKE '%[auto-learning]%'
       LIMIT 1`,
      [negocio, `${tipo}_${objetivo}`]
    );

    if (existing.rows.length > 0) {
      // Append to existing, keeping last 2000 chars (prevent bloat)
      const updated = (existing.rows[0].contenido + '\n---\n' + content).slice(-2000);
      await pool.query(
        `UPDATE knowledge_base SET contenido = $1, updated_at = NOW() WHERE id = $2`,
        [updated, existing.rows[0].id]
      );
      console.log(`[Learning] Updated learning for ${negocio}/${tipo}/${objetivo}`);
    } else {
      // Create new learning entry with tenant_id
      await pool.query(
        `INSERT INTO knowledge_base (titulo, tipo, negocio, contenido, categoria, tenant_id, created_at, updated_at)
         VALUES ($1, 'rules', $2, $3, $4, $5, NOW(), NOW())`,
        [
          `[auto-learning] Patrones detectados para ${tipo} de ${negocio}`,
          negocio,
          content,
          `${tipo}_${objetivo}`,
          tenantId
        ]
      );
      console.log(`[Learning] Created learning for ${negocio}/${tipo}/${objetivo}`);
    }
  } catch (err) {
    // Learning failures should never block the main flow
    console.error('[Learning] Error recording learning:', err.message);
  }
}

/**
 * Get accumulated learnings for a given negocio/tipo/objetivo
 */
async function getLearnings(pool, negocio, tipo, objetivo, tenantId) {
  try {
    let query = `SELECT contenido FROM knowledge_base
       WHERE negocio = $1 AND tipo = 'rules'
       AND titulo LIKE '%[auto-learning]%'
       AND (categoria = $2 OR categoria = $3)`;
    const params = [negocio, `${tipo}_${objetivo || 'general'}`, `${tipo}_general`];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND (tenant_id IS NULL OR tenant_id = $${params.length})`;
    }
    query += ` ORDER BY updated_at DESC LIMIT 3`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) return '';

    return '\n\nAPRENDIZAJES DE EVALUACIONES ANTERIORES (usa como referencia):\n' +
      result.rows.map(r => r.contenido).join('\n---\n');
  } catch (err) {
    console.error('[Learning] Error getting learnings:', err.message);
    return '';
  }
}

module.exports = { recordLearning, getLearnings };
