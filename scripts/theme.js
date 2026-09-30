// Theme Manager - Dark & Light Mode Support
(function () {
  const THEME_STORAGE_KEY = "firme_theme";

  // Get current preferred theme (LocalStorage -> System Preference -> Light default)
  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // Apply theme to document root
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeToggleIcons(theme);
  }

  // Update theme toggle button icons across the DOM
  function updateThemeToggleIcons(theme) {
    const toggleButtons = document.querySelectorAll(
      "#themeToggleBtn, .theme-toggle-btn"
    );
    toggleButtons.forEach((btn) => {
      btn.setAttribute(
        "title",
        theme === "dark"
          ? "Comută pe modul luminos (Light mode)"
          : "Comută pe modul întunecat (Dark mode)"
      );
      btn.setAttribute("aria-label", `Mod curent: ${theme}`);

      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = theme === "dark" ? "ri-sun-line" : "ri-moon-line";
      } else {
        const newIcon = document.createElement("i");
        newIcon.className = theme === "dark" ? "ri-sun-line" : "ri-moon-line";
        btn.replaceChildren(newIcon);
      }
    });
  }

  // Toggle theme between dark and light
  window.toggleTheme = function () {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  // Immediate execution on script parse to avoid FOUC
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Listen to OS color scheme changes if user hasn't set an explicit preference
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });

  // Attach event listeners when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || initialTheme;
    updateThemeToggleIcons(currentTheme);

    document.querySelectorAll("#themeToggleBtn, .theme-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.toggleTheme();
      });
    });
  });
})();
