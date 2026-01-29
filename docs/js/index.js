/*
 * File: docs/js/index.js
 * Description: Landing page small logic - theme toggle and optional redirect if a user is already authenticated.
 */
import { onAuth } from './services/firebase.js';

function applyTheme(dark){
  document.body.classList.toggle('dark', dark);
  document.body.classList.toggle('light', !dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
function initTheme(){
  const stored = localStorage.getItem('theme');
  if(stored === 'dark') applyTheme(true);
  else if(stored === 'light') applyTheme(false);
  else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{
    if(!localStorage.getItem('theme')){
      applyTheme(e.matches);
    }
  });
  window.addEventListener('storage', e=>{
    if(e.key==='theme' && e.newValue){
      applyTheme(e.newValue==='dark');
    }
  });
}
initTheme();

const toggleBtn = document.getElementById('theme-toggle');
let spin = 0;
toggleBtn?.addEventListener('click', ()=>{
  const willBeDark = !document.body.classList.contains('dark');
  applyTheme(willBeDark);
  // playful spin effect
  spin += 360;
  toggleBtn.style.transform = `rotate(${spin}deg)`;
  setTimeout(()=>{ toggleBtn.style.transform=''; }, 650);
}, { passive:true });

// Optional redirect if already logged in
let redirected = false;
onAuth(user => {
  if(redirected) return;
  if(user){
    redirected = true;
    setTimeout(()=> location.href='home.html', 250);
  }
});