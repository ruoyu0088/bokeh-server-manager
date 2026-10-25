(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const STORAGE = {
    theme: "bsm-theme",
    sidebar: "bsm-sidebar-collapsed",
    sidebarWidth: "bsm-sidebar-width",
    tabs: "bsm-open-tabs",
  };
  const SIDEBAR_MIN = 260;
  const SIDEBAR_MAX = 560;
  const SIDEBAR_DEFAULT = 320;

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
    reload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM13.5 7.5l3 3"/></svg>',
    logs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M5 12h9M5 19h11"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/></svg>',
  };

  const state = {
    servers: [],
    tabs: new Map(),
    active: null,
    busy: new Set(),
    fetching: false,
    fetchPromise: null,
    online: true,
    restored: false,
    theme: "light",
  };

  const elements = {
    appShell: $("#app-shell"),
    sidebar: $("#sidebar"),
    sidebarCollapse: $("#sidebar-collapse"),
    sidebarResizer: $("#sidebar-resizer"),
    sidebarHandle: $("#sidebar-handle"),
    serverList: $("#server-list"),
    serverCount: $("#server-count"),
    refreshServers: $("#refresh-servers"),
    newServer: $("#new-server-btn"),
    themeToggle: $("#theme-toggle"),
    themeIcon: $("#theme-icon"),
    themeLabel: $("#theme-label"),
    tabs: $("#tabs"),
    panes: $("#panes"),
    emptyState: $("#empty-state"),
    managerStatus: $("#manager-status"),
    modalRoot: $("#modal-root"),
    toastRoot: $("#toast-root"),
  };
  let sidebarWidth = SIDEBAR_DEFAULT;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusLabel(status) {
    return (
      {
        running: "Running",
        starting: "Starting",
        stopping: "Stopping",
        error: "Error",
        stopped: "Stopped",
      }[status] || status
    );
  }

  function statusClass(status) {
    if (status === "running" || status === "starting" || status === "error") {
      return `status-${status}`;
    }
    return "status-stopped";
  }

  function themeName(theme) {
    return theme === "dark" ? "Dark" : "Light";
  }

  function themeIcon(theme) {
    return theme === "dark" ? ICONS.moon : ICONS.sun;
  }

  function serverTitle(server) {
    return server.title || server.name;
  }

  function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return "";
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function serverByName(name) {
    return state.servers.find((server) => server.name === name) || null;
  }

  function clampSidebarWidth(value) {
    return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
  }

  function setSidebarWidth(value, persist = false) {
    sidebarWidth = clampSidebarWidth(value);
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    if (persist) localStorage.setItem(STORAGE.sidebarWidth, String(sidebarWidth));
  }

  function isSidebarCollapsed() {
    return elements.sidebar.classList.contains("collapsed");
  }

  function setSidebarCollapsed(collapsed) {
    elements.sidebar.classList.toggle("collapsed", collapsed);
    elements.sidebarHandle.hidden = !collapsed;
    elements.sidebarCollapse.setAttribute("aria-expanded", String(!collapsed));
    localStorage.setItem(STORAGE.sidebar, collapsed ? "1" : "0");
  }

  function toggleSidebar(force) {
    const collapsed =
      typeof force === "boolean" ? force : !elements.sidebar.classList.contains("collapsed");
    setSidebarCollapsed(collapsed);
  }

  function initSidebar() {
    const savedWidth = Number.parseInt(localStorage.getItem(STORAGE.sidebarWidth) || "", 10);
    setSidebarWidth(Number.isFinite(savedWidth) ? savedWidth : SIDEBAR_DEFAULT, false);
    const collapsed = localStorage.getItem(STORAGE.sidebar) === "1";
    setSidebarCollapsed(collapsed);
  }

  function initSidebarResizer() {
    let dragging = false;
    let startX = 0;
    let startWidth = sidebarWidth;

    const stopDragging = (event) => {
      if (!dragging) return;
      dragging = false;
      elements.appShell.classList.remove("resizing");
      elements.sidebar.classList.remove("resizing");
      localStorage.setItem(STORAGE.sidebarWidth, String(sidebarWidth));
      if (event && elements.sidebarResizer.hasPointerCapture?.(event.pointerId)) {
        elements.sidebarResizer.releasePointerCapture(event.pointerId);
      }
    };

    elements.sidebarResizer.addEventListener("pointerdown", (event) => {
      if (isSidebarCollapsed()) return;
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startWidth = sidebarWidth;
      elements.appShell.classList.add("resizing");
      elements.sidebar.classList.add("resizing");
      elements.sidebarResizer.setPointerCapture?.(event.pointerId);
    });
    elements.sidebarResizer.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setSidebarWidth(startWidth + (event.clientX - startX), false);
    });
    elements.sidebarResizer.addEventListener("pointerup", stopDragging);
    elements.sidebarResizer.addEventListener("pointercancel", stopDragging);
    elements.sidebarResizer.addEventListener("dblclick", () => {
      setSidebarWidth(SIDEBAR_DEFAULT, true);
    });
  }

  function setManagerStatus(online) {
    if (online === state.online) return;
    state.online = online;
    elements.managerStatus.classList.toggle("offline", !online);
    elements.managerStatus.innerHTML = online
      ? '<span class="status-dot status-running"></span><span>Connected</span>'
      : '<span class="status-dot status-error"></span><span>Manager offline</span>';
    if (!online) {
      toast("Cannot reach the manager backend. Check that the manager is still running.", "error", 6000);
    }
  }

  async function apiFetch(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        ...options,
      });
    } catch {
      setManagerStatus(false);
      throw new Error("Network request failed.");
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      setManagerStatus(true);
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    setManagerStatus(true);
    return payload;
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

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme, notify = false) {
    const normalized = theme === "dark" ? "dark" : "light";
    state.theme = normalized;
    document.documentElement.dataset.theme = normalized;
    localStorage.setItem(STORAGE.theme, normalized);
    elements.themeIcon.innerHTML = normalized === "dark" ? ICONS.sun : ICONS.moon;
    elements.themeLabel.textContent = `${themeName(normalized)} theme`;
    elements.themeToggle.title =
      normalized === "dark" ? "Switch to light theme" : "Switch to dark theme";
    if (notify) {
      const stale = state.servers.filter(
        (server) => server.status === "running" && server.theme !== normalized,
      );
      if (stale.length > 0) {
        toast(
          `Interface theme changed. ${stale.length} running server${stale.length === 1 ? "" : "s"} will use it after the next reload or restart.`,
          "info",
          6500,
        );
      } else {
        toast(`${themeName(normalized)} theme enabled.`, "success");
      }
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    if (saved === "light" || saved === "dark") {
      applyTheme(saved, false);
    } else {
      const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      applyTheme(preferred, false);
    }
  }

  function themeChip(server) {
    if (!server.theme) return "";
    const mismatch = server.theme !== state.theme ? " mismatch" : "";
    return `<span class="theme-chip${mismatch}" title="Theme used when this server was started">${themeIcon(
      server.theme,
    )}${themeName(server.theme)}</span>`;
  }

  function renderSidebar() {
    elements.serverCount.textContent = String(state.servers.length);
    if (state.servers.length === 0) {
      elements.serverList.innerHTML =
        '<div class="sidebar-empty">No Bokeh servers yet.<br>Add an application under <code>servers/</code> or create one here.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const server of state.servers) {
      const card = document.createElement("article");
      const isActive = state.active === server.name;
      const busy = state.busy.has(server.name);
      card.className = [
        "server-card",
        isActive ? "active" : "",
        busy ? "busy" : "",
      ]
        .filter(Boolean)
        .join(" ");
      card.dataset.name = server.name;

      const status = server.valid === false ? "error" : server.status || "stopped";
      const canStart = ["stopped", "error"].includes(status) && server.valid !== false;
      const canStop = ["running", "starting", "stopping"].includes(status);
      const canReload = status !== "stopped" && status !== "stopping";
      const title = serverTitle(server);
      const showDirectory = server.title && server.title !== server.name;
      const metaParts = [`<span>${statusLabel(status)}</span>`];
      if (server.port && status !== "stopped") {
        metaParts.push(`<span class="server-port">:${server.port}</span>`);
      }
      if (server.status === "running" && server.uptime) {
        metaParts.push(`<span>${formatUptime(server.uptime)}</span>`);
      }
      const errorText = server.valid === false
        ? server.error || "This directory is not a valid Bokeh directory application."
        : server.error;
      const errorHtml = errorText
        ? `<div class="server-error" title="${escapeHtml(errorText)}">${escapeHtml(
            errorText,
          )}</div>`
        : "";
      const descriptionHtml = server.description
        ? `<div class="server-description" title="${escapeHtml(server.description)}">${escapeHtml(
            server.description,
          )}</div>`
        : "";

      card.innerHTML = `
        <div class="server-card-main" data-action="open" title="Open server tab">
          <span class="status-dot ${statusClass(status)}"></span>
          <div class="server-card-title">
            <span class="server-name">${escapeHtml(title)}</span>
            ${showDirectory ? `<span class="server-dir">${escapeHtml(server.name)}</span>` : ""}
            <div class="server-meta">
              ${metaParts.join("")}
              ${status === "stopped" ? "" : themeChip(server)}
            </div>
            ${descriptionHtml}
            ${errorHtml}
          </div>
        </div>
        <div class="server-actions">
          <button class="icon-button" type="button" data-action="start" title="Start" aria-label="Start ${escapeHtml(
            title,
          )}" ${canStart && !busy ? "" : "disabled"}>${ICONS.play}</button>
          <button class="icon-button" type="button" data-action="reload" title="Reload: restart the process and apply the current theme" aria-label="Reload ${escapeHtml(
            title,
          )}" ${canReload && !busy ? "" : "disabled"}>${ICONS.reload}</button>
          <button class="icon-button danger" type="button" data-action="stop" title="Stop" aria-label="Stop ${escapeHtml(
            title,
          )}" ${canStop && !busy ? "" : "disabled"}>${ICONS.stop}</button>
          <button class="icon-button" type="button" data-action="edit" title="Edit source" aria-label="Edit source for ${escapeHtml(
            title,
          )}" ${busy ? "disabled" : ""}>${ICONS.edit}</button>
          <button class="icon-button${server.metadata_error ? " warn" : ""}" type="button" data-action="metadata" title="${
            server.metadata_error
              ? "Server information (server.json has an error)"
              : "Server information"
          }" aria-label="Edit server information for ${escapeHtml(
            title,
          )}" ${busy ? "disabled" : ""}>${ICONS.info}</button>
          <button class="icon-button" type="button" data-action="logs" title="View logs" aria-label="View logs for ${escapeHtml(
            title,
          )}">${ICONS.logs}</button>
          <button class="icon-button" type="button" data-action="external" title="Open in a new window" aria-label="Open ${escapeHtml(
            title,
          )} in a new window" ${server.status === "running" ? "" : "disabled"}>${ICONS.external}</button>
          <span class="action-label">${busy ? "Working…" : ""}</span>
        </div>
      `;
      fragment.appendChild(card);
    }
    elements.serverList.replaceChildren(fragment);
  }

  function updateEmptyState() {
    const hasTabs = state.tabs.size > 0;
    elements.emptyState.classList.toggle("hidden", hasTabs);
  }

  function persistTabs() {
    localStorage.setItem(
      STORAGE.tabs,
      JSON.stringify({
        tabs: Array.from(state.tabs.keys()),
        active: state.active,
      }),
    );
  }

  function setOverlay(pane, kind, title, detail) {
    const overlay = $(".frame-overlay", pane);
    if (!overlay) return;
    const spinner = $(".spinner", overlay);
    const titleNode = $("strong", overlay);
    const detailNode = $("small", overlay);
    if (spinner) spinner.hidden = kind === "error";
    if (titleNode) titleNode.textContent = title;
    if (detailNode) detailNode.textContent = detail;
    overlay.classList.remove("hidden");
    pane.dataset.blockLoad = kind === "error" ? "true" : "false";
  }

  function hideOverlay(pane) {
    const overlay = $(".frame-overlay", pane);
    if (overlay) overlay.classList.add("hidden");
  }

  function withCacheBust(url) {
    try {
      const target = new URL(url);
      target.searchParams.set("bsm_reload", String(Date.now()));
      return target.toString();
    } catch {
      return url;
    }
  }

  function createTab(server, activate = true) {
    const name = server.name;
    const title = serverTitle(server);
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.name = name;
    tab.tabIndex = 0;
    tab.setAttribute("role", "tab");
    tab.title = `${title} · ${name}`;
    tab.innerHTML = `
      <span class="status-dot ${statusClass(server.status)}"></span>
      <span class="tab-label">${escapeHtml(title)}</span>
      <button class="tab-close" type="button" aria-label="Close ${escapeHtml(
        title,
      )} tab">${ICONS.close}</button>
    `;
    tab.addEventListener("click", () => {
      activateTab(name);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateTab(name);
      }
    });
    const closeButton = $(".tab-close", tab);
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(name);
    });
    elements.tabs.appendChild(tab);

    const pane = document.createElement("div");
    pane.className = "tab-pane";
    pane.dataset.name = name;
    const iframe = document.createElement("iframe");
    iframe.title = `${title} Bokeh application`;
    iframe.src = server.url;
    iframe.dataset.serverUrl = server.url;
    iframe.allow = "fullscreen";
    const overlay = document.createElement("div");
    overlay.className = "frame-overlay";
    overlay.innerHTML = `
      <div class="spinner" aria-hidden="true"></div>
      <strong>Connecting to ${escapeHtml(title)}</strong>
      <small>The Bokeh UI will appear here when the server is ready.</small>
    `;
    iframe.addEventListener("load", () => {
      if (pane.dataset.blockLoad !== "true") hideOverlay(pane);
    });
    pane.appendChild(iframe);
    pane.appendChild(overlay);
    elements.panes.appendChild(pane);

    state.tabs.set(name, { tab, pane, iframe });
    renderSidebar();
    if (activate) activateTab(name);
    updateEmptyState();
    persistTabs();
    return state.tabs.get(name);
  }

  function openTab(server, activate = true) {
    if (!server || server.status !== "running" || !server.url) return;
    const existing = state.tabs.get(server.name);
    if (existing) {
      syncTab(server);
      if (activate) activateTab(server.name);
      return;
    }
    createTab(server, activate);
  }

  function activateTab(name) {
    if (!state.tabs.has(name)) return;
    state.active = name;
    for (const [tabName, entry] of state.tabs) {
      const active = tabName === name;
      entry.tab.classList.toggle("active", active);
      entry.tab.setAttribute("aria-selected", String(active));
      entry.pane.classList.toggle("active", active);
    }
    updateEmptyState();
    renderSidebar();
    persistTabs();
  }

  function closeTab(name) {
    const entry = state.tabs.get(name);
    if (!entry) return;
    entry.tab.remove();
    entry.pane.remove();
    state.tabs.delete(name);
    if (state.active === name) {
      const remaining = Array.from(state.tabs.keys());
      state.active = remaining.length ? remaining[remaining.length - 1] : null;
      if (state.active) activateTab(state.active);
    }
    updateEmptyState();
    renderSidebar();
    persistTabs();
  }

  function syncTab(server) {
    const entry = state.tabs.get(server.name);
    if (!entry) return;
    const previousStatus = entry.pane.dataset.lastStatus || "";
    const dot = $(".status-dot", entry.tab);
    if (dot) dot.className = `status-dot ${statusClass(server.status)}`;
    const title = serverTitle(server);
    const label = $(".tab-label", entry.tab);
    if (label) label.textContent = title;
    entry.tab.title = `${title} · ${server.name}`;
    entry.iframe.title = `${title} Bokeh application`;

    const staleUrl = entry.iframe.dataset.serverUrl !== server.url;
    if (staleUrl) {
      entry.iframe.dataset.serverUrl = server.url;
      entry.iframe.src = withCacheBust(server.url);
      setOverlay(
        entry.pane,
        "loading",
        `Connecting to ${title}`,
        "The server process changed. Reloading the Bokeh UI.",
      );
    }
    if (server.status === "error") {
      setOverlay(
        entry.pane,
        "error",
        `${title} is unavailable`,
        server.error || "Check the server logs, fix the problem, then reload.",
      );
    } else if (server.status === "starting") {
      setOverlay(
        entry.pane,
        "loading",
        `${title} is starting`,
        "The Bokeh process is preparing. The UI will appear automatically.",
      );
    } else if (server.status === "running") {
      if (!staleUrl && previousStatus === "error") {
        entry.iframe.src = withCacheBust(server.url);
        setOverlay(
          entry.pane,
          "loading",
          `${title} is back`,
          "Reloading the Bokeh UI.",
        );
      }
      const overlay = $(".frame-overlay", entry.pane);
      if (overlay && !overlay.classList.contains("hidden")) {
        entry.pane.dataset.blockLoad = "false";
      }
    }
    entry.pane.dataset.lastStatus = server.status;
  }

  function syncTabs() {
    for (const name of Array.from(state.tabs.keys())) {
      const server = serverByName(name);
      if (!server || ["stopped", "stopping"].includes(server.status)) {
        closeTab(name);
        continue;
      }
      syncTab(server);
    }
    updateEmptyState();
  }

  function restoreTabs() {
    if (state.restored) return;
    state.restored = true;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE.tabs) || "null");
    } catch {
      saved = null;
    }
    if (!saved || !Array.isArray(saved.tabs)) return;
    for (const name of saved.tabs) {
      const server = serverByName(name);
      if (server && server.status === "running") {
        createTab(server, false);
      }
    }
    if (state.tabs.size > 0) {
      const active =
        saved.active && state.tabs.has(saved.active)
          ? saved.active
          : Array.from(state.tabs.keys())[0];
      activateTab(active);
    }
  }

  async function refreshServers({ silent = false } = {}) {
    if (state.fetching) return state.fetchPromise;
    if (document.hidden && silent) return null;
    state.fetching = true;
    state.fetchPromise = (async () => {
      try {
        const data = await apiFetch("/api/servers");
        state.servers = Array.isArray(data.servers) ? data.servers : [];
        setManagerStatus(true);
        renderSidebar();
        syncTabs();
        if (!state.restored) restoreTabs();
      } catch (error) {
        if (!silent) toast(error.message || "Failed to refresh servers.", "error", 6000);
      } finally {
        state.fetching = false;
        state.fetchPromise = null;
      }
    })();
    return state.fetchPromise;
  }

  async function startServer(name) {
    if (state.busy.has(name)) return;
    state.busy.add(name);
    renderSidebar();
    try {
      const data = await apiFetch(
        `/api/servers/${encodeURIComponent(name)}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: currentTheme() }),
        },
      );
      const known = serverByName(name) || { name };
      const started = { ...known, ...data };
      toast(`Started “${serverTitle(started)}” on port ${data.port}.`, "success");
      openTab(started);
      await refreshServers({ silent: true });
      const server = serverByName(name);
      if (server) openTab(server);
    } catch (error) {
      toast(`Start failed: ${error.message}`, "error", 9000);
      await refreshServers({ silent: true });
      showLogs(name);
    } finally {
      state.busy.delete(name);
      renderSidebar();
    }
  }

  async function stopServer(name) {
    if (state.busy.has(name)) return;
    state.busy.add(name);
    renderSidebar();
    try {
      await apiFetch(`/api/servers/${encodeURIComponent(name)}/stop`, {
        method: "POST",
      });
      closeTab(name);
      toast(`Stopped “${serverTitle(serverByName(name) || { name })}”.`, "success");
      await refreshServers({ silent: true });
    } catch (error) {
      toast(`Stop failed: ${error.message}`, "error", 7000);
    } finally {
      state.busy.delete(name);
      renderSidebar();
    }
  }

  async function reloadServer(name) {
    if (state.busy.has(name)) return;
    state.busy.add(name);
    renderSidebar();
    const entry = state.tabs.get(name);
    if (entry) {
      setOverlay(
        entry.pane,
        "loading",
        `Reloading ${serverTitle(serverByName(name) || { name })}`,
        "The process will restart with the current interface theme.",
      );
    }
    try {
      const data = await apiFetch(
        `/api/servers/${encodeURIComponent(name)}/reload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: currentTheme() }),
        },
      );
      toast(
        `Reloaded “${serverTitle(serverByName(name) || { name })}” on port ${data.port}.`,
        "success",
      );
      if (entry && data.url) {
        entry.iframe.dataset.serverUrl = data.url;
        entry.iframe.src = withCacheBust(data.url);
        setOverlay(
          entry.pane,
          "loading",
          "Reconnecting",
          "The process restarted. Loading the updated Bokeh UI.",
        );
      }
      await refreshServers({ silent: true });
      const server = serverByName(name);
      if (server) openTab(server);
    } catch (error) {
      toast(`Reload failed: ${error.message}`, "error", 9000);
      await refreshServers({ silent: true });
      showLogs(name);
    } finally {
      state.busy.delete(name);
      renderSidebar();
    }
  }

  function editServer(name) {
    const url = `/editor?server=${encodeURIComponent(name)}`;
    const editor = window.open(
      url,
      `bsm-editor-${name}`,
      "popup=yes,width=1280,height=860",
    );
    if (!editor) {
      toast("The browser blocked the editor window. Allow pop-ups and try again.", "error", 7000);
    }
  }

  function openExternalFor(name) {
    const entry = state.tabs.get(name);
    const server = serverByName(name);
    const url = entry?.iframe?.dataset.serverUrl || server?.url;
    if (!url) return;
    window.open(url, "_blank", "noopener");
  }

  function openModal({ title, body, footer = "", narrow = false, onMount }) {
    elements.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-close="true">
        <section class="modal ${narrow ? "narrow" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(
          title,
        )}">
          <header class="modal-header">
            <h3>${escapeHtml(title)}</h3>
            <button class="icon-button icon-button-small" type="button" data-modal-close="true" aria-label="Close">${ICONS.close}</button>
          </header>
          <div class="modal-body">${body}</div>
          ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
        </section>
      </div>
    `;
    const close = () => {
      elements.modalRoot.replaceChildren();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    elements.modalRoot.querySelectorAll("[data-modal-close]").forEach((node) => {
      node.addEventListener("click", (event) => {
        if (node.classList.contains("modal-backdrop") && event.target !== node) {
          return;
        }
        close();
      });
    });
    if (onMount) onMount(close);
    return close;
  }

  function showNewServerDialog() {
    const body = `
      <div class="form-error" id="new-server-error"></div>
      <form id="new-server-form" autocomplete="off">
        <div class="form-field">
          <label for="new-server-name">Directory name</label>
          <input id="new-server-name" maxlength="64" placeholder="my_bokeh_app" required>
          <div class="form-hint">Letters, numbers, underscores, or hyphens. The app is created under <code>servers/&lt;name&gt;</code>.</div>
        </div>
        <div class="form-field">
          <label for="new-server-title">Title</label>
          <input id="new-server-title" maxlength="120" placeholder="My Bokeh app">
          <div class="form-hint">Shown in the sidebar and tab. Defaults to the directory name.</div>
        </div>
        <div class="form-field">
          <label>Template</label>
          <div class="template-grid">
            <label class="template-option selected">
              <input type="radio" name="new-template" value="blank" checked>
              <strong>Blank</strong>
              <span>A minimal Bokeh page. A good starting point for custom apps.</span>
            </label>
            <label class="template-option">
              <input type="radio" name="new-template" value="interactive">
              <strong>Interactive</strong>
              <span>A sine-wave plot with a slider and a server-side callback.</span>
            </label>
          </div>
        </div>
        <label class="checkbox-row"><input type="checkbox" id="new-server-start" checked> Start immediately</label>
      </form>
    `;
    openModal({
      title: "New Bokeh server",
      body,
      footer:
        '<button class="button button-ghost" type="button" data-modal-close="true">Cancel</button>' +
        '<button class="button button-primary" id="create-server" type="submit" form="new-server-form">Create</button>',
      onMount: (close) => {
        const form = $("#new-server-form");
        const errorBox = $("#new-server-error");
        const nameInput = $("#new-server-name");
        const createButton = $("#create-server");
        const options = Array.from(form.querySelectorAll(".template-option"));
        const refreshSelection = () => {
          for (const option of options) {
            option.classList.toggle("selected", $("input", option).checked);
          }
        };
        for (const option of options) {
          $("input", option).addEventListener("change", refreshSelection);
        }
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          errorBox.classList.remove("visible");
          const name = nameInput.value.trim();
          if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
            errorBox.textContent =
              "Use letters, numbers, underscores, or hyphens. The name must start with a letter or number.";
            errorBox.classList.add("visible");
            nameInput.focus();
            return;
          }
          const template = $('input[name="new-template"]:checked', form).value;
          const start = $("#new-server-start").checked;
          createButton.disabled = true;
          createButton.textContent = "Creating…";
          try {
            const state = await apiFetch("/api/servers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                title: $("#new-server-title").value.trim(),
                template,
              }),
            });
            toast(`Created “${state.title || name}”.`, "success");
            close();
            await refreshServers({ silent: true });
            if (start) await startServer(name);
          } catch (error) {
            errorBox.textContent = error.message;
            errorBox.classList.add("visible");
            createButton.disabled = false;
            createButton.textContent = "Create";
          }
        });
        nameInput.focus();
      },
    });
  }

  function showServerInfo(name) {
    const server = serverByName(name);
    if (!server) return;
    const title = serverTitle(server);
    const warning = server.metadata_error
      ? `<div class="form-notice"><strong>server.json needs attention.</strong> ${escapeHtml(
          server.metadata_error,
        )} Saving this form will replace it with valid metadata.</div>`
      : "";
    const body = `
      ${warning}
      <div class="form-error" id="metadata-error"></div>
      <form id="metadata-form" autocomplete="off">
        <div class="form-field">
          <label for="metadata-title">Title</label>
          <input id="metadata-title" maxlength="120" value="${escapeHtml(
            server.title || "",
          )}" placeholder="${escapeHtml(name)}">
          <div class="form-hint">Used in the sidebar and tab. Falls back to the directory name when empty.</div>
        </div>
        <div class="form-field">
          <label for="metadata-description">Description</label>
          <textarea id="metadata-description" rows="2" maxlength="400">${escapeHtml(
            server.description || "",
          )}</textarea>
          <div class="form-hint">A short summary shown under the server title.</div>
        </div>
        <div class="form-field">
          <label for="metadata-usage">Usage</label>
          <textarea id="metadata-usage" rows="7">${escapeHtml(
            server.usage || "",
          )}</textarea>
          <div class="form-hint">Shown in this dialog. Plain text; line breaks are preserved.</div>
        </div>
        <div class="form-hint">Directory: <code>${escapeHtml(
          name,
        )}</code> · Saved to <code>server.json</code></div>
      </form>
    `;
    openModal({
      title: `Server information · ${title}`,
      body,
      footer:
        '<button class="button button-ghost" type="button" data-modal-close="true">Cancel</button>' +
        '<button class="button button-primary" id="save-metadata" type="submit" form="metadata-form">Save</button>',
      onMount: (close) => {
        const form = $("#metadata-form");
        const errorBox = $("#metadata-error");
        const saveButton = $("#save-metadata");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          errorBox.classList.remove("visible");
          saveButton.disabled = true;
          saveButton.textContent = "Saving…";
          try {
            await apiFetch(
              `/api/servers/${encodeURIComponent(name)}/metadata`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: $("#metadata-title").value,
                  description: $("#metadata-description").value,
                  usage: $("#metadata-usage").value,
                }),
              },
            );
            toast("Server information saved.", "success");
            close();
            await refreshServers({ silent: true });
          } catch (error) {
            errorBox.textContent = error.message;
            errorBox.classList.add("visible");
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          }
        });
        $("#metadata-title").focus();
      },
    });
  }

  async function showLogs(name) {
    const close = openModal({
      title: `Logs · ${name}`,
      body: '<pre class="log-view" id="log-view">Loading logs…</pre>',
      footer:
        '<button class="button button-ghost" type="button" id="copy-logs">Copy</button>' +
        '<button class="button button-ghost" type="button" id="refresh-logs">Refresh</button>' +
        '<button class="button button-primary" type="button" data-modal-close="true">Close</button>',
      onMount: () => {
        const logView = $("#log-view");
        const load = async () => {
          try {
            const data = await apiFetch(
              `/api/servers/${encodeURIComponent(name)}/logs?lines=500`,
            );
            logView.textContent = data.logs || "No logs yet.";
            logView.scrollTop = logView.scrollHeight;
          } catch (error) {
            logView.textContent = `Failed to read logs: ${error.message}`;
          }
        };
        $("#refresh-logs").addEventListener("click", load);
        $("#copy-logs").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(logView.textContent || "");
            toast("Logs copied.", "success");
          } catch {
            toast("Copy failed. Select the text manually.", "error");
          }
        });
        load();
      },
    });
    return close;
  }

  function handleServerAction(name, action) {
    if (!name || state.busy.has(name)) return;
    if (action === "open") {
      const server = serverByName(name);
      if (server && server.status === "running") openTab(server);
      return;
    }
    if (action === "start") startServer(name);
    if (action === "stop") stopServer(name);
    if (action === "reload") reloadServer(name);
    if (action === "edit") editServer(name);
    if (action === "metadata") showServerInfo(name);
    if (action === "logs") showLogs(name);
    if (action === "external") openExternalFor(name);
  }

  elements.sidebarCollapse.addEventListener("click", () => toggleSidebar(true));
  elements.sidebarHandle.addEventListener("click", () => toggleSidebar(false));
  elements.themeToggle.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  });
  elements.refreshServers.addEventListener("click", () => refreshServers());
  elements.newServer.addEventListener("click", showNewServerDialog);

  elements.serverList.addEventListener("click", (event) => {
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const card = actionNode.closest(".server-card");
    if (!card) return;
    handleServerAction(card.dataset.name, actionNode.dataset.action);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleSidebar();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshServers({ silent: true });
  });

  initTheme();
  initSidebar();
  initSidebarResizer();
  renderSidebar();
  updateEmptyState();
  refreshServers();
  window.setInterval(() => refreshServers({ silent: true }), 2000);
})();
