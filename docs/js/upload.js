/*
 * File: docs/js/upload.js
 * Description: Upload page logic (module). Handles file selection, validation, drag/drop UI,
 *              subject dropdown population, and calls createNote() to upload notes.
 * Notes: Uses Firebase service helpers for auth and storage; keeps a local fallback for subjects.
 */
import { onAuth, createNote, fetchSubjects } from './services/firebase.js';
import { showToast } from './services/ui.js';

// Init theme (keeps in sync with other pages and binds the shared toggle)
(function initTheme(){
  function applyTheme(isDark){ document.body.classList.toggle('dark', !!isDark); document.body.classList.toggle('light', !isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }
  const stored = localStorage.getItem('theme');
  if(stored === 'dark') applyTheme(true);
  else if(stored === 'light') applyTheme(false);
  else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{ if(!localStorage.getItem('theme')) applyTheme(e.matches); });
  window.addEventListener('storage', e=>{ if(e.key==='theme' && e.newValue) applyTheme(e.newValue === 'dark'); });

  document.getElementById('theme-toggle')?.addEventListener('click', ()=>{
    const willBeDark = !document.body.classList.contains('dark');
    applyTheme(willBeDark);
  }, { passive:true });
})();

onAuth(user => { if(!user) location.href='auth.html?mode=login'; });

// Elements
const form = document.getElementById('uploadForm');
const fileUpload = document.getElementById('fileUpload');
const fileDrop = document.getElementById('fileDrop');
const fileOk = document.getElementById('fileOk');
const submitBtn = form.querySelector('button[type="submit"]');
const progressEl = document.getElementById('uploadProgress');

// Fallback subjects (minimal)
const fallbackSubjects = {
  year1: { semester1:[{code:'AMCS1013',name:'Problem Solving and Programming'}] }
};
let subjectsData = fallbackSubjects;

// Helper: populate semesters/subjects (kept simple)
function populateSemesters(){
  const semesterSelect = document.getElementById('semesterSelect');
  semesterSelect.innerHTML = '<option value="">Select Semester</option>';
  const y = document.getElementById('academicYearSelect').value;
  if(y && subjectsData[y]){
    Object.keys(subjectsData[y]).forEach(sem=>{
      const opt = document.createElement('option'); opt.value = sem; opt.textContent = sem.replace('semester','Semester '); semesterSelect.appendChild(opt);
    });
    semesterSelect.disabled = false;
  } else {
    semesterSelect.disabled = true;
  }
}
function populateSubjects(){
  const subjectSelect = document.getElementById('subjectSelect');
  subjectSelect.innerHTML = '<option value="">Select Subject</option>';
  const y = document.getElementById('academicYearSelect').value;
  const s = document.getElementById('semesterSelect').value;
  if(y && s && subjectsData[y] && subjectsData[y][s]){
    subjectsData[y][s].forEach(sub=>{
      const opt = document.createElement('option'); opt.value = sub.code; opt.textContent = `${sub.code} - ${sub.name}`; subjectSelect.appendChild(opt);
    });
    subjectSelect.disabled = false;
  } else subjectSelect.disabled = true;
}

function updateFileUI(file){
  const fileOk = document.getElementById('fileOk');
  if(file){ fileOk.textContent = `✓ ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`; fileOk.style.display = 'block'; }
  else { fileOk.style.display = 'none'; }
}

// Drag & drop
fileDrop.addEventListener('click', () => fileUpload.click());
fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', e => { e.preventDefault(); fileDrop.classList.remove('dragover'); if(e.dataTransfer.files.length){ fileUpload.files = e.dataTransfer.files; updateFileUI(fileUpload.files[0]); } });
fileUpload.addEventListener('change', () => updateFileUI(fileUpload.files[0]));

// Create note
form.addEventListener('submit', async e => {
  e.preventDefault();
  if(!fileUpload.files.length) { showToast('Please select a file', 'error'); return; }
  submitBtn.disabled = true; submitBtn.textContent = 'Uploading...'; if(progressEl) { progressEl.style.display = 'block'; }
  try {
    await createNote({
      academic_year: document.getElementById('academicYearSelect').value,
      semester: document.getElementById('semesterSelect').value,
      subject_code: document.getElementById('subjectSelect').value,
      notes_type: document.getElementById('notesType').value,
      description: document.getElementById('description').value,
      file: fileUpload.files[0],
      title: fileUpload.files[0].name
    }, (progress) => { if(progressEl) progressEl.value = progress; });
    showToast('Upload successful!', 'success');
    setTimeout(() => location.href = 'home.html', 1000);
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
    submitBtn.disabled = false; submitBtn.textContent = 'Upload Notes';
    if(progressEl) progressEl.style.display = 'none';
  }
});

// Init data
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const server = await fetchSubjects();
    if(server && server.length) {
      // convert list to the structure
      const out = {};
      server.forEach(s=>{ const y = s.academic_year||'year1'; const sem = s.semester||'semester1'; out[y]=out[y]||{}; out[y][sem]=out[y][sem]||[]; out[y][sem].push({ code:s.code, name:s.name }); });
      subjectsData = out;
    }
  } catch (e) { subjectsData = fallbackSubjects; }

  document.getElementById('academicYearSelect').addEventListener('change', () => { populateSemesters(); populateSubjects(); });
  document.getElementById('semesterSelect').addEventListener('change', populateSubjects);
  document.getElementById('subjectSelect').addEventListener('change', ()=>{});
  // seed selects
  populateSemesters();
  populateSubjects();
});
