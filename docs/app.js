(() => {
  "use strict";

  const CONFIG = window.UNISONO_CONFIG;
  const FEATURES = ["ESP", "NOTES", "STATS", "NOT_WORKING"];
  const FEATURE_LABELS = {
    ESP: "ESP",
    NOTES: "Ð—Ð°Ð¼ÐµÑ‚ÐºÐ¸",
    STATS: "Ð¡Ñ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ°",
    NOT_WORKING: "!ÐÐµ Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÐµÑ‚!",
  };

  const state = {
    gistId: CONFIG.gistId,
    token: "",
    githubUser: null,
    authorized: false,
    access: null,
    whitelist: {},
    logs: [],
    revision: null,
    dirty: false,
    selectedSteamId: null,
    pendingAudit: [],
    toastTimer: null,
  };

  const byId = (id) => document.getElementById(id);
  const elements = {
    authGate: byId("authGate"),
    authMessage: byId("authMessage"),
    appShell: byId("appShell"),
    connectionPill: byId("connectionPill"),
    connectionText: byId("connectionText"),
    whitelistCount: byId("whitelistCount"),
    logsCount: byId("logsCount"),
    gistShort: byId("gistShort"),
    footerStatus: byId("footerStatus"),
    clock: byId("clock"),
    toast: byId("toast"),
    steamIdInput: byId("steamIdInput"),
    whitelistRows: byId("whitelistRows"),
    whitelistEmpty: byId("whitelistEmpty"),
    whitelistSearch: byId("whitelistSearch"),
    revisionText: byId("revisionText"),
    saveWhitelist: byId("saveWhitelist"),
    removeUser: byId("removeUser"),
    logsRows: byId("logsRows"),
    logsEmpty: byId("logsEmpty"),
    logsSearch: byId("logsSearch"),
    gistIdInput: byId("gistIdInput"),
    tokenInput: byId("tokenInput"),
    connectGitHub: byId("connectGitHub"),
    disconnectGitHub: byId("disconnectGitHub"),
    githubUser: byId("githubUser"),
    githubRole: byId("githubRole"),
    whitelistFilename: byId("whitelistFilename"),
    logsFilename: byId("logsFilename"),
  };

  function setFooter(message) {
    elements.footerStatus.textContent = message;
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", isError);
    elements.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 4200);
  }

  function setConnectionState(status, text) {
    elements.connectionPill.dataset.state = status;
    elements.connectionText.textContent = text;
  }

  function setAuthMessage(message, stateName = "") {
    elements.authMessage.textContent = message;
    elements.authMessage.classList.toggle("is-error", stateName === "error");
    elements.authMessage.classList.toggle("is-loading", stateName === "loading");
  }

  function accessForLogin(login) {
    return CONFIG.authorizedUsers?.[String(login || "").toLowerCase()] || null;
  }

  function canAccessView(viewName) {
    return (
      state.authorized &&
      Array.isArray(state.access?.views) &&
      state.access.views.includes(viewName)
    );
  }

  function ensureAuthorized() {
    if (state.authorized && state.token && state.githubUser) return true;
    lockApplication("Ð¡ÐµÑÑÐ¸Ñ Ð½Ðµ Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ð·Ð¾Ð²Ð°Ð½Ð°. Ð’Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ Ñ‡ÐµÑ€ÐµÐ· GitHub.");
    return false;
  }

  function githubHeaders(includeJson = false) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (includeJson) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        ...githubHeaders(Boolean(options.body)),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json();
        detail = payload.message ? `: ${payload.message}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`GitHub HTTP ${response.status}${detail}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async function getGist() {
    return apiRequest(`/gists/${encodeURIComponent(state.gistId)}`);
  }

  async function getGistFile(gist, filename, fallback) {
    const file = gist.files?.[filename];
    if (!file) return fallback;
    if (!file.truncated && typeof file.content === "string")
      return file.content;
    if (!file.raw_url) return fallback;
    const response = await fetch(file.raw_url, {
      headers: { Accept: "text/plain" },
    });
    if (!response.ok)
      throw new Error(
        `ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ ${filename}: HTTP ${response.status}`,
      );
    return response.text();
  }

  function normalizePermissions(input) {
    const output = {};
    for (const feature of FEATURES) output[feature] = input?.[feature] === true;
    return output;
  }

  function parseLuaWhitelist(source) {
    const result = {};
    const entryPattern =
      /\[\s*["'](STEAM_\d+:\d+:\d+)["']\s*\]\s*=\s*\{([\s\S]*?)\}/g;
    let entry;
    while ((entry = entryPattern.exec(source)) !== null) {
      const permissions = {};
      for (const feature of FEATURES) {
        const featurePattern = new RegExp(
          `(?:\\[\\s*["']${feature}["']\\s*\\]|${feature})\\s*=\\s*(true|false)`,
          "i",
        );
        const match = entry[2].match(featurePattern);
        permissions[feature] = match?.[1]?.toLowerCase() === "true";
      }
      result[entry[1]] = permissions;
    }
    return result;
  }

  function parseWhitelist(source) {
    const trimmed = String(source || "").trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Whitelist Ð´Ð¾Ð»Ð¶ÐµÐ½ Ð±Ñ‹Ñ‚ÑŒ JSON-Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð¼.");
      }
      const normalized = {};
      for (const [steamId, permissions] of Object.entries(parsed)) {
        if (isValidSteamId(steamId))
          normalized[steamId] = normalizePermissions(permissions);
      }
      return normalized;
    } catch (jsonError) {
      const parsedLua = parseLuaWhitelist(trimmed);
      if (Object.keys(parsedLua).length > 0) return parsedLua;
      throw new Error(`Whitelist Ð½ÐµÐ»ÑŒÐ·Ñ Ñ€Ð°Ð·Ð¾Ð±Ñ€Ð°Ñ‚ÑŒ: ${jsonError.message}`);
    }
  }

  function parseLogs(source) {
    if (!String(source || "").trim()) return [];
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? parsed.slice(-CONFIG.maxLogs) : [];
    } catch {
      return [];
    }
  }

  function revisionOf(gist) {
    return gist.history?.[0]?.version || gist.updated_at || null;
  }

  async function readRemoteState(gist) {
    const [whitelistSource, logsSource] = await Promise.all([
      getGistFile(gist, CONFIG.whitelistFile, "{}"),
      getGistFile(gist, CONFIG.logsFile, "[]"),
    ]);
    return {
      whitelist: parseWhitelist(whitelistSource),
      logs: parseLogs(logsSource),
    };
  }

  function isValidSteamId(value) {
    return /^STEAM_\d+:\d+:\d+$/.test(String(value || "").trim());
  }

  function getEditorPermissions() {
    const permissions = {};
    for (const checkbox of document.querySelectorAll(
      ".permissions input[type='checkbox']",
    )) {
      permissions[checkbox.value] = checkbox.checked;
    }
    return permissions;
  }

  function setEditorPermissions(permissions) {
    for (const checkbox of document.querySelectorAll(
      ".permissions input[type='checkbox']",
    )) {
      checkbox.checked = permissions?.[checkbox.value] === true;
    }
  }

  function clearEditor() {
    state.selectedSteamId = null;
    elements.steamIdInput.value = "";
    setEditorPermissions(
      Object.fromEntries(FEATURES.map((feature) => [feature, true])),
    );
    elements.removeUser.disabled = true;
    renderWhitelist();
  }

  function selectUser(steamId) {
    state.selectedSteamId = steamId;
    elements.steamIdInput.value = steamId;
    setEditorPermissions(state.whitelist[steamId]);
    elements.removeUser.disabled = false;
    renderWhitelist();
  }

  function permissionCell(enabled, label) {
    const cell = document.createElement("td");
    const mark = document.createElement("span");
    mark.className = `permission-state${enabled ? " is-on" : ""}`;
    mark.textContent = enabled ? "âœ“" : "â€”";
    mark.title = `${label}: ${enabled ? "Ñ€Ð°Ð·Ñ€ÐµÑˆÐµÐ½Ð¾" : "Ð·Ð°Ð¿Ñ€ÐµÑ‰ÐµÐ½Ð¾"}`;
    cell.append(mark);
    return cell;
  }

  function renderWhitelist() {
    const query = elements.whitelistSearch.value.trim().toLowerCase();
    const steamIds = Object.keys(state.whitelist).sort();
    const visibleIds = steamIds.filter((steamId) =>
      steamId.toLowerCase().includes(query),
    );
    const fragment = document.createDocumentFragment();

    for (const steamId of visibleIds) {
      const permissions = state.whitelist[steamId];
      const row = document.createElement("tr");
      row.tabIndex = 0;
      row.classList.toggle("is-selected", state.selectedSteamId === steamId);
      row.setAttribute(
        "aria-selected",
        String(state.selectedSteamId === steamId),
      );

      const idCell = document.createElement("td");
      idCell.textContent = steamId;
      row.append(
        idCell,
        permissionCell(permissions.ESP, FEATURE_LABELS.ESP),
        permissionCell(permissions.NOTES, FEATURE_LABELS.NOTES),
        permissionCell(permissions.STATS, FEATURE_LABELS.STATS),
        permissionCell(permissions.NOT_WORKING, FEATURE_LABELS.NOT_WORKING),
      );

      row.addEventListener("click", () => selectUser(steamId));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectUser(steamId);
        }
      });
      fragment.append(row);
    }

    elements.whitelistRows.replaceChildren(fragment);
    elements.whitelistEmpty.hidden = visibleIds.length > 0;
    elements.whitelistCount.textContent = String(steamIds.length);
    elements.saveWhitelist.disabled =
      !state.dirty || !state.authorized || !state.access?.canWrite;
    const shortRevision = state.revision ? state.revision.slice(0, 9) : "â€”";
    elements.revisionText.textContent = `Ð’ÐµÑ€ÑÐ¸Ñ: ${shortRevision}${state.dirty ? " â€¢ ÐµÑÑ‚ÑŒ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ" : ""}`;
  }

  function safeDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "â€”" : date.toLocaleString("ru-RU");
  }

  function appendTextCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = String(text ?? "â€”");
    row.append(cell);
  }

  function renderLogs() {
    const query = elements.logsSearch.value.trim().toLowerCase();
    const logs = [...state.logs]
      .sort((a, b) =>
        String(b.timestamp || "").localeCompare(String(a.timestamp || "")),
      )
      .filter((entry) => {
        const haystack = [
          entry.timestamp,
          entry.steamid,
          entry.nick,
          entry.action,
          entry.detail,
          entry.source,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    const fragment = document.createDocumentFragment();

    for (const entry of logs) {
      const row = document.createElement("tr");
      appendTextCell(row, safeDate(entry.timestamp));
      appendTextCell(
        row,
        `${entry.nick || "UNKNOWN"} Â· ${entry.steamid || "UNKNOWN"}`,
      );
      appendTextCell(row, entry.action);
      appendTextCell(row, entry.detail || "â€”");
      appendTextCell(row, entry.source || "â€”");
      fragment.append(row);
    }

    elements.logsRows.replaceChildren(fragment);
    elements.logsEmpty.hidden = logs.length > 0;
    elements.logsCount.textContent = String(state.logs.length);
  }

  function renderConnection() {
    elements.gistShort.textContent = state.gistId
      ? `${state.gistId.slice(0, 8)}â€¦`
      : "â€”";
    elements.githubUser.textContent = state.githubUser?.login || "Ð½Ðµ Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡Ñ‘Ð½";
    elements.githubRole.textContent = state.access?.role || "â€”";
    elements.whitelistFilename.textContent = CONFIG.whitelistFile;
    elements.logsFilename.textContent = CONFIG.logsFile;
    elements.disconnectGitHub.disabled = !state.authorized;
    elements.connectGitHub.disabled = state.authorized;
    elements.saveWhitelist.disabled =
      !state.dirty || !state.authorized || !state.access?.canWrite;
    if (state.authorized && state.githubUser) {
      setConnectionState("online", `${state.access.role}: ${state.githubUser.login}`);
    } else {
      setConnectionState("offline", "ÐÐµ Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ð·Ð¾Ð²Ð°Ð½");
    }

    for (const button of document.querySelectorAll(".nav-button")) {
      button.hidden = !canAccessView(button.dataset.view);
    }
  }

  function renderAll() {
    renderWhitelist();
    renderLogs();
    renderConnection();
  }

  async function loadGistData(
    message = "Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð¸Ð· GitHub Gist...",
    suppliedGist = null,
  ) {
    if (!ensureAuthorized()) return;
    setFooter(message);
    try {
      const gist = suppliedGist || (await getGist());
      const remote = await readRemoteState(gist);
      state.whitelist = remote.whitelist;
      state.logs = remote.logs;
      state.revision = revisionOf(gist);
      state.dirty = false;
      state.pendingAudit = [];
      state.selectedSteamId = null;
      renderAll();
      setFooter(
        `Ð”Ð°Ð½Ð½Ñ‹Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ¶ÐµÐ½Ñ‹ â€¢ ${Object.keys(state.whitelist).length} Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹ â€¢ ${state.logs.length} ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ð¹`,
      );
    } catch (error) {
      setConnectionState("error", "ÐžÑˆÐ¸Ð±ÐºÐ° GitHub");
      setFooter(error.message);
      showToast(error.message, true);
      throw error;
    }
  }

  function queueAudit(action, steamId) {
    state.pendingAudit.push({
      timestamp: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
      steamid: "WEB_ADMIN",
      steamid64: "0",
      nick: state.githubUser?.login || "GitHub Pages admin",
      action,
      detail: steamId,
      map: "web",
      source: "github-pages",
    });
  }

  function markDirty(message) {
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("Ð£ ÑÑ‚Ð¾Ð³Ð¾ Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚Ð° Ð½ÐµÑ‚ Ð¿Ñ€Ð°Ð²Ð° Ð¸Ð·Ð¼ÐµÐ½ÑÑ‚ÑŒ whitelist.", true);
      return;
    }
    state.dirty = true;
    renderWhitelist();
    setFooter(`${message} ÐÐ°Ð¶Ð¼Ð¸Ñ‚Ðµ Â«Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ð² GitHubÂ».`);
  }

  function upsertUser() {
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("Ð£ ÑÑ‚Ð¾Ð³Ð¾ Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚Ð° Ð½ÐµÑ‚ Ð¿Ñ€Ð°Ð²Ð° Ð¸Ð·Ð¼ÐµÐ½ÑÑ‚ÑŒ whitelist.", true);
      return;
    }
    const steamId = elements.steamIdInput.value.trim();
    if (!isValidSteamId(steamId)) {
      showToast("SteamID Ð´Ð¾Ð»Ð¶ÐµÐ½ Ð²Ñ‹Ð³Ð»ÑÐ´ÐµÑ‚ÑŒ ÐºÐ°Ðº STEAM_0:0:123456789.", true);
      return;
    }
    state.whitelist[steamId] = normalizePermissions(getEditorPermissions());
    state.selectedSteamId = steamId;
    queueAudit("whitelist.upsert", steamId);
    markDirty(`${steamId} Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð² Ñ‡ÐµÑ€Ð½Ð¾Ð²Ð¸Ðº.`);
  }

  function removeUser() {
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("Ð£ ÑÑ‚Ð¾Ð³Ð¾ Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚Ð° Ð½ÐµÑ‚ Ð¿Ñ€Ð°Ð²Ð° Ð¸Ð·Ð¼ÐµÐ½ÑÑ‚ÑŒ whitelist.", true);
      return;
    }
    const steamId = state.selectedSteamId || elements.steamIdInput.value.trim();
    if (!state.whitelist[steamId]) {
      showToast("Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð²Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ.", true);
      return;
    }
    if (!window.confirm(`Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ ${steamId} Ð¸Ð· whitelist?`)) return;
    delete state.whitelist[steamId];
    queueAudit("whitelist.remove", steamId);
    clearEditor();
    markDirty(`${steamId} ÑƒÐ´Ð°Ð»Ñ‘Ð½ Ð¸Ð· Ñ‡ÐµÑ€Ð½Ð¾Ð²Ð¸ÐºÐ°.`);
  }

  async function saveChanges() {
    if (!ensureAuthorized()) return;
    if (!state.access?.canWrite) {
      showToast("Ð£ ÑÑ‚Ð¾Ð³Ð¾ Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚Ð° Ð½ÐµÑ‚ Ð¿Ñ€Ð°Ð²Ð° ÑÐ¾Ñ…Ñ€Ð°Ð½ÑÑ‚ÑŒ whitelist.", true);
      return;
    }
    if (!state.dirty) return;

    elements.saveWhitelist.disabled = true;
    setFooter("ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð°ÐºÑ‚ÑƒÐ°Ð»ÑŒÐ½Ð¾Ð¹ Ð²ÐµÑ€ÑÐ¸Ð¸ Gist...");
    try {
      const latestGist = await getGist();
      const latestRevision = revisionOf(latestGist);
      if (
        state.revision &&
        latestRevision &&
        latestRevision !== state.revision
      ) {
        throw new Error(
          "Gist Ð¸Ð·Ð¼ÐµÐ½Ð¸Ð»ÑÑ Ð¿Ð¾ÑÐ»Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸. ÐÐ°Ð¶Ð¼Ð¸Ñ‚Ðµ Â«ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÂ» Ð¸ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ.",
        );
      }

      const latestLogsSource = await getGistFile(
        latestGist,
        CONFIG.logsFile,
        "[]",
      );
      const latestLogs = parseLogs(latestLogsSource);
      const auditRows = state.pendingAudit.map((entry) => ({
        ...entry,
        nick: state.githubUser?.login || entry.nick,
      }));
      const mergedLogs = [...latestLogs, ...auditRows].slice(-CONFIG.maxLogs);
      const payload = {
        files: {
          [CONFIG.whitelistFile]: {
            content: JSON.stringify(state.whitelist, null, 2),
          },
          [CONFIG.logsFile]: {
            content: JSON.stringify(mergedLogs, null, 2),
          },
        },
      };

      const updatedGist = await apiRequest(
        `/gists/${encodeURIComponent(state.gistId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      state.logs = mergedLogs;
      state.revision = revisionOf(updatedGist);
      state.dirty = false;
      state.pendingAudit = [];
      renderAll();
      setFooter("Whitelist ÑÐ¾Ñ…Ñ€Ð°Ð½Ñ‘Ð½ Ð² GitHub Gist.");
      showToast("Ð˜Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.");
    } catch (error) {
      setFooter(error.message);
      showToast(error.message, true);
      renderWhitelist();
    }
  }

  async function connectGitHub() {
    const token = elements.tokenInput.value.trim();
    if (!token) {
      setAuthMessage("Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ GitHub token.", "error");
      elements.tokenInput.focus();
      return;
    }

    state.gistId = CONFIG.gistId;
    state.token = token;
    elements.connectGitHub.disabled = true;
    setAuthMessage("ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÑŽ GitHub-Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚...", "loading");
    try {
      const githubUser = await apiRequest("/user");
      const access = accessForLogin(githubUser.login);
      if (!access) {
        throw new Error(
          `ÐÐºÐºÐ°ÑƒÐ½Ñ‚Ñƒ ${githubUser.login} Ð´Ð¾ÑÑ‚ÑƒÐ¿ Ðº ÑÑ‚Ð¾Ð¹ Ð¿Ð°Ð½ÐµÐ»Ð¸ Ð½Ðµ Ñ€Ð°Ð·Ñ€ÐµÑˆÑ‘Ð½.`,
        );
      }

      state.githubUser = githubUser;
      state.access = access;
      state.authorized = true;

      setAuthMessage("ÐÐºÐºÐ°ÑƒÐ½Ñ‚ Ñ€Ð°Ð·Ñ€ÐµÑˆÑ‘Ð½. Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÑŽ Ð·Ð°Ñ‰Ð¸Ñ‰Ñ‘Ð½Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ...", "loading");
      const gist = await getGist();
      const gistOwner = gist.owner?.login;
      if (!gistOwner || !accessForLogin(gistOwner)) {
        throw new Error("Ð’Ð»Ð°Ð´ÐµÐ»ÐµÑ† Ñ…Ñ€Ð°Ð½Ð¸Ð»Ð¸Ñ‰Ð° Ð½Ðµ Ð²Ñ…Ð¾Ð´Ð¸Ñ‚ Ð² ÑÐ¿Ð¸ÑÐ¾Ðº Ð°Ð´Ð¼Ð¸Ð½Ð¸ÑÑ‚Ñ€Ð°Ñ‚Ð¾Ñ€Ð¾Ð².");
      }

      await loadGistData(
        `GitHub Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡Ñ‘Ð½: ${state.githubUser.login}. Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Gist...`,
        gist,
      );
      unlockApplication();
      elements.tokenInput.value = "";
      renderAll();
      showToast(`Ð’Ñ…Ð¾Ð´ Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½: ${state.githubUser.login}.`);
    } catch (error) {
      clearSession();
      setAuthMessage(`Ð’Ñ…Ð¾Ð´ Ð½Ðµ Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½: ${error.message}`, "error");
      elements.tokenInput.select();
    } finally {
      elements.connectGitHub.disabled = false;
    }
  }

  function clearSession() {
    state.token = "";
    state.githubUser = null;
    state.authorized = false;
    state.access = null;
    state.whitelist = {};
    state.logs = [];
    state.revision = null;
    state.dirty = false;
    state.selectedSteamId = null;
    state.pendingAudit = [];
    elements.tokenInput.value = "";
    elements.gistIdInput.value = CONFIG.gistId;
    clearEditor();
    renderAll();
  }

  function lockApplication(message = "ÐžÐ¶Ð¸Ð´Ð°Ð½Ð¸Ðµ Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ð¸") {
    document.body.classList.add("is-locked");
    elements.appShell.hidden = true;
    elements.authGate.hidden = false;
    setAuthMessage(message);
  }

  function unlockApplication() {
    document.body.classList.remove("is-locked");
    elements.authGate.hidden = true;
    elements.appShell.hidden = false;
    switchView(state.access.views[0] || "connection");
  }

  async function disconnectGitHub() {
    if (
      state.dirty &&
      !window.confirm("Ð’Ñ‹Ð¹Ñ‚Ð¸ Ð¸ Ð¾Ñ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð½ÐµÑÐ¾Ñ…Ñ€Ð°Ð½Ñ‘Ð½Ð½Ñ‹Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ?")
    ) {
      return;
    }
    clearSession();
    lockApplication("Ð¡ÐµÑÑÐ¸Ñ Ð·Ð°Ð²ÐµÑ€ÑˆÐµÐ½Ð°. Ð¢Ð¾ÐºÐµÐ½ Ð¸ Ð´Ð°Ð½Ð½Ñ‹Ðµ ÑƒÐ´Ð°Ð»ÐµÐ½Ñ‹ Ð¸Ð· Ð¿Ð°Ð¼ÑÑ‚Ð¸.");
    elements.tokenInput.focus();
  }

  function reloadWithConfirmation() {
    if (
      state.dirty &&
      !window.confirm("ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð½ÐµÑÐ¾Ñ…Ñ€Ð°Ð½Ñ‘Ð½Ð½Ñ‹Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð¸ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð·Ð°Ð½Ð¾Ð²Ð¾?")
    ) {
      return;
    }
    loadGistData().catch(() => {});
  }

  function switchView(viewName) {
    if (!canAccessView(viewName)) return;
    for (const button of document.querySelectorAll(".nav-button")) {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    }
    for (const view of document.querySelectorAll(".view")) {
      view.classList.toggle("is-active", view.id === `view-${viewName}`);
    }
  }

  function bindEvents() {
    for (const button of document.querySelectorAll(".nav-button")) {
      button.addEventListener("click", () => switchView(button.dataset.view));
    }
    byId("upsertUser").addEventListener("click", upsertUser);
    elements.removeUser.addEventListener("click", removeUser);
    byId("clearEditor").addEventListener("click", clearEditor);
    elements.saveWhitelist.addEventListener("click", saveChanges);
    byId("reloadWhitelist").addEventListener("click", reloadWithConfirmation);
    byId("reloadLogs").addEventListener("click", reloadWithConfirmation);
    elements.connectGitHub.addEventListener("click", connectGitHub);
    elements.disconnectGitHub.addEventListener("click", disconnectGitHub);
    elements.whitelistSearch.addEventListener("input", renderWhitelist);
    elements.logsSearch.addEventListener("input", renderLogs);
    elements.steamIdInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") upsertUser();
    });
    elements.tokenInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") connectGitHub();
    });
    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function startClock() {
    const update = () => {
      elements.clock.textContent = new Date().toLocaleTimeString("ru-RU");
    };
    update();
    setInterval(update, 1000);
  }

  async function initialize() {
    elements.gistIdInput.value = state.gistId;
    bindEvents();
    startClock();
    clearSession();
    lockApplication();
    elements.tokenInput.focus();
  }

  initialize();
})();
