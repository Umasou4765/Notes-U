// DOM utility functions
export const dom = {
  // Element selection with error handling
  getElement: (selector, parent = document) => {
    const element = parent.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return element;
  },

  getElements: (selector, parent = document) => {
    return Array.from(parent.querySelectorAll(selector));
  },

  // Safe element selection (returns null if not found)
  safeGetElement: (selector, parent = document) => {
    return parent.querySelector(selector);
  },

  // Create element with attributes
  createElement: (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key.startsWith('on')) {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        element.setAttribute(key, value);
      }
    });

    // Add children
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });

    return element;
  },

  // HTML escaping
  escapeHtml: (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  },

  // Show/hide elements
  show: (element) => {
    if (element) element.style.display = '';
  },

  hide: (element) => {
    if (element) element.style.display = 'none';
  },

  toggle: (element, show = null) => {
    if (element) {
      if (show === null) {
        element.style.display = element.style.display === 'none' ? '' : 'none';
      } else {
        element.style.display = show ? '' : 'none';
      }
    }
  },

  // Add/remove classes
  addClass: (element, className) => {
    if (element) element.classList.add(className);
  },

  removeClass: (element, className) => {
    if (element) element.classList.remove(className);
  },

  toggleClass: (element, className, force = null) => {
    if (element) element.classList.toggle(className, force);
  },

  // Event handling
  on: (element, event, handler, options = {}) => {
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
  },

  // Debounced event handler
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttled event handler
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};
