// app.js

// --- Theme Toggling Module ---
const themeModule = (() => {
    let themeToggleButton = null; // Declare as null initially
    let sunIcon = null;
    let moonIcon = null;

    const setTheme = (isDark) => {
        if (document.body) { // Ensure body exists
            if (isDark) {
                document.body.classList.add("dark");
                if (sunIcon) sunIcon.style.display = "block";
                if (moonIcon) moonIcon.style.display = "none";
            } else {
                document.body.classList.remove("dark");
                if (sunIcon) sunIcon.style.display = "none";
                if (moonIcon) moonIcon.style.display = "block";
            }
        }
    };

    const toggleTheme = () => {
        const isDark = document.body.classList.toggle("dark");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        setTheme(isDark);
    };

    const initializeTheme = () => {
        // Get elements only when initializing
        themeToggleButton = document.getElementById("theme-toggle");
        if (themeToggleButton) {
            sunIcon = themeToggleButton.querySelector(".sun-icon");
            moonIcon = themeToggleButton.querySelector(".moon-icon");
        }

        const storedTheme = localStorage.getItem("theme");

        if (storedTheme === "dark") {
            setTheme(true);
        } else if (storedTheme === "light") {
            setTheme(false);
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setTheme(true);
            } else {
                setTheme(false);
            }
        }
    };

    const setupListeners = () => {
        if (themeToggleButton) { // Only add listener if button exists
            themeToggleButton.addEventListener("click", toggleTheme);
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (!localStorage.getItem("theme")) {
                setTheme(event.matches);
            }
        });
    };

    return {
        init: () => {
            // Defer element fetching and listener setup until DOMContentLoaded
            // This is already handled by the global DOMContentLoaded listener below
            // but ensuring calls within init() are robust.
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
        if (fileUploadArea) {
            fileUploadArea.addEventListener('click', () => {
                if (fileInput) fileInput.click();
            });

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
                    if (fileInput) fileInput.files = e.dataTransfer.files;
                    updateFileDisplay();
                }
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', updateFileDisplay);
        }
    };

    return {
        init: () => {
            if (fileInput && fileUploadArea && uploadPrompt && fileInfo) { // Ensure all necessary elements exist
                setupListeners();
                updateFileDisplay();
            }
        },
        reset: updateFileDisplay
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

        if (!element) { // Element might not exist on the current page
            return true; // Consider valid if element isn't present
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
            // Only validate if the element actually exists on the page
            if (field.element && !validateField(field.element, field.error)) {
                formIsValid = false;
            }
        });

        if (formIsValid) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
            }

            setTimeout(() => {
                alert('Notes uploaded successfully!');
                if (form) form.reset();
                if (fileUploadModule && fileUploadModule.reset) {
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

            if (yearSelect) yearSelect.addEventListener('change', () => validateField(yearSelect, 'yearError'));
            if (semesterSelect) semesterSelect.addEventListener('change', () => validateField(semesterSelect, 'semesterError'));
            if (subjectInput) subjectInput.addEventListener('input', () => validateField(subjectInput, 'subjectError'));
            if (fileInput) fileInput.addEventListener('change', () => validateField(fileInput, 'fileError'));
        }
    };

    return {
        init: () => {
            if (form) {
                setupListeners();
            }
        }
    };
})();

// --- Universal Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    themeModule.init();
    fileUploadModule.init();
    formModule.init();
});
