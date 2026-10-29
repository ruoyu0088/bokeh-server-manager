(() => {
  "use strict";

  const { t, setLanguage, applyTranslations } = window.BSM_I18N;
  const closeButton = document.querySelector("#info-close");
  const projectTitle = document.body.dataset.projectTitle || "";

  function applyTheme(theme) {
    document.documentElement.dataset.theme =
      theme === "dark" ? "dark" : "light";
  }

  function storedTheme() {
    try {
      return localStorage.getItem("bsm-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function refreshText() {
    applyTranslations();
    document.title = projectTitle
      ? `${projectTitle} · ${t("info.title")}`
      : t("info.title");
  }

  function prepareLinks() {
    document.querySelectorAll(".markdown-body a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  closeButton?.addEventListener("click", () => window.close());

  window.addEventListener("storage", (event) => {
    if (event.key === "bsm-theme" && event.newValue) {
      applyTheme(event.newValue);
    }
    if (event.key === "bsm-lang" && event.newValue) {
      setLanguage(event.newValue);
      refreshText();
    }
  });

  applyTheme(storedTheme());
  refreshText();
  prepareLinks();
})();
