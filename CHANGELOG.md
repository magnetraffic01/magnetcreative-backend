# MagnetCreative - Changelog & Registry

## Architecture
- **Frontend**: React + Vite + TypeScript → studio.magnetraffic.com
- **Backend**: Node.js + Express 5 + PostgreSQL → creative.magnetraffic.com
- **AI**: Claude (images/docs) → OpenAI (fallback) → Gemini (videos)
- **Embeddings**: Gemini Embedding API (gemini-embedding-001, 768 dims) + pgvector
- **Storage**: /app/uploads with persistent Docker volume, auto-cleanup 14 days / 3GB
- **Database**: PostgreSQL 17 with pgvector extension (pgvector/pgvector:pg17)
- **Migrations**: 001-017 (SQL files + inline in server.js)
- **Multi-tenant**: Complete isolation with tenant_id on all tables

---

## Release History

### Operational Note — CORS deploy-cache resolution (2026-04-16)
**Commit:** `65acadc` (no new code; redeploy-only fix)

#### Symptom
Browser at `studio.magnetraffic.com/upload` showed:
```
Access to fetch at 'https://creative.magnetraffic.com/submissions/gemini-upload'
from origin 'https://studio.magnetraffic.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

#### Root cause
EasyPanel was serving an older container image. The fix (hardcoding `https://studio.magnetraffic.com` in `server.js:19` allowed origins) had been in `master` for 3+ days but the running container predated it.

#### Resolution
- No code change. Forced redeploy via EasyPanel UI (`pholji.easypanel.host` → `magnetcreative-bk` → Deploy button).
- Verified with `curl -I -X OPTIONS -H "Origin: https://studio.magnetraffic.com" https://creative.magnetraffic.com/submissions/gemini-upload` → returned `204` with `Access-Control-Allow-Origin: https://studio.magnetraffic.com` ✓

#### Lesson — diagnostic order for CORS errors
1. Run `curl -I -X OPTIONS` against the deployed endpoint FIRST.
2. If curl shows the headers but the browser doesn't → browser cache; hard refresh.
3. If curl does NOT show headers but source code does → deploy/cache issue; force redeploy.
4. Only edit CORS config if curl AND source both lack the headers.

#### Recurrence
This is the **2nd documented EasyPanel deploy-cache trap**. First was actuarialads bug F04 (2026-03-29). Pattern documented in `~/.claude/projects/.../memory/reference_easypanel_deploy_cache_pattern.md` and `MT-Wiki/concepts/easypanel-deploy-cache-trap.md`.

#### Outstanding
- **React error #31** on the frontend (`studiomagnetrafficweb`): blank screen after backend returns valid score. Backend is fine; bug is in result-rendering component. Tracked as P1 on the project.

---

### v2.3.0 — KB Enrichment & Documentation (2026-04-04)
**Commit:** `b5dc93a` + `5fd25f1`

#### KB Enriched with Real Ad Patterns
- Analyzed 33 real ad images from PC (Traduce, Salud, Dental, TreboLife)
- TrebolLife: Replaced 4 fixed headlines with bank of 15+ hooks by plan/dolor
- Added explicit rule: "NUNCA copiar textual, siempre crear copy UNICO"
- Added `copy_ads` field with proven layout patterns, anti-patterns
- Traduce: Added 2 proven ad styles + 8 hooks by angle
- FFL: Added health/dental hooks and number-hero pattern
- `buildKnowledgeContext()` now includes `copy_ads` when present

#### Documentation Backup (20 files)
- `docs/knowledge-base/negocios/` — 7 business profiles
- `docs/knowledge-base/rubricas/` — 7 evaluation rubrics
- `docs/knowledge-base/patrones/` — StoryBrand, image analysis, copy patterns
- `docs/knowledge-base/arquitectura/` — Evaluation flow, embedding specs

**Files changed:** `src/services/knowledge-base.js`, 20 new docs

---

### v2.2.1 — OpenAI Prompt Unification (2026-04-02)
**Commit:** `f5c6474`

- Unified OpenAI fallback JSON schema with Claude/Gemini format
- Added determinism rule: "La misma pieza SIEMPRE debe dar el MISMO score"
- Added desglose example format
- All 3 AI providers now use identical prompt structure

**Files changed:** `src/services/ai-router.js`

---

### v2.2.0 — App Hardening (2026-03-31)
**Commit:** `974af06`

