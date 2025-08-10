// Centralized API helper wrappers with consistent error handling.

async function apiRequest(url, options = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  if (options.body && typeof options.body !== 'string') {
    options.body = JSON.stringify(options.body);
    options.headers = { ...defaultHeaders, ...(options.headers||{}) };
  }
  const res = await fetch(url, { credentials: 'include', ...options });
  let data = null;
  try {
    data = await res.clone().json();
  } catch (_) {
    // Non-JSON response; ignore
  }
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

// AUTH
export async function signup(username, password) {
  return apiRequest('/api/signup', {
    method: 'POST',
    body: { username, password }
  });
}
export async function login(username, password) {
  return apiRequest('/api/login', {
    method: 'POST',
    body: { username, password }
  });
}
export async function logout() {
  // Returns redirect; we'll just call and then navigate
  const res = await fetch('/api/logout', { credentials: 'include' });
  if (!res.ok) throw new Error('Logout failed');
  return true;
}
export async function getUser() {
  return apiRequest('/api/user');
}

// NOTES
export async function fetchNotes() {
  return apiRequest('/api/notes');
}
export async function uploadNote(formData) {
  const res = await fetch('/api/upload_note', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const d = await res.json();
      msg = d.message || d.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}