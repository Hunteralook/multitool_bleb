(() => {
  "use strict";

  const CONFIG = window.UNISONO_CONFIG;
  const FEATURES = ["ESP", "NOTES", "STATS", "NOT_WORKING"];
  const FEATURE_LABELS = {
    ESP: "ESP",
    NOTES: "Заметки",
    STATS: "Статистика",
    NOT_WORKING: "!Не работает!",
  };

  const state = {
    gistId: CONFIG.gistId,
    token: "",
    githubUser: null,
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
        `Не удалось загрузить ${filename}: HTTP ${response.status}`,
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
        throw new Error("Whitelist должен быть JSON-объектом.");
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
      throw new Error(`Whitelist нельзя разобрать: ${jsonError.message}`);
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
    mark.textContent = enabled ? "✓" : "—";
    mark.title = `${label}: ${enabled ? "разрешено" : "запрещено"}`;
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
    elements.saveWhitelist.disabled = !state.dirty || !state.token;
    const shortRevision = state.revision ? state.revision.slice(0, 9) : "—";
    elements.revisionText.textContent = `Версия: ${shortRevision}${state.dirty ? " • есть изменения" : ""}`;
  }

  function safeDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  }

  function appendTextCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = String(text ?? "—");
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
        `${entry.nick || "UNKNOWN"} · ${entry.steamid || "UNKNOWN"}`,
      );
      appendTextCell(row, entry.action);
      appendTextCell(row, entry.detail || "—");
      appendTextCell(row, entry.source || "—");
      fragment.append(row);
    }

    elements.logsRows.replaceChildren(fragment);
    elements.logsEmpty.hidden = logs.length > 0;
    elements.logsCount.textContent = String(state.logs.length);
  }

  function renderConnection() {
    elements.gistShort.textContent = state.gistId
      ? `${state.gistId.slice(0, 8)}…`
      : "—";
    elements.githubUser.textContent = state.githubUser?.login || "не подключён";
    elements.whitelistFilename.textContent = CONFIG.whitelistFile;
    elements.logsFilename.textContent = CONFIG.logsFile;
    elements.disconnectGitHub.disabled = !state.token;
    elements.connectGitHub.disabled = Boolean(state.token);
    elements.saveWhitelist.disabled = !state.dirty || !state.token;
    if (state.token && state.githubUser) {
      setConnectionState("online", `GitHub: ${state.githubUser.login}`);
    } else {
      setConnectionState("offline", "Только чтение");
    }
  }

  function renderAll() {
    renderWhitelist();
    renderLogs();
    renderConnection();
  }

  async function loadGistData(message = "Загрузка данных из GitHub Gist...") {
    setFooter(message);
    try {
      const gist = await getGist();
      const remote = await readRemoteState(gist);
      state.whitelist = remote.whitelist;
      state.logs = remote.logs;
      state.revision = revisionOf(gist);
      state.dirty = false;
      state.pendingAudit = [];
      state.selectedSteamId = null;
      renderAll();
      setFooter(
        `Данные загружены • ${Object.keys(state.whitelist).length} пользователей • ${state.logs.length} событий`,
      );
    } catch (error) {
      setConnectionState("error", "Ошибка GitHub");
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
    state.dirty = true;
    renderWhitelist();
    setFooter(`${message} Нажмите «Сохранить в GitHub».`);
  }

  function upsertUser() {
    const steamId = elements.steamIdInput.value.trim();
    if (!isValidSteamId(steamId)) {
      showToast("SteamID должен выглядеть как STEAM_0:0:123456789.", true);
      return;
    }
    state.whitelist[steamId] = normalizePermissions(getEditorPermissions());
    state.selectedSteamId = steamId;
    queueAudit("whitelist.upsert", steamId);
    markDirty(`${steamId} добавлен в черновик.`);
  }

  function removeUser() {
    const steamId = state.selectedSteamId || elements.steamIdInput.value.trim();
    if (!state.whitelist[steamId]) {
      showToast("Сначала выберите пользователя.", true);
      return;
    }
    if (!window.confirm(`Удалить ${steamId} из whitelist?`)) return;
    delete state.whitelist[steamId];
    queueAudit("whitelist.remove", steamId);
    clearEditor();
    markDirty(`${steamId} удалён из черновика.`);
  }

  async function saveChanges() {
    if (!state.token) {
      showToast("Сначала подключите GitHub token.", true);
      return;
    }
    if (!state.dirty) return;

    elements.saveWhitelist.disabled = true;
    setFooter("Проверка актуальной версии Gist...");
    try {
      const latestGist = await getGist();
      const latestRevision = revisionOf(latestGist);
      if (
        state.revision &&
        latestRevision &&
        latestRevision !== state.revision
      ) {
        throw new Error(
          "Gist изменился после загрузки. Нажмите «Обновить» и повторите изменения.",
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
      setFooter("Whitelist сохранён в GitHub Gist.");
      showToast("Изменения успешно сохранены.");
    } catch (error) {
      setFooter(error.message);
      showToast(error.message, true);
      renderWhitelist();
    }
  }

  async function connectGitHub() {
    const gistId = elements.gistIdInput.value.trim();
    const token = elements.tokenInput.value.trim();
    if (!/^[a-f0-9]+$/i.test(gistId)) {
      showToast("Некорректный Gist ID.", true);
      return;
    }
    if (!token) {
      showToast("Введите GitHub token.", true);
      return;
    }
    if (state.dirty && gistId !== state.gistId) {
      const discard = window.confirm(
        "Gist ID изменён. Отменить несохранённый черновик и загрузить другой Gist?",
      );
      if (!discard) return;
    }

    const canKeepLoadedData = Boolean(state.revision && gistId === state.gistId);
    state.gistId = gistId;
    state.token = token;
    elements.tokenInput.value = "";
    setFooter("Проверка GitHub token...");
    try {
      state.githubUser = await apiRequest("/user");
      if (canKeepLoadedData) {
        renderAll();
        setFooter(`GitHub подключён: ${state.githubUser.login}.`);
      } else {
        await loadGistData(
          `GitHub подключён: ${state.githubUser.login}. Загрузка Gist...`,
        );
      }
      renderConnection();
      showToast(`Подключён GitHub-аккаунт ${state.githubUser.login}.`);
    } catch (error) {
      state.token = "";
      state.githubUser = null;
      renderConnection();
      showToast(`Подключение не удалось: ${error.message}`, true);
    }
  }

  async function disconnectGitHub() {
    state.token = "";
    state.githubUser = null;
    elements.tokenInput.value = "";
    renderConnection();
    showToast("GitHub token удалён из памяти вкладки.");
    setFooter(
      state.dirty
        ? "GitHub отключён. Черновик сохранён только в этой вкладке."
        : "GitHub отключён. Данные доступны только для чтения.",
    );
  }

  function reloadWithConfirmation() {
    if (
      state.dirty &&
      !window.confirm("Отменить несохранённые изменения и загрузить данные заново?")
    ) {
      return;
    }
    loadGistData().catch(() => {});
  }

  function switchView(viewName) {
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
    renderAll();
    try {
      await loadGistData();
    } catch {
      // loadGistData already displayed the failure.
    }
  }

  initialize();
})();
