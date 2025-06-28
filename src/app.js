// app.js

// --- Theme Toggling Module ---
const themeModule = (() => {
    const themeToggleButton = document.getElementById("theme-toggle");

    // Sets the theme class on the body and updates localStorage
    const setTheme = (isDark) => {
        document.body.classList.toggle("dark", isDark); // Adds 'dark' if isDark is true, removes if false
        localStorage.setItem("theme", isDark ? "dark" : "light");
    };

    // Toggles the theme based on the current state
    const toggleTheme = () => {
        const isDark = !document.body.classList.contains("dark"); // Determine new state
        setTheme(isDark); // Apply the new theme
    };

    // Initializes the theme based on stored preference or system preference
    const initializeTheme = () => {
        const storedTheme = localStorage.getItem("theme");

        if (storedTheme) {
            // If a preference is stored, use it
            setTheme(storedTheme === "dark");
        } else {
            // If no preference, use system preference
            setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
    };

    // Sets up event listeners for the theme toggle and system preference changes
    const setupListeners = () => {
        if (themeToggleButton) {
            themeToggleButton.addEventListener("click", toggleTheme);
        }

        // Listen for changes in system theme preference
        // Only update if the user hasn't explicitly set a preference (i.e., no 'theme' in localStorage)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
            if (!localStorage.getItem("theme")) { // Only react to system changes if no user preference
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

---

// --- File Upload Module ---
// This module will only initialize and run if its specific HTML elements are present on the page.
const fileUploadModule = (() => {
    const fileInput = document.getElementById('file');
    const fileUploadArea = document.getElementById('fileUploadArea');

    // If critical elements are not found, return an empty init function to prevent errors
    if (!fileInput || !fileUploadArea) {
        return { init: () => {}, reset: () => {} };
    }

    const uploadPrompt = document.getElementById('uploadPrompt');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameDisplay = document.getElementById('fileName');
    const fileSizeDisplay = document.getElementById('fileSize');
    // fileErrorDisplay is managed by the form validation module, but we can make sure it's hidden here on successful upload display
    const fileErrorDisplay = document.getElementById('fileError'); 

    // Formats file size into human-readable units (KB, MB, GB)
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    // Updates the display based on whether a file is selected
    const updateFileDisplay = () => {
        const file = fileInput.files[0];
        if (file) {
            if (fileNameDisplay) fileNameDisplay.textContent = file.name;
            if (fileSizeDisplay) fileSizeDisplay.textContent = formatFileSize(file.size);
            if (uploadPrompt) uploadPrompt.classList.add('hidden');
            if (fileInfo) fileInfo.classList.remove('hidden');
            if (fileErrorDisplay) fileErrorDisplay.classList.add('hidden'); // Hide error if file is present
        } else {
            // No file selected or cleared
            if (uploadPrompt) uploadPrompt.classList.remove('hidden');
            if (fileInfo) fileInfo.classList.add('hidden');
        }
    };

    // Sets up event listeners for file input and drag-and-drop
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
                // Manually trigger change event for validation module to pick up the drop
                fileInput.dispatchEvent(new Event('change'));
            }
        });
        fileInput.addEventListener('change', updateFileDisplay);
    };

    return {
        init: () => {
            setupListeners();
            updateFileDisplay(); // Set initial display on load
        },
        reset: () => { // Expose a reset method for form module
            fileInput.value = ''; // Clear file input
            updateFileDisplay(); // Reset display
        }
    };
})();

---

// --- Form Validation and Submission Module ---
// This module will only initialize and run if its specific HTML elements are present on the page.
const formModule = (() => {
    const form = document.getElementById('uploadForm');
    
    // If the form element is not found, return an empty init function
    if (!form) {
        return { init: () => {} };
    }

    const submitBtn = document.getElementById('submitBtn');

    // Helper to get an element by ID
    const getElement = (id) => document.getElementById(id);

    // Validates a single form field and shows/hides its error message
    const validateField = (element, errorId) => {
        const errorElement = getElement(errorId);
        let isValid = true;

        if (!element) {
            // Log an error if an expected element is missing, but don't stop validation
            console.warn(`Validation element with ID ${element.id} not found.`);
            return true;
        }

        if (element.type === 'file') {
            isValid = element.files.length > 0;
        } else {
            isValid = element.value.trim() !== '';
        }

        if (errorElement) {
            errorElement.classList.toggle('hidden', isValid);
        }
        return isValid;
    };

    // Handles form submission, performs validation, and simulates API call
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission

        let formIsValid = true;
        const fieldsToValidate = [
            { elementId: 'year', errorId: 'yearError' },
            { elementId: 'semester', errorId: 'semesterError' },
            { elementId: 'subject', errorId: 'subjectError' },
            { elementId: 'file', errorId: 'fileError' }
        ];

        // Validate all relevant fields
        fieldsToValidate.forEach(field => {
            const element = getElement(field.elementId);
            if (element && !validateField(element, field.errorId)) {
                formIsValid = false;
            }
        });

        if (formIsValid) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
            }

            try {
                // Simulate an asynchronous API call
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                alert('Notes uploaded successfully!');
                form.reset(); // Reset the form
                fileUploadModule.reset(); // Reset the file upload display

            } catch (error) {
                console.error("Upload failed:", error);
                alert('Failed to upload notes. Please try again.');
            } finally {
                // Re-enable button and reset text regardless of success or failure
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Notes';
                }
            }
        }
    };

    // Sets up event listeners for form submission and individual field changes
    const setupListeners = () => {
        form.addEventListener('submit', handleSubmit);

        const yearSelect = getElement('year');
        const semesterSelect = getElement('semester');
        const subjectInput = getElement('subject');
        const fileInput = getElement('file'); // Reference to the file input

        // Add event listeners for instant validation on change/input
        if (yearSelect) yearSelect.addEventListener('change', () => validateField(yearSelect, 'yearError'));
        if (semesterSelect) semesterSelect.addEventListener('change', () => validateField(semesterSelect, 'semesterError'));
        if (subjectInput) subjectInput.addEventListener('input', () => validateField(subjectInput, 'subjectError'));
        // Ensure file input change also triggers validation, especially for drag-and-drop
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
    // Initialize all modules that might be present on a page
    themeModule.init();
    fileUploadModule.init();
    formModule.init();
});
