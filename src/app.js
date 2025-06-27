// src/app.js

document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('uploadForm');
  if (!uploadForm) {
    console.error("Upload form with ID 'uploadForm' not found.");
    return;
  }

  uploadForm.addEventListener('submit', function(e) {
    let valid = true;

    // Year
    const year = document.getElementById('year');
    const yearError = document.getElementById('yearError');
    if (!year.value) {
      yearError.classList.remove('hidden');
      valid = false;
    } else {
      yearError.classList.add('hidden');
    }

    // Semester
    const semester = document.getElementById('semester');
    const semesterError = document.getElementById('semesterError');
    if (!semester.value) {
      semesterError.classList.remove('hidden');
      valid = false;
    } else {
      semesterError.classList.add('hidden');
    }

    // Subject
    const subject = document.getElementById('subject');
    const subjectError = document.getElementById('subjectError');
    if (!subject.value.trim()) {
      subjectError.classList.remove('hidden');
      valid = false;
    } else {
      subjectError.classList.add('hidden');
    }

    // File
    const file = document.getElementById('file');
    const fileError = document.getElementById('fileError');
    if (!file.files.length) {
      fileError.classList.remove('hidden');
      valid = false;
    } else {
      fileError.classList.add('hidden');
    }

    // If not valid, prevent form submission and don't show alert
    if (!valid) {
      e.preventDefault();
      return;
    }

    // If all valid, prevent form submission and show the pop-up prompt
    e.preventDefault();
    alert("🚧 Upload feature is under development. Please check back soon!");
  });
});
