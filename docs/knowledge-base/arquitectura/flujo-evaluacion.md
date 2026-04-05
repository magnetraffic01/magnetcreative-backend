# Flujo de Evaluacion de Submissions

Flujo completo desde la creacion de una entrada en la Knowledge Base hasta la evaluacion final con IA.

---

## Paso 1: Creacion de KB Entry

- Admin crea una entrada en la Knowledge Base
- `POST /knowledge-base`
- Se dispara `embedKBEntry()` de forma asincrona para generar embeddings

## Paso 2: Pipeline de Embedding

- El texto se divide en chunks (4000 caracteres, 200 de overlap)
- Cada chunk se envia a Gemini API (`gemini-embedding-001`)
- Los vectores resultantes (768 dimensiones) se almacenan en pgvector

## Paso 3: Creacion de Submission

- `POST /submissions/upload`
- Estado inicial: `analizando`
- Se almacena el archivo/contenido del submission

## Paso 4: Dispatch de Analisis

- Se despacha via webhook de n8n o llamada directa a `analyzeSubmission()`
- El sistema determina el proveedor de IA a usar

## Paso 5: Construccion del Contexto

`buildKnowledgeContext()` ensambla:

1. **Informacion del negocio** - datos del business asociado
2. **StoryBrand** - metodologia adaptada para audiencia hispana
3. **Rubrica** - criterios de evaluacion especificos al tipo de contenido
4. **Criterios** - reglas adicionales del admin
5. **Chunks semanticos de KB** - resultados de busqueda por similitud coseno contra la Knowledge Base
6. **Learnings** - aprendizajes previos del sistema

## Paso 6: Llamada a IA

- Proveedores soportados: Claude, Gemini, OpenAI
- Circuit breaker para manejar fallos de proveedor
- El prompt incluye todo el contexto ensamblado en el paso anterior

## Paso 7: Procesamiento de Resultados

- Se parsea la respuesta del modelo de IA
- Se almacenan los resultados (puntuacion, feedback, sugerencias)
- Se ejecuta `recordLearning()` para capturar aprendizajes del analisis
- Estado final del submission se actualiza segun resultado

---

## Diagrama Simplificado

```
Admin -> POST /knowledge-base -> embedKBEntry() -> pgvector
                                                      |
User -> POST /submissions/upload -> analyzeSubmission()
                                         |
                                  buildKnowledgeContext()
                                         |
                              [business + storybrand + rubrica
                               + criterios + KB chunks + learnings]
                                         |
                                   AI Call (circuit breaker)
                                         |
                                  Parse + Store + recordLearning()
```
