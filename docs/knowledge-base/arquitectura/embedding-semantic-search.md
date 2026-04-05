# Embedding y Busqueda Semantica

Documentacion del sistema de embeddings y busqueda semantica utilizado en la Knowledge Base de MagnetCreative.

---

## Modelo de Embedding

- **Modelo:** `gemini-embedding-001`
- **Dimensiones:** 768
- **Proveedor:** Google Gemini API

## Chunking

- **Tamano de chunk:** 4,000 caracteres
- **Overlap:** 200 caracteres
- El texto de cada KB entry se divide en chunks antes de generar embeddings
- El overlap asegura que no se pierda contexto en los bordes de cada chunk

## Almacenamiento

- **Extension:** pgvector en PostgreSQL
- **Tabla:** `kb_embeddings`
- Cada chunk se almacena como un registro con su vector de 768 dimensiones
- Referencia al KB entry original via foreign key

## Busqueda Semantica

- **Metrica:** Similitud coseno
- **Threshold minimo:** 0.3
- **Top resultados:** 8
- La query del usuario se convierte a embedding y se compara contra todos los chunks almacenados
- Solo se retornan chunks con similitud >= 0.3

## Fallback

- Si los embeddings no estan disponibles (error de API, tabla vacia, etc.), el sistema carga **todas** las KB entries directamente (modo legacy)
- Esto asegura que el sistema siempre tenga contexto disponible para las evaluaciones

## Auto-Embedding

- Al crear una KB entry (`POST /knowledge-base`), se dispara `embedKBEntry()` automaticamente
- Al actualizar una KB entry, se regeneran los embeddings del entry modificado
- El proceso es asincrono para no bloquear la respuesta al usuario

## Retry y Resiliencia

- **Intentos maximos:** 3
- **Estrategia:** Exponential backoff
- Si los 3 intentos fallan, el embedding queda pendiente y el sistema usa el fallback legacy

---

## Esquema de Tabla (kb_embeddings)

```sql
CREATE TABLE kb_embeddings (
  id SERIAL PRIMARY KEY,
  kb_entry_id INTEGER REFERENCES knowledge_base(id),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indice para busqueda por similitud coseno
CREATE INDEX ON kb_embeddings USING ivfflat (embedding vector_cosine_ops);
```
