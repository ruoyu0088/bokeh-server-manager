(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const STORAGE_THEME = "bsm-theme";
  const state = {
    serverName: null,
    server: null,
    tree: null,
    currentPath: null,
    currentFile: null,
    lastSaved: "",
    dirty: false,
    saving: false,
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
    fileTree: $("#file-tree"),
    fileCount: $("#file-count"),
    treeStatus: $("#tree-status"),
    editorHost: $("#editor-host"),
    editorEmpty: $("#editor-empty"),
    editorError: $("#editor-error"),
    cursorPos: $("#cursor-pos"),
    selectionInfo: $("#selection-info"),
    fileMode: $("#file-mode"),
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
      response = await fetch(url, { cache: "no-store", ...options });
    } catch {
      throw new Error("Network request failed.");
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status}).`);
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
    return { mime: null, label: "Plain text" };
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
      elements.saveState.textContent = "Saving…";
      elements.saveState.classList.add("dirty");
    } else if (state.dirty) {
      elements.saveState.textContent = "Unsaved changes";
      elements.saveState.classList.add("dirty");
    } else if (state.currentPath) {
      elements.saveState.textContent = "Saved";
      elements.saveState.classList.add("saved");
    } else {
      elements.saveState.textContent = "Ready";
    }
    elements.saveFile.disabled =
      !state.currentPath || !state.dirty || state.saving;
  }

  function updateCursor() {
    if (!state.editor) return;
    const cursor = state.editor.getCursor();
    const selection = state.editor.getSelection();
    elements.cursorPos.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    elements.selectionInfo.textContent = selection
      ? `${selection.length} selected`
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
        ${node.managed ? '<span class="tree-badge" title="Generated by the manager at server start">auto</span>' : ""}
        ${node.metadata ? '<span class="tree-badge" title="Edited by the server information dialog">meta</span>' : ""}
      `;
      button.addEventListener("click", () => openFile(node.path));
      fragment.appendChild(button);
    }
    container.replaceChildren(fragment);
  }

  function renderTreeFromState() {
    if (!state.tree) return;
    renderTree(state.tree.tree || [], elements.fileTree);
    elements.fileCount.textContent = String(countFiles(state.tree.tree));
    elements.treeStatus.textContent = `${countFiles(state.tree.tree)} files · ${state.serverName}`;
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
    clearEditorError();
  }

  function setNoFileState() {
    elements.filePath.textContent = "No file open";
    elements.managedBadge.hidden = true;
    elements.metadataBadge.hidden = true;
    elements.fileMode.textContent = "Plain text";
    elements.editorEmpty.classList.remove("hidden");
  }

  async function openFile(path) {
    if (!path) return;
    if (path === state.currentPath) return;
    if (state.dirty) {
      const proceed = window.confirm(
        `Discard unsaved changes in “${state.currentPath}”?`,
      );
      if (!proceed) return;
    }
    const token = ++state.loadToken;
    try {
      const file = await apiFetch(
        `/api/servers/${encodeURIComponent(state.serverName)}/file?path=${encodeURIComponent(path)}`,
      );
      if (token !== state.loadToken) return;
      state.currentPath = path;
      state.currentFile = file;
      state.lastSaved = file.content;
      state.dirty = false;
      const mode = fileMode(path);
      state.editor.setOption("mode", mode.mime);
      state.editor.setValue(file.content);
      state.editor.clearHistory();
      state.editor.setCursor({ line: 0, ch: 0 });
      setFileHeader({ ...file, path });
      updateDirtyState();
      updateCursor();
      markActiveFile();
      elements.saveState.className = "save-state saved";
      elements.saveState.textContent = "Saved";
      state.editor.focus();
      document.title = `${file.path} · ${state.server ? state.server.title || state.serverName : state.serverName}`;
    } catch (error) {
      toast(`Could not open file: ${error.message}`, "error", 7000);
      showEditorError(`Could not open this file.\n${error.message}`);
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
      toast(`Saved ${state.currentPath}.`, "success");
      if (state.currentPath.endsWith("theme.yaml")) {
        toast(
          "theme.yaml is generated by the manager and will be replaced on the next server start.",
          "info",
          6500,
        );
      }
    } catch (error) {
      state.saving = false;
      updateDirtyState();
      elements.saveState.textContent = "Save failed";
      elements.saveState.className = "save-state error";
      toast(`Save failed: ${error.message}`, "error", 8000);
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
      elements.treeStatus.textContent = "Could not load files";
      toast(`Could not load file tree: ${error.message}`, "error", 7000);
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
      elements.serverTitle.textContent = "Server unavailable";
      elements.serverName.textContent = state.serverName || "Unknown server";
      showEditorError(`Could not load this server.\n${error.message}`);
      elements.saveFile.disabled = true;
    }
  }

  async function init() {
    initTheme();
    createEditor();
    state.serverName = new URLSearchParams(window.location.search).get("server");
    if (!state.serverName) {
      elements.serverTitle.textContent = "No server selected";
      elements.serverName.textContent = "Open the editor from the manager";
      showEditorError(
        "No server was selected. Open the server information or the Edit source button from the manager.",
      );
      elements.treeStatus.textContent = "No server";
      return;
    }
    await loadServer();
    await refreshTree({ openMain: true });
    updateDirtyState();
    updateCursor();
  }

  elements.saveFile.addEventListener("click", saveFile);
  elements.refreshTree.addEventListener("click", () => refreshTree());

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
  });

  init();
})();
