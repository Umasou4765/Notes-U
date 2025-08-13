import { APP_CONFIG } from '../utils/constants.js';
import { dom } from '../utils/dom.js';

class ThemeService {
  constructor() {
    this.currentTheme = null;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.applyStoredTheme();
  }

  setupEventListeners() {
    // Theme toggle button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#theme-toggle')) {
        this.toggleTheme();
      }
    });

    // Storage change listener
    window.addEventListener('storage', (e) => {
      if (e.key === APP_CONFIG.STORAGE_KEYS.THEME && e.newValue) {
        this.applyTheme(e.newValue);
      }
    });

    // System preference change listener
    this.mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem(APP_CONFIG.STORAGE_KEYS.THEME)) {
        this.applyTheme(e.matches ? APP_CONFIG.THEMES.DARK : APP_CONFIG.THEMES.LIGHT);
      }
    });
  }

  applyStoredTheme() {
    const storedTheme = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.THEME);
    
    if (storedTheme) {
      this.applyTheme(storedTheme);
    } else {
      const prefersDark = this.mediaQuery.matches;
      this.applyTheme(prefersDark ? APP_CONFIG.THEMES.DARK : APP_CONFIG.THEMES.LIGHT);
    }
  }

  applyTheme(theme) {
    const body = document.body;
    
    // Remove existing theme classes
    dom.removeClass(body, APP_CONFIG.THEMES.LIGHT);
    dom.removeClass(body, APP_CONFIG.THEMES.DARK);
    
    // Add new theme class
    dom.addClass(body, theme);
    
    // Store theme preference
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.THEME, theme);
    
    this.currentTheme = theme;
    this.syncThemeIcons();
  }

  toggleTheme() {
    const isDark = document.body.classList.contains(APP_CONFIG.THEMES.DARK);
    const newTheme = isDark ? APP_CONFIG.THEMES.LIGHT : APP_CONFIG.THEMES.DARK;
    this.applyTheme(newTheme);
  }

  syncThemeIcons() {
    const isDark = this.currentTheme === APP_CONFIG.THEMES.DARK;
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    if (sunIcon && moonIcon) {
      dom.toggle(sunIcon, isDark);
      dom.toggle(moonIcon, !isDark);
    }
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  isDarkTheme() {
    return this.currentTheme === APP_CONFIG.THEMES.DARK;
  }

  isLightTheme() {
    return this.currentTheme === APP_CONFIG.THEMES.LIGHT;
  }
}

// Export singleton instance
export const themeService = new ThemeService();
