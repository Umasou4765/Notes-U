// Application Configuration
export const APP_CONFIG = {
  // App metadata
  name: 'Notes-U',
  version: '1.0.0',
  description: 'A modern note sharing platform for students',
  
  // API configuration
  api: {
    baseURL: '/api',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // Authentication
  auth: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    refreshTokenInterval: 15 * 60 * 1000, // 15 minutes
    loginRedirectPath: '/auth.html?mode=login'
  },
  
  // File upload
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['pdf', 'doc', 'docx', 'txt', 'md'],
    maxFilesPerUpload: 1,
    chunkSize: 1024 * 1024 // 1MB chunks
  },
  
  // UI/UX settings
  ui: {
    theme: {
      default: 'light',
      storageKey: 'theme'
    },
    animations: {
      enabled: true,
      duration: 300
    },
    search: {
      debounceDelay: 300,
      minSearchLength: 2
    },
    pagination: {
      itemsPerPage: 12,
      maxVisiblePages: 5
    }
  },
  
  // Feature flags
  features: {
    darkMode: true,
    search: true,
    categories: true,
    fileUpload: true,
    userProfiles: false,
    comments: false,
    ratings: false
  },
  
  // Error handling
  errors: {
    showStackTraces: false,
    logToConsole: true,
    reportToServer: false
  },
  
  // Performance
  performance: {
    lazyLoading: true,
    imageOptimization: true,
    caching: {
      enabled: true,
      duration: 5 * 60 * 1000 // 5 minutes
    }
  }
};

// Environment-specific overrides
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

if (isDevelopment) {
  APP_CONFIG.errors.showStackTraces = true;
  APP_CONFIG.errors.logToConsole = true;
  APP_CONFIG.performance.caching.duration = 0; // Disable caching in development
}

// Export individual config sections for easier imports
export const { api, auth, upload, ui, features, errors, performance } = APP_CONFIG;