#### Phase 1 — Prevent Crashes
- **Migrations in transactions**: Wrapped migrations 005/007/013/015/016 in BEGIN/COMMIT/ROLLBACK
- **Async file storage**: Converted all `writeFileSync`/`statSync`/`unlinkSync` to `fs.promises.*`
- **Circuit breaker**: 3 failures → circuit open 60s per provider (Claude/OpenAI/Gemini)
- **Feed authenticated**: Added auth + tenant filtering + limit cap 100

#### Phase 2 — Resilience
- **Embedding retry**: Exponential backoff (1s, 2s, 4s) with 3 attempts
- **Analysis locking**: `FOR UPDATE SKIP LOCKED` prevents duplicate analysis
- **Graceful fallback**: When all AI providers down → `veredicto: 'pendiente'`

#### Phase 3 — Security
- **API keys hidden**: Logs show `SET`/`NOT SET` only (no partial key exposure)
- **Auth error logging**: DB errors and invalid tokens now logged
- **Audit trail**: Role creation/changes logged with `[Audit]` prefix
- **Tenant NULL fix**: Non-admin without tenant_id sees empty results

**Files changed:** `server.js`, `ai-router.js`, `file-storage.js`, `submissions.js`, `generations.js`, `image-generator.js`, `feed.js`, `auth.js` (middleware), `auth.js` (routes), `embedding.js`

---

### v2.1.0 — Semantic Search with Gemini Embeddings (2026-03-31)
**Commit:** `1ed3f4a`

- New `embedding.js` service: Gemini Embedding API, 768 dimensions, chunking with overlap
- Migration 017: pgvector extension + `kb_embeddings` table
- Auto-embed KB entries on create/update (async, non-blocking)
- Semantic search in `buildKnowledgeContext()` — top 8 relevant chunks via cosine similarity
- Legacy fallback if pgvector unavailable
- `POST /knowledge-base/reembed` endpoint for bulk re-embedding
- PostgreSQL image changed to `pgvector/pgvector:pg17` in EasyPanel

**Files changed:** `embedding.js` (new), `migrate-017-pgvector-embeddings.sql` (new), `knowledge-base.js`, `server.js`, `routes/knowledge-base.js`

---

### v2.0.0 — Multi-Tenant SaaS (2026-03-25)
- Migrations 012-016: tenants, businesses, tenant_id on all tables, roles, permissions
- Tenant isolation on all queries (users, submissions, KB)
- Roles: super_admin → tenant_admin → manager → creative → viewer
- Role escalation blocked: tenant_admin cannot create super_admin
- Dynamic businesses per tenant (replaces hardcoded list for external tenants)
- TenantManagementPage, BusinessManagement in frontend
- Default tenant: magnetraffic (enterprise plan)

---

### v1.x — Foundation
- Migrations 001-011: knowledge_base, chat, categories, versions, archive, share tokens
- Claude + Gemini + OpenAI integration with fallback chain
- Knowledge base with hardcoded business rules (7 businesses)
- File upload with cleanup schedule
- JWT authentication
- Submission evaluation pipeline
- Image generation with DALL-E/GPT-4

---

## Critical Bugs Fixed (DO NOT REINTRODUCE)

### 1. Inconsistent AI Scoring
- **Problem**: Same image scored 75% then 45% on re-evaluation
- **Root cause**: AI prompt said "evaluate" without forcing rubric calculation
- **Fix**: Deterministic scoring with rubric weights, AI must show desglose
- **Files**: claude.js, gemini.js, ai-router.js

### 2. Language Mismatch
- **Problem**: App in English but AI responds in Spanish
- **Fix**: Frontend passes `lang` (es/en), backend adds language instruction to prompt

### 3. Video Upload Timeout
- **Problem**: Videos (up to 50MB) timing out through EasyPanel proxy
- **Fix**: Direct upload to Gemini from frontend, key obtained via /gemini-key

### 4. Docker Deletes Uploads on Rebuild
- **Fix**: Persistent Docker volume: /app/uploads → magnetcreative-uploads

### 5. JWT Secret Change Invalidates All Sessions
- **Fix**: Users must re-login after JWT_SECRET change

### 6. EasyPanel Env Vars With Spaces
- **Fix**: No spaces around = in env vars: `GEMINI_API_KEY=value`

