const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days (enough for admin review cycle)
const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024; // 3GB
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.promises.access(UPLOADS_DIR);
  } catch {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('[FileStorage] Created uploads directory');
  }
}

// Save uploaded file to disk, return filename
async function saveFile(buffer, originalName, submissionId) {
  await ensureUploadsDir();
  const ext = path.extname(originalName) || '.bin';
  const hash = crypto.randomBytes(8).toString('hex');
  const filename = `${submissionId}_${hash}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(filepath, buffer);
  console.log(`[FileStorage] Saved ${filename} (${Math.round(buffer.length / 1024)}KB)`);
  return filename;
}

// Get full path for a filename
async function getFilePath(filename) {
  const filepath = path.join(UPLOADS_DIR, path.basename(filename));
  try {
    await fs.promises.access(filepath);
    return filepath;
  } catch {
    return null;
  }
}

// Get total size of uploads directory
async function getTotalSize() {
  await ensureUploadsDir();
  let total = 0;
  const entries = await fs.promises.readdir(UPLOADS_DIR);
  for (const file of entries) {
    try {
      const stat = await fs.promises.stat(path.join(UPLOADS_DIR, file));
      total += stat.size;
    } catch {}
  }
  return total;
}

// Cleanup: delete files older than MAX_AGE, then enforce MAX_TOTAL_BYTES
async function cleanup() {
  await ensureUploadsDir();
  const now = Date.now();
  let files = [];

  const entries = await fs.promises.readdir(UPLOADS_DIR);
  for (const file of entries) {
    const filepath = path.join(UPLOADS_DIR, file);
    try {
      const stat = await fs.promises.stat(filepath);
      files.push({ name: file, path: filepath, size: stat.size, mtime: stat.mtimeMs });
    } catch {}
  }

  // Phase 1: Delete files older than 3 days
  let deleted = 0;
  let freedBytes = 0;
  for (const f of files) {
    if (now - f.mtime > MAX_AGE_MS) {
      try {
        await fs.promises.unlink(f.path);
        deleted++;
        freedBytes += f.size;
      } catch {}
    }
  }

  // Refresh list after age-based cleanup
  const remaining = [];
  for (const f of files) {
    try {
      await fs.promises.access(f.path);
      remaining.push(f);
    } catch {}
  }
  files = remaining;

  // Phase 2: If still over 2GB, delete oldest first
  let totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    files.sort((a, b) => a.mtime - b.mtime); // oldest first
    for (const f of files) {
      if (totalSize <= MAX_TOTAL_BYTES) break;
      try {
        await fs.promises.unlink(f.path);
        totalSize -= f.size;
        deleted++;
        freedBytes += f.size;
      } catch {}
    }
  }

  if (deleted > 0) {
    console.log(`[FileStorage] Cleanup: ${deleted} files deleted, ${Math.round(freedBytes / 1024 / 1024)}MB freed, ${Math.round(totalSize / 1024 / 1024)}MB remaining`);
  }
  if (deleted === 0) {
    console.log(`[FileStorage] Cleanup: no files to delete, ${Math.round(totalSize / 1024 / 1024)}MB total`);
  }
}

// Start periodic cleanup
function startCleanupSchedule() {
  // Run once on startup
  cleanup().catch(err => console.error('[FileStorage] Cleanup error:', err.message));
  // Then every 6 hours
  setInterval(() => {
    cleanup().catch(err => console.error('[FileStorage] Cleanup error:', err.message));
  }, CLEANUP_INTERVAL_MS);
  console.log('[FileStorage] Cleanup scheduled every 6 hours (max 14 days, max 3GB)');
}

module.exports = { saveFile, getFilePath, cleanup, startCleanupSchedule, UPLOADS_DIR };
