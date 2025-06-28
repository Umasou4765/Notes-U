// app.js

// --- Theme Toggling Module ---
const themeModule = (() => {
    const themeToggleButton = document.getElementById("theme-toggle");
    // No need to get sunIcon and moonIcon directly as CSS handles their visibility

    const setTheme = (isDark) => {
        if (isDark) {
            document.body.classList.add("dark");
        } else {
            document.body.classList.remove("dark");
        }
    };

    const toggleTheme = () => {
        const isDark = document.body.classList.toggle("dark"); // This toggles the class
        localStorage.setItem("theme", isDark ? "dark" : "light");
        // The CSS will react to the class change, so no further JS display manipulation is needed here.
    };

    const initializeTheme = () => {
        const storedTheme = localStorage.getItem("theme");

        if (storedTheme === "dark") {
            setTheme(true);
        } else if (storedTheme === "light") {
            setTheme(false);
        } else {
            // Check prefers-color-scheme only if no theme is stored
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
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            // Only update if the user hasn't explicitly set a preference (i.e., localStorage is empty)
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
const fileUploadModule = (() => {
    const fileInput = document.getElementById('file');
    const fileUploadArea = document.getElementById('fileUploadArea');
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
        const file = fileInput ? fileInput.files[0] : null;
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
        // Ensure elements exist before adding listeners
        if (fileInput && fileUploadArea) {
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
        }
    };

    return {
        init: () => {
            if (fileInput && fileUploadArea) { // Only initialize if upload elements exist
                setupListeners();
                updateFileDisplay(); // Set initial display
            }
        },
        reset: updateFileDisplay // Expose reset for form module
    };
})();

// --- Form Validation and Submission Module ---
const formModule = (() => {
    const form = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');

    const getField = (id) => document.getElementById(id);
    const getErrorDisplay = (id) => document.getElementById(id);

    const validateField = (element, errorId) => {
        const errorElement = getErrorDisplay(errorId);
        let isValid = true;

        // Check if element exists before accessing its properties
        if (!element) {
            return true; // Return true if element doesn't exist, so validation doesn't block the form
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
            // Ensure element exists before validation and update formIsValid
            if (!validateField(field.element, field.error)) {
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
                if (form) form.reset();
                // Safely call fileUploadModule.reset() if it exists
                if (typeof fileUploadModule !== 'undefined' && fileUploadModule.reset) {
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
        if (form) {
            form.addEventListener('submit', handleSubmit);

            const yearSelect = getField('year');
            const semesterSelect = getField('semester');
            const subjectInput = getField('subject');
            const fileInput = getField('file');

            // Add listeners only if elements exist
            if (yearSelect) yearSelect.addEventListener('change', () => validateField(yearSelect, 'yearError'));
            if (semesterSelect) semesterSelect.addEventListener('change', () => validateField(semesterSelect, 'semesterError'));
            if (subjectInput) subjectInput.addEventListener('input', () => validateField(subjectInput, 'subjectError'));
            if (fileInput) fileInput.addEventListener('change', () => validateField(fileInput, 'fileError'));
        }
    };

    return {
        init: () => {
            if (form) { // Only initialize if form element exists
                setupListeners();
            }
        }
    };
})();

// --- Universal Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    themeModule.init(); // Initialize theme module on all pages
    fileUploadModule.init(); // Initialize file upload module (only runs if elements exist)
    formModule.init(); // Initialize form module (only runs if form exists)
});
