import { showToast } from './notifications.js';

export async function apiFetch(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: {
      ...(options.body && !options.isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    credentials: 'same-origin'
  };
  if (options.body) {
    opts.body = options.isForm ? options.body : JSON.stringify(options.body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    showToast('Network error. Check your connection.', 'error');
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON
  }
  if (res.status === 401) {
    window.location.href = '/auth.html?mode=login';
    throw new Error('Unauthorized');
  }
  if (!res.ok || (data && data.success === false)) {
    const msg = data?.error?.message || data?.message || 'Request failed';
    showToast(msg, 'error');
    throw new Error(msg);
  }
  return data;
}