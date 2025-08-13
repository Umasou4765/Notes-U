import { APP_CONFIG, ERROR_MESSAGES } from '../utils/constants.js';

class ApiService {
  constructor(baseURL = APP_CONFIG.API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };

    // Handle FormData differently
    if (options.body instanceof FormData) {
      delete defaultOptions.headers['Content-Type'];
    } else if (options.body && typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }

    const config = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, config);
      return await this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async handleResponse(response) {
    let data = null;
    
    try {
      data = await response.clone().json();
    } catch {
      // Non-JSON response; ignore
    }

    if (!response.ok) {
      const message = (data && (data.error || data.message)) || 
                     response.statusText || 
                     ERROR_MESSAGES.NETWORK_ERROR;
      
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  handleError(error) {
    if (error.status === 401) {
      window.location.href = '/auth.html?mode=login';
      return new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
    return error;
  }

  // Auth endpoints
  async signup(username, password) {
    return this.request('/signup', {
      method: 'POST',
      body: { username, password }
    });
  }

  async login(username, password) {
    return this.request('/login', {
      method: 'POST',
      body: { username, password }
    });
  }

  async logout() {
    const response = await fetch(`${this.baseURL}/logout`, { 
      credentials: 'include' 
    });
    
    if (!response.ok) {
      throw new Error(ERROR_MESSAGES.LOGOUT_FAILED);
    }
    
    return true;
  }

  async getUser() {
    return this.request('/user');
  }

  // Notes endpoints
  async fetchNotes() {
    return this.request('/notes');
  }

  async uploadNote(formData) {
    return this.request('/upload_note', {
      method: 'POST',
      body: formData
    });
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export individual methods for backward compatibility
export const { signup, login, logout, getUser, fetchNotes, uploadNote } = apiService;
