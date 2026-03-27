# MagnetCreative - Changelog & Lessons Learned

## Architecture
- Frontend: React + Vite + TypeScript → studio.magnetraffic.com
- Backend: Node.js + Express 5 + PostgreSQL → creative.magnetraffic.com
- AI: Claude (images/docs) → OpenAI (fallback) → Gemini (videos)
- Storage: /app/uploads with persistent Docker volume
- Migrations: 001-011 (SQL files + inline in server.js)

## Critical Bugs Fixed (DO NOT REINTRODUCE)

### 1. Inconsistent AI Scoring
- **Problem**: Same image scored 75% then 45% on re-evaluation
- **Root cause**: AI prompt said "evaluate" without forcing rubric calculation
- **Fix**: Deterministic scoring - 10 criteria × 10 pts each, AI must show desglose
- **Files**: src/services/claude.js, src/services/gemini.js

### 2. Language Mismatch
- **Problem**: App in English but AI responds in Spanish
- **Root cause**: No language parameter passed from frontend to AI
- **Fix**: Frontend passes `lang` (es/en), backend adds language instruction to prompt
- **Files**: src/routes/submissions.js (reads lang), src/services/claude.js + gemini.js (uses lang)

### 3. Video Upload Timeout
- **Problem**: Videos (up to 50MB) timing out through EasyPanel proxy
- **Fix**: Direct upload to Gemini from frontend, key obtained via /gemini-key endpoint
- **Files**: Frontend gemini-upload.ts, Backend submissions.js /gemini-key

### 4. Docker Deletes Uploads on Rebuild
- **Problem**: Every rebuild wiped /uploads directory
- **Fix**: Persistent Docker volume in EasyPanel: /app/uploads → magnetcreative-uploads

### 5. JWT Secret Change Invalidates All Sessions
- **Problem**: Changing JWT_SECRET causes 401 on all endpoints for existing users
- **Fix**: Users must logout and login again after JWT_SECRET change

### 6. EasyPanel Env Vars With Spaces
- **Problem**: `GEMINI_API_KEY = value` (with spaces) causes 500
- **Fix**: No spaces around = in env vars: `GEMINI_API_KEY=value`

### 7. React Hooks After Conditional Returns
- **Problem**: useState/useEffect placed after `if (loading) return` causes crash
- **Fix**: ALL hooks must be before any conditional return statement

### 8. Password Reset Code Too Weak
- **Problem**: 6-digit numeric code (1M combinations) - brute forceable
- **Fix**: crypto.randomBytes(16).toString('hex') = 32 char hex (2^128 combinations)

### 9. DALL-E Cannot Generate Real Ads
- **Problem**: DALL-E generates artistic images, not ads with real text/prices/CTAs
- **Fix**: Use image EDIT endpoint (sends original + instructions), fallback to generation

### 10. Quick Review Without Confirmation
- **Problem**: Admin could accidentally reject with one click
- **Fix**: AlertDialog confirmation required for all quick review actions

### 11. SMS/WhatsApp Saved As 'email' Type
- **Problem**: Email endpoint hardcoded tipo='email' for all text submissions
- **Fix**: Frontend passes actual tipo (sms/whatsapp), backend uses it in INSERT

## Development Rules
1. Test locally before push: `node -e "require('./src/...')"` + `npx tsc --noEmit`
2. No base64 in JSON body - use multipart/form-data
3. EasyPanel requires manual rebuild after push
4. No spaces in EasyPanel env vars
5. Ownership check on EVERY user-data endpoint
6. AI prompt must TEACH (give corrected versions, not just criticize)
7. Scoring must be deterministic (10 × 10 pts with desglose)
8. Pass lang from frontend for consistent AI response language
9. Confirm rebuild of BOTH (backend + frontend) when changes span both
