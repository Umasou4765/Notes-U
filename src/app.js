// app.js

const themeModule = (() => {
    const themeToggleButton = document.getElementById("theme-toggle");
    
    if (!themeToggleButton) {
        return {
            init: () => {}
        };
    }

    const setTheme = (isDark) => {
        document.body.classList.toggle("dark", isDark);
        localStorage.setItem("theme", isDark ? "dark" : "light");
    };

    const toggleTheme = () => {
        const isDark = !document.body.classList.contains("dark");
        setTheme(isDark);
    };

    const initializeTheme = () => {
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme) {
            setTheme(storedTheme === "dark");
        } else {
            setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
    };

    const setupListeners = () => {
        themeToggleButton.addEventListener("click", toggleTheme);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
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

document.addEventListener('DOMContentLoaded', () => {
    themeModule.init();
});
