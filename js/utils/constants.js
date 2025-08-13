// Application constants and configuration
export const APP_CONFIG = {
  API_BASE_URL: '/api',
  STORAGE_KEYS: {
    THEME: 'theme',
    USER_PREFERENCES: 'user_preferences'
  },
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark'
  },
  FILE_TYPES: {
    ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx', 'txt', 'md'],
    MAX_SIZE: 10 * 1024 * 1024 // 10MB
  },
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500
  }
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error, please check your connection',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  VALIDATION_ERROR: 'Please check your input and try again',
  UPLOAD_FAILED: 'Upload failed, please try again',
  FETCH_FAILED: 'Failed to load data, please refresh the page',
  LOGOUT_FAILED: 'Logout failed, please try again'
};

export const SUCCESS_MESSAGES = {
  UPLOAD_SUCCESS: 'File uploaded successfully!',
  LOGOUT_SUCCESS: 'Logged out successfully',
  SAVE_SUCCESS: 'Changes saved successfully',
  LOGIN_SUCCESS: 'Login successful!',
  SIGNUP_SUCCESS: 'Account created successfully!'
};
