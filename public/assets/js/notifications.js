const containerId = 'toast-container';

function ensureContainer() {
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    document.body.appendChild(el);
  }
  return el;
}

export function showToast(message, type = 'info', timeout = 4000) {
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button aria-label="Close">&times;</button>
  `;
  toast.querySelector('button').addEventListener('click', () => {
    container.removeChild(toast);
  });
  container.appendChild(toast);
  if (timeout) {
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, timeout);
  }
}

function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}