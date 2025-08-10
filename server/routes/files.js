const express = require('express');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const { userOwnsFile } = require('../services/noteService');
const { fail } = require('../utils/responses');

const router = express.Router();

router.get('/:filename', isAuthenticated, async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads', filename);
  try {
    const owns = await userOwnsFile(req.session.userId, filename);
    if (!owns) return fail(res, 'File not found or access denied.', 404, 'NOT_FOUND');
    if (!fs.existsSync(filePath)) return fail(res, 'Physical file missing.', 404, 'MISSING');
    res.sendFile(filePath);
  } catch {
    return fail(res, 'Error serving file.', 500, 'SERVER_ERROR');
  }
});

module.exports = router;