import { signupWithEmail, loginWithEmail, friendlyError, auth } from '../docs/firebase-init.js';
import { onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { dom } from '../utils/dom.js';
import { validators } from '../utils/validation.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants.js';

class AuthPage {
  constructor() {
    this.currentMode = this.getModeFromURL();
    this.elements = {};
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.setupMode();
    this.checkAuthState();
  }

  setupElements() {
    this.elements = {
      loginForm: dom.safeGetElement('#login-form'),
      signupForm: dom.safeGetElement('#signup-form'),
      resetForm: dom.safeGetElement('#reset-form'),
      modeToggle: dom.safeGetElement('#mode-toggle'),
      resetLink: dom.safeGetElement('#reset-link'),
      backToLogin: dom.safeGetElement('#back-to-login'),
      emailInput: dom.getElement('#email'),
      passwordInput: dom.getElement('#password'),
      confirmPasswordInput: dom.safeGetElement('#confirm-password'),
      statusEl: dom.getElement('#status')
    };
  }

  setupEventListeners() {
    // Form submissions
    if (this.elements.loginForm) {
      dom.on(this.elements.loginForm, 'submit', this.handleLogin.bind(this));
    }

    if (this.elements.signupForm) {
      dom.on(this.elements.signupForm, 'submit', this.handleSignup.bind(this));
    }

    if (this.elements.resetForm) {
      dom.on(this.elements.resetForm, 'submit', this.handlePasswordReset.bind(this));
    }

    // Mode toggle
    if (this.elements.modeToggle) {
      dom.on(this.elements.modeToggle, 'click', this.toggleMode.bind(this));
    }

    // Reset password link
    if (this.elements.resetLink) {
      dom.on(this.elements.resetLink, 'click', this.showResetForm.bind(this));
    }

    // Back to login
    if (this.elements.backToLogin) {
      dom.on(this.elements.backToLogin, 'click', this.showLoginForm.bind(this));
    }

    // Real-time validation
    if (this.elements.emailInput) {
      dom.on(this.elements.emailInput, 'input', this.validateEmail.bind(this));
    }

    if (this.elements.passwordInput) {
      dom.on(this.elements.passwordInput, 'input', this.validatePassword.bind(this));
    }

    if (this.elements.confirmPasswordInput) {
      dom.on(this.elements.confirmPasswordInput, 'input', this.validateConfirmPassword.bind(this));
    }
  }

  getModeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') || 'login';
  }

  setupMode() {
    this.showMode(this.currentMode);
  }

  showMode(mode) {
    const loginSection = dom.safeGetElement('#login-section');
    const signupSection = dom.safeGetElement('#signup-section');
    const resetSection = dom.safeGetElement('#reset-section');

    // Hide all sections
    if (loginSection) dom.hide(loginSection);
    if (signupSection) dom.hide(signupSection);
    if (resetSection) dom.hide(resetSection);

    // Show appropriate section
    switch (mode) {
      case 'signup':
        if (signupSection) dom.show(signupSection);
        break;
      case 'reset':
        if (resetSection) dom.show(resetSection);
        break;
      default:
        if (loginSection) dom.show(loginSection);
        break;
    }

    this.currentMode = mode;
    this.updateURL();
  }

  showLoginForm() {
    this.showMode('login');
  }

  showResetForm() {
    this.showMode('reset');
  }

  toggleMode() {
    const newMode = this.currentMode === 'login' ? 'signup' : 'login';
    this.showMode(newMode);
  }

  updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('mode', this.currentMode);
    window.history.replaceState({}, '', url);
  }

  async checkAuthState() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is already logged in, redirect to home
        window.location.href = 'home.html';
      }
    });
  }

  async handleLogin(event) {
    event.preventDefault();
    this.clearStatus();

    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;

    try {
      // Validate inputs
      this.validateForm({ email, password });

      this.showStatus('Logging in...', 'info');
      
      await loginWithEmail(email, password);
      
      this.showStatus(SUCCESS_MESSAGES.LOGIN_SUCCESS, 'success');
      
      // Redirect to home page
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 1000);

    } catch (error) {
      console.error('Login failed:', error);
      this.showStatus(friendlyError(error), 'error');
    }
  }

  async handleSignup(event) {
    event.preventDefault();
    this.clearStatus();

    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;
    const confirmPassword = this.elements.confirmPasswordInput?.value || '';

    try {
      // Validate inputs
      this.validateForm({ email, password, confirmPassword });

      this.showStatus('Creating account...', 'info');
      
      await signupWithEmail(email, password);
      
      this.showStatus(SUCCESS_MESSAGES.SIGNUP_SUCCESS, 'success');
      
      // Redirect to home page
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 1000);

    } catch (error) {
      console.error('Signup failed:', error);
      this.showStatus(friendlyError(error), 'error');
    }
  }

  async handlePasswordReset(event) {
    event.preventDefault();
    this.clearStatus();

    const email = this.elements.emailInput.value.trim();

    try {
      // Validate email
      validators.email(email, 'Email');

      this.showStatus('Sending reset email...', 'info');
      
      await sendPasswordResetEmail(auth, email);
      
      this.showStatus('Password reset email sent! Check your inbox.', 'success');
      
      // Show back to login option
      setTimeout(() => {
        this.showLoginForm();
      }, 3000);

    } catch (error) {
      console.error('Password reset failed:', error);
      this.showStatus(friendlyError(error), 'error');
    }
  }

  validateForm(data) {
    const errors = [];

    // Email validation
    try {
      validators.email(data.email, 'Email');
    } catch (error) {
      errors.push(error.message);
    }

    // Password validation
    try {
      validators.required(data.password, 'Password');
      validators.minLength(data.password, 6, 'Password');
    } catch (error) {
      errors.push(error.message);
    }

    // Confirm password validation (for signup)
    if (data.confirmPassword !== undefined) {
      try {
        validators.required(data.confirmPassword, 'Confirm Password');
        if (data.password !== data.confirmPassword) {
          errors.push('Passwords do not match');
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  validateEmail() {
    const email = this.elements.emailInput.value.trim();
    try {
      validators.email(email, 'Email');
      this.setFieldValid(this.elements.emailInput, true);
    } catch (error) {
      this.setFieldValid(this.elements.emailInput, false);
    }
  }

  validatePassword() {
    const password = this.elements.passwordInput.value;
    try {
      validators.required(password, 'Password');
      validators.minLength(password, 6, 'Password');
      this.setFieldValid(this.elements.passwordInput, true);
    } catch (error) {
      this.setFieldValid(this.elements.passwordInput, false);
    }
  }

  validateConfirmPassword() {
    const password = this.elements.passwordInput.value;
    const confirmPassword = this.elements.confirmPasswordInput.value;
    
    try {
      validators.required(confirmPassword, 'Confirm Password');
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      this.setFieldValid(this.elements.confirmPasswordInput, true);
    } catch (error) {
      this.setFieldValid(this.elements.confirmPasswordInput, false);
    }
  }

  setFieldValid(field, isValid) {
    if (!field) return;
    
    dom.removeClass(field, 'is-valid');
    dom.removeClass(field, 'is-invalid');
    
    if (isValid) {
      dom.addClass(field, 'is-valid');
    } else {
      dom.addClass(field, 'is-invalid');
    }
  }

  showStatus(message, type = 'info') {
    if (!this.elements.statusEl) return;
    
    this.elements.statusEl.textContent = message;
    dom.removeClass(this.elements.statusEl, 'status-info', 'status-success', 'status-error');
    dom.addClass(this.elements.statusEl, `status-${type}`);
    dom.show(this.elements.statusEl);
  }

  clearStatus() {
    if (this.elements.statusEl) {
      this.elements.statusEl.textContent = '';
      dom.hide(this.elements.statusEl);
    }
  }
}

// Initialize the auth page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthPage();
});
