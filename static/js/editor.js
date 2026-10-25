(() => {
  "use strict";

  const { t, setLanguage, getLanguage, applyTranslations } = window.BSM_I18N;
  const $ = (selector, root = document) => root.querySelector(selector);
  const STORAGE_THEME = "bsm-theme";
  const STORAGE_LANG = "bsm-lang";
  const state = {
    serverName: null,
    server: null,
    tree: null,
    currentPath: null,
    currentFile: null,
    lastSaved: "",
    dirty: false,
    saving: false,
    deleting: false,
    loadToken: 0,
    editor: null,
    theme: "light",
  };

  const elements = {
    serverTitle: $("#server-title"),
    serverName: $("#server-name"),
    filePath: $("#file-path"),
    managedBadge: $("#managed-badge"),
    metadataBadge: $("#metadata-badge"),
    dirtyDot: $("#dirty-dot"),
    saveState: $("#save-state"),
    saveFile: $("#save-file"),
    refreshTree: $("#refresh-tree"),
    newFile: $("#new-file"),
    deleteFile: $("#delete-file"),
    fileTree: $("#file-tree"),
    fileCount: $("#file-count"),
    treeStatus: $("#tree-status"),
    editorHost: $("#editor-host"),
    editorEmpty: $("#editor-empty"),
    editorError: $("#editor-error"),
    cursorPos: $("#cursor-pos"),
    selectionInfo: $("#selection-info"),
    fileMode: $("#file-mode"),
    modalRoot: $("#modal-root"),
    toastRoot: $("#toast-root"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message, type = "info", duration = 4200) {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    elements.toastRoot.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(4px)";
      window.setTimeout(() => node.remove(), 180);
    }, duration);
  }

  async function apiFetch(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        ...options,
        headers: {
          "X-BSM-Lang": getLanguage(),
          ...(options.headers || {}),
        },
      });
    } catch {
      throw new Error(t("error.network"));
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      throw new Error(
        payload.error || t("error.requestFailed", { status: response.status }),
      );
    }
    return payload;
  }

  function applyEditorTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    state.theme = normalized;
    document.documentElement.dataset.theme = normalized;
    if (state.editor) {
      state.editor.setOption(
        "theme",
        normalized === "dark" ? "material-darker" : "default",
      );
      window.setTimeout(() => state.editor.refresh(), 30);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    applyEditorTheme(saved === "dark" || saved === "light" ? saved : preferred);
  }

  function fileMode(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".py")) return { mime: "python", label: "Python" };
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return { mime: "htmlmixed", label: "HTML" };
    }
    if (lower.endsWith(".css")) return { mime: "css", label: "CSS" };
    if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
      return { mime: "javascript", label: "JavaScript" };
    }
    if (lower.endsWith(".json")) return { mime: "application/json", label: "JSON" };
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      return { mime: "yaml", label: "YAML" };
    }
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
      return { mime: "markdown", label: "Markdown" };
    }
    return { mime: null, label: t("editor.plainText") };
  }

  function fileKind(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".py")) return { label: "py", className: "py" };
    if (lower.endsWith(".json")) return { label: "json", className: "json" };
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      return { label: "yaml", className: "yaml" };
    }
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return { label: "html", className: "html" };
    }
    if (lower.endsWith(".css")) return { label: "css", className: "css" };
    if (lower.endsWith(".js")) return { label: "js", className: "js" };
    if (lower.endsWith(".md")) return { label: "md", className: "" };
    const ext = lower.includes(".") ? lower.split(".").pop().slice(0, 4) : "txt";
    return { label: ext || "txt", className: "" };
  }

  function updateDirtyState() {
    state.dirty = Boolean(
      state.currentPath &&
        state.editor &&
        state.editor.getValue() !== state.lastSaved,
    );
    elements.dirtyDot.hidden = !state.dirty;
    elements.saveState.className = "save-state";
    if (state.saving) {
      elements.saveState.textContent = t("editor.saving");
      elements.saveState.classList.add("dirty");
    } else if (state.dirty) {
      elements.saveState.textContent = t("editor.unsaved");
      elements.saveState.classList.add("dirty");
    } else if (state.currentPath) {
      elements.saveState.textContent = t("editor.saved");
      elements.saveState.classList.add("saved");
    } else {
      elements.saveState.textContent = t("editor.ready");
    }
    elements.saveFile.disabled =
      !state.currentPath || !state.dirty || state.saving;
  }

  function updateCursor() {
    if (!state.editor) return;
    const cursor = state.editor.getCursor();
    const selection = state.editor.getSelection();
    elements.cursorPos.textContent = t("editor.lncol", {
      line: cursor.line + 1,
      col: cursor.ch + 1,
    });
    elements.selectionInfo.textContent = selection
      ? t("editor.selected", { count: selection.length })
      : "";
  }

  function markActiveFile() {
    for (const node of elements.fileTree.querySelectorAll(".tree-file")) {
      node.classList.toggle("active", node.dataset.path === state.currentPath);
    }
  }

  function countFiles(nodes) {
    let count = 0;
    for (const node of nodes || []) {
      if (node.type === "file") count += 1;
      else count += countFiles(node.children);
    }
    return count;
  }

  function findFile(nodes, wanted) {
    for (const node of nodes || []) {
      if (node.type === "file" && node.path === wanted) return node;
      if (node.type === "directory") {
        const found = findFile(node.children, wanted);
        if (found) return found;
      }
    }
    return null;
  }

  function renderTree(nodes, container, depth = 0) {
    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      if (node.type === "directory") {
        const details = document.createElement("details");
        details.className = "tree-dir";
        details.open = depth < 2;
        const summary = document.createElement("summary");
        summary.textContent = node.name;
        details.appendChild(summary);
        const children = document.createElement("div");
        children.className = "tree-children";
        renderTree(node.children, children, depth + 1);
        details.appendChild(children);
        fragment.appendChild(details);
        continue;
      }
      const kind = fileKind(node.path);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tree-file";
      button.dataset.path = node.path;
      button.title = node.path;
      button.innerHTML = `
        <span class="file-kind ${kind.className}">${kind.label}</span>
        <span class="tree-file-name">${escapeHtml(node.name)}</span>
        ${
          node.managed
            ? `<span class="tree-badge" title="${escapeHtml(
                t("editor.autoTitle"),
              )}">${escapeHtml(t("editor.autoBadge"))}</span>`
            : ""
        }
        ${
          node.metadata
            ? `<span class="tree-badge" title="${escapeHtml(
                t("editor.metaTitle"),
              )}">${escapeHtml(t("editor.metaBadge"))}</span>`
            : ""
        }
      `;
      button.addEventListener("click", () => openFile(node.path));
      fragment.appendChild(button);
    }
    container.replaceChildren(fragment);
  }

  function renderTreeFromState() {
    if (!state.tree) return;
    renderTree(state.tree.tree || [], elements.fileTree);
    const count = countFiles(state.tree.tree);
    elements.fileCount.textContent = String(count);
    elements.treeStatus.textContent = t("editor.filesCount", {
      count,
      name: state.serverName,
    });
    markActiveFile();
  }

  function showEditorError(message) {
    elements.editorError.hidden = false;
    elements.editorError.textContent = message;
  }

  function clearEditorError() {
    elements.editorError.hidden = true;
    elements.editorError.textContent = "";
  }

  function setFileHeader(file) {
    const mode = fileMode(file.path);
    elements.filePath.textContent = file.path;
    elements.managedBadge.hidden = !file.managed;
    elements.metadataBadge.hidden = !file.metadata;
    elements.fileMode.textContent = mode.label;
    elements.editorEmpty.classList.add("hidden");
    elements.editorHost.style.visibility = "visible";
    elements.deleteFile.disabled = false;
    clearEditorError();
  }

  function setNoFileState() {
    elements.filePath.textContent = t("editor.noFile");
    elements.managedBadge.hidden = true;
    elements.metadataBadge.hidden = true;
    elements.fileMode.textContent = t("editor.plainText");
    elements.editorEmpty.classList.remove("hidden");
    elements.deleteFile.disabled = true;
  }

  async function openFile(path) {
    if (!path) return;
    if (path === state.currentPath) return;
    if (state.dirty) {
      const proceed = window.confirm(
        t("editor.discard", { path: state.currentPath }),
      );
      if (!proceed) return;
    }
    const token = ++state.loadToken;
    try {
      const file = await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}/file?path=${encodeURIComponent(path)}`,
      );
      if (token !== state.loadToken) return;
      const content = file.content.replace(/\r\n?/g, "\n");
      state.currentPath = path;
      state.currentFile = file;
      state.lastSaved = content;
      state.dirty = false;
      const mode = fileMode(path);
      state.editor.setOption("mode", mode.mime);
      state.editor.setValue(content);
      state.editor.clearHistory();
      state.editor.setCursor({ line: 0, ch: 0 });
      setFileHeader({ ...file, path });
      updateDirtyState();
      updateCursor();
      markActiveFile();
      state.editor.focus();
      document.title = `${file.path} · ${
        state.server ? state.server.title || state.serverName : state.serverName
      }`;
    } catch (error) {
      toast(t("editor.openFailed", { error: error.message }), "error", 7000);
      showEditorError(
        `${t("editor.openErrorTitle")}\n${error.message}`,
      );
    }
  }

  async function saveFile() {
    if (!state.currentPath || !state.editor || state.saving) return;
    if (!state.dirty) return;
    const content = state.editor.getValue();
    state.saving = true;
    updateDirtyState();
    try {
      await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}/file`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: state.currentPath, content }),
        },
      );
      state.lastSaved = content;
      state.saving = false;
      updateDirtyState();
      toast(t("editor.saveSuccess", { path: state.currentPath }), "success");
      if (
        state.currentPath.endsWith("theme.yaml") ||
        state.currentPath === "templates/index.html"
      ) {
        toast(t("editor.generatedWarning"), "info", 6500);
      }
    } catch (error) {
      state.saving = false;
      updateDirtyState();
      elements.saveState.textContent = t("editor.saveFailed");
      elements.saveState.className = "save-state error";
      toast(t("editor.saveError", { error: error.message }), "error", 8000);
    }
  }

  function openNewFileDialog() {
    if (!state.serverName) return;
    const closeModal = () => {
      elements.modalRoot.replaceChildren();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    elements.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-close="true">
        <section class="modal narrow" role="dialog" aria-modal="true" aria-label="${escapeHtml(
          t("editor.newFileTitle"),
        )}">
          <header class="modal-header">
            <h3>${escapeHtml(t("editor.newFileTitle"))}</h3>
            <button class="icon-button icon-button-small" type="button" data-modal-close="true" aria-label="${escapeHtml(
              t("common.close"),
            )}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </header>
          <div class="modal-body">
            <div class="form-error" id="new-file-error"></div>
            <form id="new-file-form" autocomplete="off">
              <div class="form-field">
                <label for="new-file-path">${escapeHtml(
                  t("editor.filePath"),
                )}</label>
                <input id="new-file-path" maxlength="260" placeholder="${escapeHtml(
                  t("editor.filePathPlaceholder"),
                )}" required>
                <div class="form-hint">${escapeHtml(
                  t("editor.filePathHint"),
                )}</div>
              </div>
            </form>
          </div>
          <footer class="modal-footer">
            <button class="button button-ghost" type="button" data-modal-close="true">${escapeHtml(
              t("common.cancel"),
            )}</button>
            <button class="button button-primary" id="create-file" type="submit" form="new-file-form">${escapeHtml(
              t("common.create"),
            )}</button>
          </footer>
        </section>
      </div>
    `;
    elements.modalRoot.querySelectorAll("[data-modal-close]").forEach((node) => {
      node.addEventListener("click", (event) => {
        if (node.classList.contains("modal-backdrop") && event.target !== node) {
          return;
        }
        closeModal();
      });
    });
    const input = $("#new-file-path");
    const errorBox = $("#new-file-error");
    const createButton = $("#create-file");
    $("#new-file-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.classList.remove("visible");
      const path = input.value.trim();
      if (!path) {
        errorBox.textContent = t("editor.filePathRequired");
        errorBox.classList.add("visible");
        input.focus();
        return;
      }
      createButton.disabled = true;
      createButton.textContent = t("editor.creating");
      try {
        const file = await apiFetch(
          `/api/servers/${encodeURIComponent(state.serverName)}/file`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, content: "" }),
          },
        );
        closeModal();
        toast(t("editor.created", { path: file.path }), "success");
        await refreshTree();
        await openFile(file.path);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.add("visible");
        createButton.disabled = false;
        createButton.textContent = t("common.create");
      }
    });
    input.focus();
  }

  async function deleteCurrentFile() {
    if (!state.currentPath || state.deleting) return;
    const pathToDelete = state.currentPath;
    let message = state.dirty
      ? t("editor.deleteConfirmDirty", { path: pathToDelete })
      : t("editor.deleteConfirm", { path: pathToDelete });
    if (
      pathToDelete.endsWith("theme.yaml") ||
      pathToDelete === "templates/index.html"
    ) {
      message += `\n\n${t("editor.deleteGenerated")}`;
    }
    if (!window.confirm(message)) return;
    state.deleting = true;
    elements.deleteFile.disabled = true;
    elements.saveState.textContent = t("editor.deleting");
    elements.saveState.className = "save-state dirty";
    try {
      await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}/file?path=${encodeURIComponent(
          pathToDelete,
        )}`,
        { method: "DELETE" },
      );
      state.currentPath = null;
      state.currentFile = null;
      state.lastSaved = "";
      state.dirty = false;
      state.saving = false;
      state.editor.setValue("");
      state.editor.clearHistory();
      setNoFileState();
      updateDirtyState();
      updateCursor();
      await refreshTree();
      document.title = state.server
        ? `${state.server.title || state.serverName} · ${state.serverName}`
        : state.serverName || "Bokeh Server Manager";
      toast(t("editor.deleted", { path: pathToDelete }), "success");
    } catch (error) {
      toast(
        t("editor.deleteFailed", { error: error.message }),
        "error",
        8000,
      );
      elements.deleteFile.disabled = !state.currentPath;
    } finally {
      state.deleting = false;
    }
  }

  async function refreshTree({ openMain = false } = {}) {
    if (!state.serverName) return;
    try {
      const tree = await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}/tree`,
      );
      state.tree = tree;
      renderTreeFromState();
      if (openMain && !state.currentPath) {
        const main = findFile(tree.tree, "main.py") || tree.tree.find((n) => n.type === "file");
        if (main) openFile(main.path);
      }
    } catch (error) {
      elements.treeStatus.textContent = t("editor.couldNotLoadFiles");
      toast(t("editor.treeError", { error: error.message }), "error", 7000);
    }
  }

  function createEditor() {
    state.editor = CodeMirror(elements.editorHost, {
      value: "",
      mode: null,
      theme: state.theme === "dark" ? "material-darker" : "default",
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      electricChars: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
      extraKeys: {
        Tab: (editor) => {
          if (editor.somethingSelected()) editor.indentSelection("add");
          else editor.replaceSelection("    ", "end");
        },
        "Shift-Tab": (editor) => editor.indentSelection("subtract"),
      },
    });
    state.editor.on("change", updateDirtyState);
    state.editor.on("cursorActivity", updateCursor);
    state.editor.setSize("100%", "100%");
  }

  function applyEditorLanguage() {
    applyTranslations();
    if (state.server) {
      elements.serverTitle.textContent = state.server.title || state.server.name;
      elements.serverName.textContent = state.server.name;
    } else if (state.serverName) {
      elements.serverTitle.textContent = t("editor.serverUnavailable");
      elements.serverName.textContent = state.serverName;
    } else {
      elements.serverTitle.textContent = t("editor.noServerSelected");
      elements.serverName.textContent = t("editor.noServerSubtitle");
    }
    if (state.currentPath) {
      elements.filePath.textContent = state.currentPath;
      elements.fileMode.textContent = fileMode(state.currentPath).label;
      elements.managedBadge.hidden = !state.currentFile?.managed;
      elements.metadataBadge.hidden = !state.currentFile?.metadata;
      elements.editorEmpty.classList.add("hidden");
    } else {
      setNoFileState();
    }
    elements.deleteFile.disabled = !state.currentPath;
    if (state.tree) {
      renderTreeFromState();
    } else if (state.serverName) {
      elements.treeStatus.textContent = t("editor.loadingFiles");
    } else {
      elements.treeStatus.textContent = t("editor.noServer");
    }
    updateDirtyState();
    updateCursor();
  }

  async function loadServer() {
    try {
      const server = await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}`,
      );
      state.server = server;
      elements.serverTitle.textContent = server.title || server.name;
      elements.serverName.textContent = server.name;
      document.title = `${server.title || server.name} · ${server.name}`;
    } catch (error) {
      elements.serverTitle.textContent = t("editor.serverUnavailable");
      elements.serverName.textContent =
        state.serverName || t("editor.unknownServer");
      showEditorError(
        t("editor.serverLoadError", { error: error.message }),
      );
      elements.saveFile.disabled = true;
      elements.newFile.disabled = true;
      elements.deleteFile.disabled = true;
    }
  }

  async function init() {
    initTheme();
    applyTranslations();
    createEditor();
    state.serverName = new URLSearchParams(window.location.search).get("server");
    if (!state.serverName) {
      elements.serverTitle.textContent = t("editor.noServerSelected");
      elements.serverName.textContent = t("editor.noServerSubtitle");
      showEditorError(t("editor.noServerError"));
      elements.treeStatus.textContent = t("editor.noServer");
      elements.newFile.disabled = true;
      elements.deleteFile.disabled = true;
      return;
    }
    elements.newFile.disabled = false;
    await loadServer();
    await refreshTree({ openMain: true });
    updateDirtyState();
    updateCursor();
  }

  elements.saveFile.addEventListener("click", saveFile);
  elements.refreshTree.addEventListener("click", () => refreshTree());
  elements.newFile.addEventListener("click", openNewFileDialog);
  elements.deleteFile.addEventListener("click", deleteCurrentFile);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveFile();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  window.addEventListener("resize", () => {
    if (state.editor) state.editor.refresh();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_THEME && event.newValue) {
      applyEditorTheme(event.newValue);
    }
    if (event.key === STORAGE_LANG && event.newValue) {
      setLanguage(event.newValue);
      applyEditorLanguage();
    }
  });

  init();
})();
