import { themeService } from '../services/theme.js';
import { onAuth } from '../docs/firebase-init.js';

class IndexPage {
  constructor() {
    this.init();
  }

  init() {
    this.setupTheme();
    this.setupAuthRedirect();
  }

  setupTheme() {
    // Initialize theme service
    themeService.init();
  }

  setupAuthRedirect() {
    // Optional redirect if already logged in
    let redirected = false;
    onAuth(user => {
      if (redirected) return;
      if (user) {
        redirected = true;
        setTimeout(() => location.href = 'home.html', 250);
      }
    });
  }
}

// Initialize the index page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new IndexPage();
});
