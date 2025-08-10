import { initTheme } from './theme.js';
import { apiFetch } from './api.js';
import { showToast } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const form = document.getElementById('uploadForm');
  const yearSelect = document.getElementById('academicYearSelect');
  const semesterSelect = document.getElementById('semesterSelect');
  const subjectSelect = document.getElementById('subjectSelect');
  const notesTypeSelect = document.getElementById('notesType');
  const descInput = document.getElementById('description');
  const fileInput = document.getElementById('fileUpload');
  const uploadBox = document.getElementById('fileUploadBox');
  const fileInfo = document.getElementById('fileInfo');
  const fileNameSpan = document.getElementById('fileName');
  const submitBtn = form.querySelector('button[type=submit]');

  let subjectsData = {};

  async function loadSubjects() {
    const res = await fetch('/assets/data/subjects.json');
    subjectsData = await res.json();
  }

  function populateSemesters() {
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    semesterSelect.disabled = true;
    subjectSelect.disabled = true;
    const y = yearSelect.value;
    if (!y || !subjectsData[y]) return;
    Object.keys(subjectsData[y]).forEach(sem => {
      const opt = document.createElement('option');
      opt.value = sem;
      opt.textContent = sem.replace('semester','Semester ');
      semesterSelect.appendChild(opt);
    });
    semesterSelect.disabled = false;
  }

  function populateSubjects() {
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    subjectSelect.disabled = true;
    const y = yearSelect.value;
    const sem = semesterSelect.value;
    if (!y || !sem || !subjectsData[y] || !subjectsData[y][sem]) return;
    subjectsData[y][sem].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.code;
      opt.textContent = `${s.code} - ${s.name}`;
      subjectSelect.appendChild(opt);
    });
    subjectSelect.disabled = false;
  }

  function updateFileUI(file) {
    if (file) {
      fileNameSpan.textContent = file.name;
      fileInfo.style.display = 'flex';
    } else {
      fileNameSpan.textContent = '';
      fileInfo.style.display = 'none';
    }
  }

  uploadBox.addEventListener('click', () => fileInput.click());
  uploadBox.addEventListener('dragover', e => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
  });
  uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
  uploadBox.addEventListener('drop', e => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileUI(fileInput.files[0]);
    }
  });
  fileInput.addEventListener('change', () => updateFileUI(fileInput.files[0]));

  function validate() {
    if (!yearSelect.value) return false;
    if (!semesterSelect.value) return false;
    if (!subjectSelect.value) return false;
    if (!notesTypeSelect.value) return false;
    if (!fileInput.files.length) return false;
    return true;
  }

  form.addEventListener('input', () => {
    submitBtn.disabled = !validate();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please complete all required fields.', 'error');
      return;
    }
    const file = fileInput.files[0];
    const defaultTitle = file.name.split('.').slice(0, -1).join('.') || 'Untitled';
    const fd = new FormData();
    fd.append('academicYear', yearSelect.value);
    fd.append('semester', semesterSelect.value);
    fd.append('subject', subjectSelect.value);
    fd.append('notesType', notesTypeSelect.value);
    fd.append('description', descInput.value);
    fd.append('title', defaultTitle);
    fd.append('file', file);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    try {
      await apiFetch('/api/notes/upload', { method:'POST', body: fd, isForm:true });
      showToast('Upload successful!', 'success');
      setTimeout(()=> window.location.href = '/home.html', 750);
    } catch {
      // error toast already shown
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Notes';
    }
  });

  (async function init() {
    await loadSubjects();
    populateSemesters();
    populateSubjects();
    submitBtn.disabled = true;
  })();

  yearSelect.addEventListener('change', () => {
    populateSemesters();
    populateSubjects();
  });
  semesterSelect.addEventListener('change', populateSubjects);
});