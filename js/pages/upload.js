import { apiService } from '../services/api.js';
import { dom } from '../utils/dom.js';
import { validateFormData, validators } from '../utils/validation.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants.js';

class UploadPage {
  constructor() {
    this.elements = {};
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.ensureAuth();
  }

  setupElements() {
    this.elements = {
      form: dom.safeGetElement('#upload-form'),
      statusEl: dom.getElement('#upload-status'),
      logoutLink: dom.safeGetElement('#logout-link')
    };
  }

  setupEventListeners() {
    // Logout link
    if (this.elements.logoutLink) {
      dom.on(this.elements.logoutLink, 'click', this.handleLogout.bind(this));
    }

    // Form submission
    if (this.elements.form) {
      dom.on(this.elements.form, 'submit', this.handleFormSubmit.bind(this));
    }
  }

  async ensureAuth() {
    try {
      await apiService.getUser();
    } catch (error) {
      window.location.href = '/auth.html?mode=login';
    }
  }

  async handleLogout(event) {
    event.preventDefault();
    try {
      await apiService.logout();
      window.location.href = '/auth.html?mode=login';
    } catch (error) {
      alert(ERROR_MESSAGES.LOGOUT_FAILED);
    }
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    
    // Clear previous status
    this.updateStatus('', 'info');
    
    const formData = new FormData(this.elements.form);
    
    try {
      // Validate form data
      this.validateForm(formData);
      
      // Show uploading status
      this.updateStatus('Uploading...', 'info');
      
      // Upload note
      const result = await apiService.uploadNote(formData);
      
      // Show success message
      this.updateStatus(
        result.message || SUCCESS_MESSAGES.UPLOAD_SUCCESS, 
        'success'
      );
      
      // Reset form
      this.elements.form.reset();
      
    } catch (error) {
      console.error('Upload failed:', error);
      this.updateStatus(
        error.message || ERROR_MESSAGES.UPLOAD_FAILED, 
        'error'
      );
    }
  }

  validateForm(formData) {
    const validationRules = {
      title: [
        validators.required,
        (value) => validators.maxLength(value, 100, 'Title')
      ],
      academicYear: [validators.required],
      semester: [validators.required],
      subject: [validators.required],
      notesType: [validators.required],
      file: [
        validators.required,
        validators.fileType,
        validators.fileSize
      ]
    };

    validateFormData(formData, validationRules);
  }

  updateStatus(message, type = 'info') {
    if (!this.elements.statusEl) return;
    
    this.elements.statusEl.textContent = message;
    
    // Remove existing status classes
    dom.removeClass(this.elements.statusEl, 'status-info');
    dom.removeClass(this.elements.statusEl, 'status-success');
    dom.removeClass(this.elements.statusEl, 'status-error');
    
    // Add appropriate status class
    const statusClass = `status-${type}`;
    dom.addClass(this.elements.statusEl, statusClass);
    
    // Set color based on type
    const colors = {
      info: 'var(--color-text-secondary-light)',
      success: 'green',
      error: 'red'
    };
    
    this.elements.statusEl.style.color = colors[type] || colors.info;
  }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new UploadPage();
});
