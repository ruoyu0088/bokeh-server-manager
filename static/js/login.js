(() => {
  "use strict";

  const { t, setLanguage, getLanguage, applyTranslations } = window.BSM_I18N;
  const languageSelect = document.querySelector("#language-select");
  const errorBox = document.querySelector("#auth-error");

  function savedTheme() {
    try {
      return localStorage.getItem("bsm-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function applyError() {
    if (!errorBox) return;
    const key = errorBox.dataset.errorKey;
    if (key) errorBox.textContent = t(key);
  }

  function refreshText() {
    applyTranslations();
    applyError();
    document.title = `${t("auth.loginTitle")} · Bokeh Server Manager`;
  }

  document.documentElement.dataset.theme = savedTheme();
  if (languageSelect) {
    languageSelect.value = getLanguage();
    languageSelect.addEventListener("change", () => {
      setLanguage(languageSelect.value);
      refreshText();
    });
  }
  refreshText();
})();
