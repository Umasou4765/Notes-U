/*
 * File: docs/js/auth.js
 * Description: Authentication page logic - sign up, log in, password reset, and UI state management.
 * Notes: Keeps DOM-only logic and uses Firebase helper functions for auth operations.
 */

import { signupWithEmail, loginWithEmail, friendlyError, onAuth, sendPasswordReset } from './services/firebase.js';

// Theme handling (kept light-weight and reusable)
function applyTheme(dark) {
  document.body.classList.toggle('dark', !!dark);
  document.body.classList.toggle('light', !dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
(function initTheme(){
  const stored = localStorage.getItem('theme');
  if(stored) applyTheme(stored === 'dark');
  else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{
    if(!localStorage.getItem('theme')) applyTheme(e.matches);
  });
  window.addEventListener('storage', e=>{
    if(e.key==='theme' && e.newValue) applyTheme(e.newValue === 'dark');
  });
})();

// Wire shared theme toggle button by id (keep compatible with index.js)
const themeToggleBtn = document.getElementById('theme-toggle');
themeToggleBtn?.addEventListener('click', ()=> applyTheme(!document.body.classList.contains('dark')));

// Button text helpers: safely set/reset text without assuming inner span elements
function setBtnLoading(btn, loadingText){ if(!btn) return; btn.dataset.orig = btn.dataset.orig || (btn.textContent || ''); btn.disabled = true; btn.textContent = loadingText; }
function resetBtn(btn, defaultText){ if(!btn) return; btn.disabled = false; btn.textContent = defaultText || (btn.dataset.orig || ''); }

// ----- DOM Helpers -----
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const forgotForm = document.getElementById('forgotForm');
const forgotPanel = document.getElementById('forgotPanel');
const globalStatus = document.getElementById('globalStatus');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const forgotBtn = document.getElementById('forgotBtn');
const forgotStatus = document.getElementById('forgotStatus');
const linkToSignup = document.getElementById('linkToSignup');
const linkToLogin = document.getElementById('linkToLogin');
const closeForgot = document.getElementById('closeForgot');

function setGlobalStatus(msg = '', kind = ''){
  globalStatus.textContent = msg;
  globalStatus.className = 'auth-status' + (kind ? ' ' + kind : '');
}
function showErr(id, msg){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg || '';
  el.classList.toggle('show', !!msg);
}

function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

// Mode switching
function detectMode(){
  const qs = window.location.search;
  if(/\?signup\b/i.test(qs)) return 'signup';
  if(/\?login\b/i.test(qs)) return 'login';
  const p = new URLSearchParams(qs).get('mode');
  return p === 'signup' ? 'signup' : 'login';
}
let mode = detectMode();
function applyMode(m){
  mode = m;
  const isSignup = m === 'signup';
  loginForm.classList.toggle('active', !isSignup);
  signupForm.classList.toggle('active', isSignup);
  loginForm.hidden = isSignup;
  signupForm.hidden = !isSignup;
  linkToSignup.style.display = isSignup ? 'none' : 'block';
  linkToLogin.style.display = isSignup ? 'block' : 'none';
  forgotPanel.hidden = true;
  forgotPanel.classList.remove('active');
  const authHeading = document.getElementById('authHeading');
  const authLead = document.getElementById('authLead');
  if(isSignup){
    authHeading.textContent = 'Create Your Account';
    authLead.textContent = 'Sign up with your email to start uploading and managing your notes.';
  } else {
    authHeading.textContent = 'Welcome Back';
    authLead.textContent = 'Log in to access and manage your academic notes.';
  }
  setGlobalStatus();
}
applyMode(mode);
linkToSignup?.addEventListener('click', e=>{ e.preventDefault(); applyMode('signup'); });
linkToLogin?.addEventListener('click', e=>{ e.preventDefault(); applyMode('login'); });

// Password visibility toggle (delegated)
document.addEventListener('click', e=>{
  const btn = e.target.closest('.toggle-pass');
  if(!btn) return;
  const input = document.getElementById(btn.dataset.target);
  if(!input) return;
  if(input.type === 'password'){
    input.type = 'text'; btn.textContent = 'Hide';
  } else {
    input.type = 'password'; btn.textContent = 'Show';
  }
  input.focus({ preventScroll:true });
});

// LOGIN handler
loginForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  setGlobalStatus();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  let ok = true;
  if(!email || !validEmail(email)){ showErr('login-email-error','Valid email required.'); ok=false; } else showErr('login-email-error','');
  if(!pass){ showErr('login-password-error','Password required.'); ok=false; } else showErr('login-password-error','');
  if(!ok) return;
  setBtnLoading(loginBtn, 'Logging In...');
  try {
    await loginWithEmail(email, pass);
    setGlobalStatus('Login successful. Redirecting...', 'ok');
    setTimeout(()=> location.href='home.html', 450);
  } catch (err){
    setGlobalStatus(friendlyError(err), 'err');
    resetBtn(loginBtn, 'Log In');
  }
});

// SIGNUP handler
signupForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  setGlobalStatus();
  const email = document.getElementById('signup-email').value.trim();
  const pass = document.getElementById('signup-password').value;
  const conf = document.getElementById('signup-confirm').value;
  let ok = true;
  if(!validEmail(email)){ showErr('signup-email-error','Enter a valid email.'); ok=false; } else showErr('signup-email-error','');
  if(pass.length < 8){ showErr('signup-password-error','At least 8 characters required.'); ok=false; } else showErr('signup-password-error','');
  if(conf !== pass){ showErr('signup-confirm-error','Passwords do not match.'); ok=false; } else showErr('signup-confirm-error','');
  if(!ok) return;
  setBtnLoading(signupBtn, 'Creating...');
  try {
    await signupWithEmail(email, pass);
    setGlobalStatus('Account created! Redirecting...', 'ok');
    setTimeout(()=> location.href='home.html', 550);
  } catch (err){
    setGlobalStatus(friendlyError(err), 'err');
    resetBtn(signupBtn, 'Create Account');
  }
});

// FORGOT PASSWORD
forgotForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if(!validEmail(email)){
    document.getElementById('forgot-email-error').textContent = 'Valid email required.'; return;
  } else document.getElementById('forgot-email-error').textContent = '';
  setBtnLoading(forgotBtn, 'Sending...');
  forgotStatus.textContent = '';
  forgotStatus.className = 'status-line';
  try {
    await sendPasswordReset(email);
    forgotStatus.textContent = 'Reset link sent (check inbox / spam).';
    forgotStatus.className = 'status-line ok';
  } catch (err){
    forgotStatus.textContent = friendlyError(err);
    forgotStatus.className = 'status-line err';
  } finally {
    resetBtn(forgotBtn, 'Send Reset Link');
  }
});

// OPEN/CLOSE forgot panel
document.getElementById('forgotLink')?.addEventListener('click', e=>{ e.preventDefault(); forgotPanel.hidden=false; forgotPanel.classList.add('active'); document.getElementById('forgot-email')?.focus(); setGlobalStatus(); });
document.getElementById('closeForgot')?.addEventListener('click', e=>{ e.preventDefault(); forgotPanel.hidden=true; forgotPanel.classList.remove('active'); forgotStatus.textContent=''; });

// AUTH STATE: Use service wrapper which calls onAuthStateChanged
onAuth(user => {
  if(user) location.href = 'home.html';
});
