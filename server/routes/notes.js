const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');
const { success, fail } = require('../utils/responses');
const { createNote, listNotesByUser } = require('../services/noteService');

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const ALLOWED_EXT = ['pdf','doc','docx','txt','ppt','pptx','odt','ods','odp','rtf'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 60);
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    cb(null, `${safeBase}-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_EXT.includes(ext)) return cb(new Error('Invalid file type'));
    cb(null, true);
  }
});

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const notes = await listNotesByUser(req.session.userId);
    return success(res, { notes });
  } catch {
    return fail(res, 'Failed to fetch notes.', 500, 'SERVER_ERROR');
  }
});

router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, 'No file uploaded.', 400, 'NO_FILE');
  const { academicYear, semester, subject, notesType, description, title } = req.body || {};
  if (!(academicYear && semester && subject && notesType && title)) {
    fs.unlink(req.file.path, () => {});
    return fail(res, 'Missing required metadata.', 400, 'MISSING_FIELDS');
  }
  try {
    const note = await createNote(req.session.userId, {
      title,
      academicYear,
      semester,
      subject,
      notesType,
      description: description || '',
      filePath: req.file.path
    });
    return success(res, { noteId: note.id }, 'Note uploaded.', 201);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return fail(res, 'Upload failed.', 500, 'SERVER_ERROR');
  }
});

module.exports = router;