const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ───
// UPLOAD_TOKEN: secret only you know. Set this in Railway's environment
// variables tab — never commit it to the repo.
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN;

// UPLOAD_DIR: where photos actually live on disk. In Railway this should
// point at a mounted Volume so files survive redeploys. Locally it just
// defaults to ./uploads.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

if (!UPLOAD_TOKEN) {
  console.warn('[WARN] UPLOAD_TOKEN is not set. Upload/delete routes will reject everything until you set it.');
}

// Make sure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// ─── AUTH MIDDLEWARE ───
// Checks an "x-upload-token" header against UPLOAD_TOKEN.
// Uses a timing-safe comparison so the check itself can't leak the secret
// via response-time differences.
function requireOwner(req, res, next) {
  const provided = req.get('x-upload-token') || '';

  if (!UPLOAD_TOKEN) {
    return res.status(503).json({ error: 'Server not configured: UPLOAD_TOKEN missing.' });
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(UPLOAD_TOKEN);

  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

// ─── MULTER (FILE UPLOAD HANDLING) ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Ignore the original filename entirely — generate a random safe one.
    // This prevents path traversal (../../etc) and overwrite attacks.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '';
    const randomName = crypto.randomBytes(12).toString('hex') + safeExt;
    cb(null, randomName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 20 }, // 20MB per file, 20 files per request
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, gif, webp).'));
    }
  }
});

// ─── STATIC FILES ───
app.use(express.static(path.join(__dirname, 'public')));
// Public read-only access to the actual photo files
app.use('/photos', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ─── PUBLIC: list photos (anyone can view) ───
app.get('/api/photos', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Could not read photos.' });

    const photos = files
      .filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, f));
        return { filename: f, uploadedAt: stat.mtimeMs };
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt); // newest first

    res.json({ photos });
  });
});

// ─── OWNER ONLY: upload ───
app.post('/api/upload', requireOwner, upload.array('photos', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files received.' });
  }
  res.json({
    success: true,
    uploaded: req.files.map(f => f.filename)
  });
});

// Multer error handler (file too big, wrong type, etc.)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('Only image files')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ─── OWNER ONLY: delete ───
app.delete('/api/photos/:filename', requireOwner, (req, res) => {
  const filename = path.basename(req.params.filename); // strip any path traversal
  const filePath = path.join(UPLOAD_DIR, filename);

  // Confirm the resolved path is actually still inside UPLOAD_DIR
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  fs.unlink(filePath, err => {
    if (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Photo not found.' });
      return res.status(500).json({ error: 'Could not delete photo.' });
    }
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Gallery server running on port ${PORT}`);
  console.log(`Serving photos from: ${UPLOAD_DIR}`);
});
