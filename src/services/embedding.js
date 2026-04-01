// Embedding service using Google Gemini Embedding API
// Uses gemini-embedding-001 (stable) with 768 dimensions for production efficiency

const config = require('../config');

const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const EMBED_DIMENSIONS = 768;
const MAX_CHUNK_CHARS = 4000; // ~2000 tokens, safe for gemini-embedding-001's 2048 token limit
const CHUNK_OVERLAP = 200;

/**
 * Generate embedding for a single text using Gemini API
 * @param {string} text - Text to embed
 * @param {string} taskType - RETRIEVAL_DOCUMENT or RETRIEVAL_QUERY
 * @returns {number[]} - Vector of 768 dimensions
 */
async function generateEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const trimmed = text.substring(0, MAX_CHUNK_CHARS).trim();
  if (!trimmed) return null;

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: trimmed }] },
      taskType,
      outputDimensionality: EMBED_DIMENSIONS
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Embedding API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Retry wrapper with exponential backoff for embedding calls
 * @param {string} text - Text to embed
 * @param {string} taskType - RETRIEVAL_DOCUMENT or RETRIEVAL_QUERY
 * @param {number} maxRetries - Max retry attempts (default 3)
 * @returns {number[]} - Vector of 768 dimensions
 */
async function generateEmbeddingWithRetry(text, taskType, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateEmbedding(text, taskType);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[Embedding] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Split text into chunks with overlap for better retrieval
 * @param {string} text - Full text to chunk
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text) {
  if (!text || text.length <= MAX_CHUNK_CHARS) {
    return [text].filter(Boolean);
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + MAX_CHUNK_CHARS;

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > start + MAX_CHUNK_CHARS * 0.5) {
        end = lastParagraph;
      } else {
        const lastSentence = text.lastIndexOf('. ', end);
        if (lastSentence > start + MAX_CHUNK_CHARS * 0.5) {
          end = lastSentence + 1;
        }
      }
    }

    chunks.push(text.substring(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    // Prevent infinite loop
    if (end >= text.length) break;
  }

  return chunks.filter(c => c.length > 20);
}

/**
 * Embed a KB entry: chunk text, generate embeddings, store in pgvector
 * @param {object} pool - PostgreSQL pool
 * @param {object} kbEntry - { id, contenido, negocio, categoria, tenant_id }
 */
async function embedKBEntry(pool, kbEntry) {
  const { id, contenido, negocio, categoria, tenant_id } = kbEntry;

  if (!contenido || !config.geminiApiKey) return;

  // Delete old embeddings for this KB entry
  await pool.query('DELETE FROM kb_embeddings WHERE kb_id = $1', [id]);

  const chunks = chunkText(contenido);
  console.log(`[Embedding] KB entry ${id}: ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const vector = await generateEmbeddingWithRetry(chunks[i], 'RETRIEVAL_DOCUMENT');
      if (vector) {
        await pool.query(
          `INSERT INTO kb_embeddings (kb_id, chunk_index, chunk_text, embedding, negocio, categoria, tenant_id)
           VALUES ($1, $2, $3, $4::vector, $5, $6, $7)`,
          [id, i, chunks[i], `[${vector.join(',')}]`, negocio || null, categoria || 'general', tenant_id || null]
        );
      }
    } catch (err) {
      console.error(`[Embedding] Error on chunk ${i} of KB ${id}: ${err.message}`);
    }
  }
}

/**
 * Semantic search: find most relevant KB chunks for a query
 * @param {object} pool - PostgreSQL pool
 * @param {string} queryText - Search query (negocio + tipo + objetivo context)
 * @param {object} filters - { negocio, tenant_id, limit }
 * @returns {object[]} - Array of { chunk_text, similarity, kb_id, categoria }
 */
async function searchKB(pool, queryText, filters = {}) {
  const { negocio, tenant_id, limit = 8 } = filters;

  if (!config.geminiApiKey) return [];

  // Check if kb_embeddings table has any data
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM kb_embeddings');
    if (parseInt(countResult.rows[0].count) === 0) return [];
  } catch {
    return []; // Table might not exist yet
  }

  let queryVector;
  try {
    queryVector = await generateEmbeddingWithRetry(queryText, 'RETRIEVAL_QUERY');
  } catch (err) {
    console.error(`[Embedding] Query embedding failed: ${err.message}`);
    return [];
  }

  if (!queryVector) return [];

  // Build dynamic WHERE clause for tenant isolation
  const conditions = [];
  const params = [`[${queryVector.join(',')}]`];
  let paramIndex = 2;

  if (negocio) {
    conditions.push(`(negocio IS NULL OR negocio = '' OR negocio = $${paramIndex})`);
    params.push(negocio);
    paramIndex++;
  }

  if (tenant_id) {
    conditions.push(`(tenant_id IS NULL OR tenant_id = $${paramIndex})`);
    params.push(tenant_id);
    paramIndex++;
  }

  params.push(limit);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT kb_id, chunk_text, categoria,
            1 - (embedding <=> $1::vector) as similarity
     FROM kb_embeddings
     ${whereClause}
     ORDER BY embedding <=> $1::vector
     LIMIT $${paramIndex}`,
    params
  );

  return result.rows.filter(r => r.similarity > 0.3); // Threshold: only relevant results
}

/**
 * Re-embed all existing KB entries (for initial migration or model change)
 * @param {object} pool - PostgreSQL pool
 */
async function reembedAll(pool) {
  if (!config.geminiApiKey) {
    console.log('[Embedding] Skipping re-embed: GEMINI_API_KEY not set');
    return;
  }

  const result = await pool.query('SELECT id, contenido, negocio, categoria, tenant_id FROM knowledge_base');
  console.log(`[Embedding] Re-embedding ${result.rows.length} KB entries...`);

  let success = 0;
  for (const row of result.rows) {
    try {
      await embedKBEntry(pool, row);
      success++;
    } catch (err) {
      console.error(`[Embedding] Failed KB ${row.id}: ${err.message}`);
    }
    // Rate limit: Gemini free tier = 1500 RPM, be conservative
    if (success % 10 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  // Create IVFFlat index if we have enough vectors
  try {
    const count = await pool.query('SELECT COUNT(*) FROM kb_embeddings');
    const total = parseInt(count.rows[0].count);
    if (total >= 100) {
      console.log(`[Embedding] Creating IVFFlat index (${total} vectors)...`);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_kbe_embedding ON kb_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)');
    } else {
      console.log(`[Embedding] ${total} vectors - using sequential scan (IVFFlat needs 100+)`);
    }
  } catch (err) {
    console.log(`[Embedding] Index creation: ${err.message}`);
  }

  console.log(`[Embedding] Done. ${success}/${result.rows.length} entries embedded.`);
}

module.exports = {
  generateEmbedding,
  generateEmbeddingWithRetry,
  chunkText,
  embedKBEntry,
  searchKB,
  reembedAll,
  EMBED_DIMENSIONS
};
