import { getUser, uploadNote, logout } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upload-form');
  const statusEl = document.getElementById('upload-status');
  const logoutLink = document.getElementById('logout-link');

  async function ensureAuth(){
    try {
      await getUser();
    } catch {
      window.location.href = '/auth.html?mode=login';
    }
  }

  logoutLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await logout();
      window.location.href = '/auth.html?mode=login';
    } catch {
      alert('Logout failed');
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    const fd = new FormData(form);

    // Basic validation
    const required = ['title','academicYear','semester','subject','notesType','file'];
    for(const field of required){
      if(!fd.get(field)){
        statusEl.textContent = 'Please fill all required fields.';
        statusEl.style.color = 'var(--color-text-secondary-light)';
        return;
      }
    }

    try {
      statusEl.textContent = 'Uploading...';
      statusEl.style.color = 'var(--color-text-secondary-light)';
      const result = await uploadNote(fd);
      statusEl.textContent = result.message || 'Upload successful!';
      statusEl.style.color = 'green';
      form.reset();
    } catch (err) {
      statusEl.textContent = err.message || 'Upload failed.';
      statusEl.style.color = 'red';
    }
  });

  ensureAuth();
});