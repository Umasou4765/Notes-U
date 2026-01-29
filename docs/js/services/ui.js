/*
 * File: docs/js/services/ui.js
 * Description: Small, dependency-free toast utility for non-blocking notifications.
 * API: showToast(message, type='success', duration=3000)
 */

export function showToast(message, type = 'success', duration = 3000) {
  if (!message) return;
  try {
    const wrap = document.createElement('div');
    wrap.className = `toast toast-${type}`;
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.textContent = message;

    // Ensure container exists for stacking multiple toasts
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.position = 'fixed';
      container.style.right = '20px';
      container.style.bottom = '20px';
      container.style.zIndex = '10000';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }

    container.appendChild(wrap);

    // show animation (CSS handles entry); remove after duration
    setTimeout(() => {
      wrap.classList.add('toast-hidden');
      setTimeout(() => wrap.remove(), 350);
    }, duration);
  } catch (e) {
    // If toast rendering fails, log it - do not show blocking alerts from a UI helper
    console.error('showToast failed', e);
  }
}
