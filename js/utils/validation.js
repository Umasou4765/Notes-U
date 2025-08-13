import { APP_CONFIG } from './constants.js';

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export const validators = {
  required: (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    return true;
  },

  minLength: (value, minLength, fieldName) => {
    if (value && value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
    }
    return true;
  },

  maxLength: (value, maxLength, fieldName) => {
    if (value && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters`, fieldName);
    }
    return true;
  },

  email: (value, fieldName = 'Email') => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      throw new ValidationError('Please enter a valid email address', fieldName);
    }
    return true;
  },

  fileType: (file, allowedTypes = APP_CONFIG.FILE_TYPES.ALLOWED_EXTENSIONS) => {
    if (!file) return true;
    
    const extension = getFileExtension(file.name);
    if (!allowedTypes.includes(extension.toLowerCase())) {
      throw new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 'file');
    }
    return true;
  },

  fileSize: (file, maxSize = APP_CONFIG.FILE_TYPES.MAX_SIZE) => {
    if (!file) return true;
    
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      throw new ValidationError(`File size must be less than ${maxSizeMB}MB`, 'file');
    }
    return true;
  }
};

export function validateFormData(formData, validationRules) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(validationRules)) {
    const value = formData.get(field);
    
    for (const rule of rules) {
      try {
        if (typeof rule === 'function') {
          rule(value, field);
        } else if (typeof rule === 'object') {
          const { validator, ...params } = rule;
          validator(value, ...Object.values(params), field);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error);
        } else {
          errors.push(new ValidationError(error.message, field));
        }
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join(', '));
  }
  
  return true;
}

function getFileExtension(filename) {
  const name = filename || '';
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}
