// app.js

// --- Theme Toggling Module ---
const themeModule = (() => {
    const themeToggleButton = document.getElementById("theme-toggle");

    const setTheme = (isDark) => {
        if (isDark) {
            document.body.classList.add("dark");
        } else {
            document.body.classList.remove("dark");
        }
        // CSS rules handle the sun/moon icon display based on the 'dark' class
    };

    const toggleTheme = () => {
        const isDark = document.body.classList.toggle("dark"); // This toggles the class
        localStorage.setItem("theme", isDark ? "dark" : "light");
        // The CSS will react to the class change automatically, no need to call setTheme here.
    };

    const initializeTheme = () => {
        const storedTheme = localStorage.getItem("theme");

        if (storedTheme === "dark") {
            setTheme(true);
        } else if (storedTheme === "light") {
            setTheme(false);
        } else {
            // If no preference stored, check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setTheme(true);
            } else {
                setTheme(false);
            }
        }
    };

    const setupListeners = () => {
        if (themeToggleButton) {
            themeToggleButton.addEventListener("click", toggleTheme);
        }

        // Listen for changes in system theme preference
        // Only update if the user hasn't explicitly set a preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (!localStorage.getItem("theme")) {
                setTheme(event.matches);
            }
        });
    };

    return {
        init: () => {
            initializeTheme();
            setupListeners();
        }
    };
})();

// --- File Upload Module ---
// This module will only initialize and run if its specific HTML elements are present on the page.
const fileUploadModule = (() => {
    // Check if the relevant elements exist before proceeding
    const fileInput = document.getElementById('file');
    const fileUploadArea = document.getElementById('fileUploadArea');

    // If elements are not found, return an empty init function so it does nothing
    if (!fileInput || !fileUploadArea) {
        return { init: () => {}, reset: () => {} };
    }

    const uploadPrompt = document.getElementById('uploadPrompt');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameDisplay = document.getElementById('fileName');
    const fileSizeDisplay = document.getElementById('fileSize');
    const fileErrorDisplay = document.getElementById('fileError');

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const updateFileDisplay = () => {
        const file = fileInput.files[0]; // fileInput is guaranteed to exist here
        if (file) {
            if (fileNameDisplay) fileNameDisplay.textContent = file.name;
            if (fileSizeDisplay) fileSizeDisplay.textContent = formatFileSize(file.size);
            if (uploadPrompt) uploadPrompt.classList.add('hidden');
            if (fileInfo) fileInfo.classList.remove('hidden');
            if (fileErrorDisplay) fileErrorDisplay.classList.add('hidden');
        } else {
            if (uploadPrompt) uploadPrompt.classList.remove('hidden');
            if (fileInfo) fileInfo.classList.add('hidden');
        }
    };

    const setupListeners = () => {
        fileUploadArea.addEventListener('click', () => fileInput.click());

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                updateFileDisplay();
            }
        });
        fileInput.addEventListener('change', updateFileDisplay);
    };

    return {
        init: () => {
            setupListeners();
            updateFileDisplay(); // Set initial display
        },
        reset: updateFileDisplay // Expose reset for form module
    };
})();


// --- Form Validation and Submission Module ---
// This module will only initialize and run if its specific HTML elements are present on the page.
const formModule = (() => {
    const form = document.getElementById('uploadForm');
    
    // If form is not found, return an empty init function so it does nothing
    if (!form) {
        return { init: () => {} };
    }

    const submitBtn = document.getElementById('submitBtn');

    const getField = (id) => document.getElementById(id);
    const getErrorDisplay = (id) => document.getElementById(id);

    const validateField = (element, errorId) => {
        const errorElement = getErrorDisplay(errorId);
        let isValid = true;

        if (!element) { // Should ideally not happen if fieldsToValidate are chosen carefully
            return true;
        }

        if (element.type === 'file') {
            if (!element.files.length) {
                isValid = false;
            }
        } else {
            if (!element.value.trim()) {
                isValid = false;
            }
        }

        if (!isValid) {
            if (errorElement) errorElement.classList.remove('hidden');
        } else {
            if (errorElement) errorElement.classList.add('hidden');
        }
        return isValid;
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();

        let formIsValid = true;
        const fieldsToValidate = [
            { element: getField('year'), error: 'yearError' },
            { element: getField('semester'), error: 'semesterError' },
            { element: getField('subject'), error: 'subjectError' },
            { element: getField('file'), error: 'fileError' }
        ];

        fieldsToValidate.forEach(field => {
            // Only validate fields that actually exist on the current page
            if (field.element && !validateField(field.element, field.error)) {
                formIsValid = false;
            }
        });

        if (formIsValid) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
            }

            // Simulate API call
            setTimeout(() => {
                alert('Notes uploaded successfully!');
                form.reset(); // form is guaranteed to exist here
                if (fileUploadModule && fileUploadModule.reset) { // Safely call reset if module exists
                    fileUploadModule.reset();
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Notes';
                }
            }, 2000);
        }
    };

    const setupListeners = () => {
        form.addEventListener('submit', handleSubmit); // form is guaranteed to exist here

        const yearSelect = getField('year');
        const semesterSelect = getField('semester');
        const subjectInput = getField('subject');
        const fileInput = getField('file');

        if (yearSelect) yearSelect.addEventListener('change', () => validateField(yearSelect, 'yearError'));
        if (semesterSelect) semesterSelect.addEventListener('change', () => validateField(semesterSelect, 'semesterError'));
        if (subjectInput) subjectInput.addEventListener('input', () => validateField(subjectInput, 'subjectError'));
        if (fileInput) fileInput.addEventListener('change', () => validateField(fileInput, 'fileError'));
    };

    return {
        init: () => {
            setupListeners();
        }
    };
})();

// --- Universal Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    themeModule.init(); // Initialize theme module on all pages (it will always find the button)
    fileUploadModule.init(); // Initialize file upload module (only runs its setup if elements exist)
    formModule.init(); // Initialize form module (only runs its setup if form exists)
});
