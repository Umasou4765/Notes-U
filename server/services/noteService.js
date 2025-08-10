const path = require('path');
const pool = require('../db/pool');

async function createNote(userId, data) {
  const {
    title, academicYear, semester, subject, notesType, description, filePath
  } = data;
  const r = await pool.query(
    `INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [userId, title, academicYear, semester, subject, notesType, description, filePath]
  );
  return r.rows[0];
}

async function listNotesByUser(userId) {
  const r = await pool.query(
    `SELECT id, title, academic_year, semester, subject_code, notes_type,
            description, file_path, uploaded_at
     FROM notes
     WHERE user_id=$1
     ORDER BY uploaded_at DESC`,
    [userId]
  );
  return r.rows.map(n => ({
    id: n.id,
    title: n.title,
    academic_year: n.academic_year,
    semester: n.semester,
    subject_code: n.subject_code,
    notes_type: n.notes_type,
    description: n.description,
    file_url: `/uploads/${path.basename(n.file_path)}`,
    uploaded_at: n.uploaded_at
  }));
}

async function userOwnsFile(userId, filename) {
  const filePath = path.join('uploads', filename);
  const r = await pool.query(
    'SELECT id FROM notes WHERE user_id=$1 AND file_path=$2',
    [userId, filePath]
  );
  return !!r.rows[0];
}

module.exports = { createNote, listNotesByUser, userOwnsFile };