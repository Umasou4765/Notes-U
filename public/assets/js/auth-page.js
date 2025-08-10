import { initTheme } from './theme.js';
import { apiFetch } from './api.js';
import { showToast } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'signup' ? 'signup' : 'login';

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const titleEl = document.getElementById('auth-title');
  const descEl = document.getElementById('auth-description');

  function setMode(m) {
    if (m === 'signup') {
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      titleEl.textContent = 'Sign Up for Note-U';
      descEl.textContent = 'Create your account to access shared academic notes.';
    } else {
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
      titleEl.textContent = 'Log In to Note-U';
      descEl.textContent = 'Access your shared academic notes with your account.';
    }
  }

  setMode(mode);

  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const password = e.target.password.value;
    if (!username || !password) return showToast('Fill all fields', 'error');
    try {
      const res = await apiFetch('/api/login', { method:'POST', body:{ username, password } });
      showToast(res.message, 'success');
      window.location.href = res.data.redirect;
    } catch {}
  });

  signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const password = e.target.password.value;
    const confirm = e.target.confirm.value;
    if (password !== confirm) return showToast('Passwords do not match.', 'error');
    try {
      const res = await apiFetch('/api/signup', { method:'POST', body:{ username, password } });
      showToast(res.message, 'success');
      setTimeout(() => {
        window.location.href = '/auth.html?mode=login';
      }, 700);
    } catch {}
  });
});