### 7. React Hooks After Conditional Returns
- **Fix**: ALL hooks must be before any conditional return

### 8. Password Reset Code Too Weak
- **Fix**: crypto.randomBytes(16).toString('hex') = 32 char hex

### 9. DALL-E Cannot Generate Real Ads
- **Fix**: Use image EDIT endpoint (sends original + instructions)

### 10. Quick Review Without Confirmation
- **Fix**: AlertDialog confirmation required for all quick review actions

### 11. SMS/WhatsApp Rubrics Not Loaded
- **Problem**: RUBRICA_SMS and RUBRICA_WHATSAPP defined but not included in buildKnowledgeContext()
- **Fix**: Added `else if (tipo === 'sms')` and `else if (tipo === 'whatsapp')` blocks

### 12. OpenAI JSON Schema Mismatch
- **Problem**: OpenAI fallback used different prompt format than Claude/Gemini
- **Fix**: Unified all 3 providers to identical system prompt and JSON schema

### 13. Feed Endpoint Unauthenticated
- **Problem**: GET /feed was public — anyone could see all submissions
- **Fix**: Added authenticate middleware + tenant filtering

### 14. Tenant NULL Bypass
- **Problem**: User with tenant_id=NULL could see all tenants' submissions
- **Fix**: Non-admin without tenant returns empty results

### 15. API Keys Partially Visible in Logs
- **Problem**: Logs showed first 15 + last 6 chars of API keys
- **Fix**: Logs only show SET/NOT SET

---

## Development Rules

1. **Test syntax before push**: `node -c src/file.js` for every changed file
2. **No base64 in JSON body** — use multipart/form-data
3. **EasyPanel requires manual rebuild** after push
4. **No spaces in EasyPanel env vars**
5. **Ownership check on EVERY user-data endpoint**
6. **AI prompt must TEACH** (give corrected versions, not just criticize)
7. **Scoring must be deterministic** (rubric weights with desglose)
8. **Pass lang from frontend** for consistent AI response language
9. **Never repeat the same headline** across different creatives
10. **1 message + 1 CTA per ad** — never saturate
11. **Wrap multi-statement migrations in transactions** (BEGIN/COMMIT/ROLLBACK)
12. **All file operations must be async** (fs.promises, never Sync)
13. **Circuit breaker on external APIs** — 3 failures → 60s cooldown
14. **Audit log all role changes** with [Audit] prefix

---

## Infrastructure

### EasyPanel Services
| Service | Image | Purpose |
|---------|-------|---------|
| magnetcreative-bk | Node 20 Alpine (Dockerfile) | Backend API |
| magnetcreativepostgres | pgvector/pgvector:pg17 | PostgreSQL + pgvector |
| studiomagnetrafficweb | (frontend) | React SPA |

### Environment Variables (Backend)
| Variable | Required | Notes |
|----------|----------|-------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Must not be default value |
| CLAUDE_API_KEY | Yes | Anthropic API |
| OPENAI_API_KEY | Yes | OpenAI (fallback + image gen) |
| GEMINI_API_KEY | Yes | Gemini (videos + embeddings) |
| FRONTEND_URL | No | Default: https://creative.magnetraffic.com |
| N8N_WEBHOOK_URL | No | For async analysis dispatch |
| HEYGEN_API_KEY | No | Pending integration |
| ACTUARIAL_DATABASE_URL | No | ActuarialAds sync |

### Database Migrations
| # | Description | Type |
|---|-------------|------|
| 001 | knowledge_base + negocios | SQL file |
| 002 | chat_messages | SQL file |
| 003 | KB categoria + documento | SQL file |
| 004 | Remove estado check constraint | Inline |
| 005 | Widen AI text columns | Inline (transaction) |
| 006 | Password reset columns | Inline |
| 007 | submission_versions + generation | Inline (transaction) |
| 008 | Archive support | Inline |
| 009 | Objetivo column | Inline |
| 010 | Share token columns | Inline |
| 011 | FK constraint + widen reset_code | Inline |
| 012 | Tenants table | Inline |
| 013 | tenant_id on all tables | Inline (transaction) |
| 014 | Businesses table | Inline |
| 015 | Default tenant + assign data | Inline (transaction) |
| 016 | Permissions + roles | Inline (transaction) |
| 017 | pgvector + kb_embeddings | SQL file (graceful if pgvector missing) |
