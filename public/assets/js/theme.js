export function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    applyTheme(stored);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', e => {
    if (e.key === 'theme') applyTheme(e.newValue);
  });
}

export function toggleTheme() {
  const dark = document.body.classList.contains('dark');
  applyTheme(dark ? 'light' : 'dark', true);
}

export function applyTheme(theme, persist = false) {
  document.body.classList.toggle('dark', theme === 'dark');
  if (persist) localStorage.setItem('theme', theme);
}