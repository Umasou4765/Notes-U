(function(){
  const body = document.body;
  function applyTheme(theme){
    body.classList.remove('light','dark');
    body.classList.add(theme);
    localStorage.setItem('theme', theme);
  }
  function initTheme(){
    const stored = localStorage.getItem('theme');
    if(stored){
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
    syncIcons();
  }
  function syncIcons(){
    const isDark = body.classList.contains('dark');
    const sun = document.querySelector('.sun-icon');
    const moon = document.querySelector('.moon-icon');
    if(sun && moon){
      sun.style.display = isDark ? 'block':'none';
      moon.style.display = isDark ? 'none':'block';
    }
  }
  document.addEventListener('click',(e)=>{
    if(e.target.closest('#theme-toggle')){
      const isDark = body.classList.toggle('dark');
      body.classList.toggle('light', !isDark);
      localStorage.setItem('theme', isDark ? 'dark':'light');
      syncIcons();
    }
  });
  window.addEventListener('storage', (e)=>{
    if(e.key==='theme' && e.newValue){
      applyTheme(e.newValue);
      syncIcons();
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{
    if(!localStorage.getItem('theme')){
      applyTheme(e.matches ? 'dark':'light');
      syncIcons();
    }
  });
  document.addEventListener('DOMContentLoaded', initTheme);
})();