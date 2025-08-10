import { signup, login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') === 'signup' ? 'signup' : 'login';

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authTitle = document.getElementById('auth-title');
  const authDescription = document.getElementById('auth-description');

  function setMode(m){
    if(m === 'signup'){
      signupForm.classList.add('active');
      loginForm.classList.remove('active');
      authTitle.textContent = 'Sign Up for Note-U';
      authDescription.textContent = 'Create your account to access shared academic notes.';
    } else {
      loginForm.classList.add('active');
      signupForm.classList.remove('active');
      authTitle.textContent = 'Log In to Note-U';
      authDescription.textContent = 'Access your shared academic notes with your account.';
    }
  }
  setMode(mode);

  // LOGIN
  const loginFormElement = loginForm.querySelector('form');
  loginFormElement?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-access-code').value;
    if(!username || !password){
      alert('Please fill all fields.');
      return;
    }
    try {
      const data = await login(username, password);
      alert(data.message || 'Login successful');
      window.location.href = data.redirect || '/home.html';
    } catch (err) {
      alert(err.message || 'Login failed');
    }
  });

  // SIGNUP
  const signupFormElement = signupForm.querySelector('form');
  signupFormElement?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const pass = document.getElementById('signup-access-code').value;
    const confirm = document.getElementById('signup-confirm-access-code').value;
    if(!username || !pass){
      alert('Username and password required.');
      return;
    }
    if(pass !== confirm){
      alert('Access codes do not match!');
      return;
    }
    if(pass.length < 8){
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      const data = await signup(username, pass);
      alert(data.message || 'Account created!');
      window.location.href = '/auth.html?mode=login';
    } catch (err) {
      alert(err.message || 'Signup failed');
    }
  });
});