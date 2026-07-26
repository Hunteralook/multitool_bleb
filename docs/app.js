(() => {
  "use strict";

  const CONFIG = window.UNISONO_CONFIG;
  const FEATURES = ["ESP", "NOTES", "STATS", "BODY_FX", "NOT_WORKING"];
  const FEATURE_LABELS = {
    ESP: "ESP",
    NOTES: "Заметки",
    STATS: "Статистика",
    BODY_FX: "Эффекты тела",
    NOT_WORKING: "!Не работает!",
  };
  const ACTION_LABELS = Object.freeze({
    "menu.open": "Открытие Multi‑Tool",
    "shader.select": "Выбор шейдера",
    "shader.reset": "Сброс шейдеров",
    "font.esp.apply": "Шрифт ESP",
    "font.menu.apply": "Шрифт меню",
    "physgun.give": "Выдача физгана",
    "physgun.rainbow": "Радужный физган",
    "bodyfx.toggle": "Переключение эффекта тела",
    "bodyfx.clear": "Очистка энергетического шлейфа",
    "bodyfx.bone": "Выбор части тела",
    "bodyfx.style": "Стиль эффекта тела",
    "bodyfx.color": "Цвет эффекта тела",
    "bodyfx.light": "Освещение эффекта тела",
    "bodyfx.visibility": "Видимость эффекта тела",
    "bodyfx.reset": "Сброс эффектов тела",
    "cvar.change": "Изменение CVar",
    "console.help": "Справка консоли",
    "console.lua": "Lua‑консоль",
    "console.command": "Клиентская команда",
    "update.check": "Проверка обновления",
    "update.install": "Установка обновления",
    "client.version": "Отчёт о версии клиента",
    "client.update.request": "Команда обновления клиента",
    "client.update.received": "Получение команды обновления",
    "client.update.install": "Принудительное обновление клиента",
    "script.disable": "Отключение скрипта",
    "sound.stop": "Остановка звуков",
    "whitelist.open": "Открытие whitelist",
    "whitelist.reload": "Обновление whitelist",
    "whitelist.upsert": "Добавление в whitelist",
    "whitelist.remove": "Удаление из whitelist",
    "whitelist.broadcast": "Синхронизация whitelist",
    "github_token.save": "Сохранение GitHub‑токена",
    "github_token.remove": "Удаление GitHub‑токена",
    "logs.sync": "Выгрузка логов",
    "qmenu.color": "Цвет Q‑меню",
    "qmenu.rainbow": "Радужное Q‑меню",
    "qmenu.reset": "Сброс Q‑меню",
    "chat.command": "Команда в чат",
    "notes.copy_position": "Копирование координат",
    "notes.create_here": "3D‑заметка рядом",
    "notes.create_aim": "3D‑заметка по прицелу",
    "notes.remove": "Удаление 3D‑заметки",
    "notes.rename": "Переименование 3D‑заметки",
    "notes.clear": "Очистка 3D‑заметок",
    "stats.reset": "Сброс статистики",
    "settings.reset_all": "Сброс всех настроек",
    "theme.apply": "Смена темы",
    "esp.toggle": "Переключение ESP",
    "esp.distance": "Дальность ESP",
    "esp.role_color": "Цвет роли ESP",
    "esp.layout": "Разметка ESP",
    "esp.reset": "Сброс ESP",
    "explorer.search": "Поиск в исследователе",
    "explorer.physgun_scan": "Сканирование физгана",
    "explorer.hooks": "Просмотр хуков",
    "admin.command": "Админская команда",
  });
  const RESULT_LABELS = Object.freeze({
    success: "Успешно",
    error: "Ошибка",
    cancelled: "Отменено",
    info: "Событие",
  });
  const SOURCE_LABELS = Object.freeze({
    "game-client": "GMod-клиент",
    "admin-client": "GMod-админ",
    "client-peer": "GMod peer",
    "github-pages": "Веб-панель",
  });
  const TOKEN_STORAGE_KEY = "unisono.github-token.v1";

  const state = {
    gistId: CONFIG.gistId,
    token: "",
    githubUser: null,
    authorized: false,
    access: null,
    whitelist: {},
    logs: [],
    commands: [],
    revision: null,
    dirty: false,
    selectedSteamId: null,
    selectedLogSteamId: "*",
    commandBusy: false,
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
    versionsCount: byId("versionsCount"),
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
    logsSteamIdFilter: byId("logsSteamIdFilter"),
    logsGroupSummary: byId("logsGroupSummary"),
    versionsRows: byId("versionsRows"),
    versionsEmpty: byId("versionsEmpty"),
    versionsSearch: byId("versionsSearch"),
    recommendedVersion: byId("recommendedVersion"),
    forceUpdateAll: byId("forceUpdateAll"),
    versionCommandRows: byId("versionCommandRows"),
    commandsEmpty: byId("commandsEmpty"),
    commandsCount: byId("commandsCount"),
    gistIdInput: byId("gistIdInput"),
    tokenInput: byId("tokenInput"),
    connectGitHub: byId("connectGitHub"),
    disconnectGitHub: byId("disconnectGitHub"),
    githubUser: byId("githubUser"),
    githubRole: byId("githubRole"),
    whitelistFilename: byId("whitelistFilename"),
    logsFilename: byId("logsFilename"),
    commandsFilename: byId("commandsFilename"),
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

  function readStoredToken() {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() || "";
    } catch {
      return "";
    }
  }

  function storeToken(token) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return true;
    } catch {
      return false;
    }
  }

  function forgetStoredToken() {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // The in-memory session is still cleared when browser storage is blocked.
    }
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
    lockApplication("Сессия не авторизована. Войдите через GitHub.");
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
      return Array.isArray(parsed)
        ? parsed
            .filter((entry) => entry && typeof entry === "object")
            .slice(-CONFIG.maxLogs)
        : [];
    } catch {
      return [];
    }
  }

  function parseCommands(source) {
    if (!String(source || "").trim()) return [];
    try {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (command) =>
            command &&
            typeof command === "object" &&
            typeof command.id === "string" &&
            command.action === "client.force_update" &&
            (command.target === "*" || isValidSteamId(command.target)),
        )
        .slice(-CONFIG.maxCommands);
    } catch {
      return [];
    }
  }

  function revisionOf(gist) {
    return gist.history?.[0]?.version || gist.updated_at || null;
  }

  async function readRemoteState(gist) {
    const [whitelistSource, logsSource, commandsSource] = await Promise.all([
      getGistFile(gist, CONFIG.whitelistFile, "{}"),
      getGistFile(gist, CONFIG.logsFile, "[]"),
      getGistFile(gist, CONFIG.commandsFile, "[]"),
    ]);
    return {
      whitelist: parseWhitelist(whitelistSource),
      logs: parseLogs(logsSource),
      commands: parseCommands(commandsSource),
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
        permissionCell(permissions.BODY_FX, FEATURE_LABELS.BODY_FX),
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

  function appendLogCell(row, primary, secondary = "", className = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    const main = document.createElement("span");
    main.className = "log-primary";
    main.textContent = String(primary || "—");
    cell.append(main);
    if (secondary) {
      const meta = document.createElement("span");
      meta.className = "log-meta";
      meta.textContent = String(secondary);
      cell.append(meta);
    }
    row.append(cell);
  }

  function normalizedResult(entry) {
    const result = String(entry?.result || "info").toLowerCase();
    return RESULT_LABELS[result] ? result : "info";
  }

  function actionLabel(action) {
    return ACTION_LABELS[String(action || "")] || String(action || "Неизвестная функция");
  }

  function appendResultCell(row, entry) {
    const result = normalizedResult(entry);
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `log-result is-${result}`;
    badge.textContent = RESULT_LABELS[result];
    cell.append(badge);
    row.append(cell);
  }

  function timestampMs(entry) {
    const parsed = new Date(entry?.timestamp || "").getTime();
    if (!Number.isNaN(parsed)) return parsed;
    return Number(entry?.unix || 0) * 1000;
  }

  function parseSemanticVersion(value) {
    const match = String(value || "").match(/v?(\d+)\.(\d+)\.(\d+)/i);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareClientVersions(left, right) {
    const a = parseSemanticVersion(left);
    const b = parseSemanticVersion(right);
    if (!a || !b) return null;
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
  }

  function versionState(version) {
    const comparison = compareClientVersions(
      version,
      CONFIG.recommendedClientVersion,
    );
    if (comparison === null) {
      return {key: "unknown", label: "Неизвестна"};
    }
    if (comparison < 0) return {key: "outdated", label: "Устарела"};
    if (comparison > 0) return {key: "newer", label: "Новее панели"};
    return {key: "current", label: "Актуальна"};
  }

  function clientRegistry() {
    const clients = new Map();
    for (const entry of state.logs) {
      const steamId = String(entry?.steamid || "");
      if (!isValidSteamId(steamId)) continue;
      const seenAt = timestampMs(entry);
      const current = clients.get(steamId);
      if (!current) {
        clients.set(steamId, {
          steamid: steamId,
          steamid64: entry.steamid64 || "",
          nick: entry.nick || "UNKNOWN",
          version: entry.version || "unknown",
          timestamp: entry.timestamp,
          unix: entry.unix,
          server: entry.server || "unknown",
          map: entry.map || "unknown",
          seenAt,
          events: 1,
        });
      } else {
        current.events += 1;
        if (seenAt >= current.seenAt) {
          Object.assign(current, {
            steamid64: entry.steamid64 || current.steamid64,
            nick: entry.nick || current.nick,
            version: entry.version || current.version,
            timestamp: entry.timestamp || current.timestamp,
            unix: entry.unix || current.unix,
            server: entry.server || current.server,
            map: entry.map || current.map,
            seenAt,
          });
        }
      }
    }
    return [...clients.values()].sort((a, b) => b.seenAt - a.seenAt);
  }

  function commandAcknowledgements(commandId, steamId = "") {
    return state.logs.filter(
      (entry) =>
        entry?.command_id === commandId &&
        entry.action === "client.update.received" &&
        (!steamId || entry.steamid === steamId),
    );
  }

  function latestCommandForClient(steamId) {
    return [...state.commands]
      .filter((command) => command.target === "*" || command.target === steamId)
      .sort(
        (a, b) =>
          Number(b.created_unix || 0) - Number(a.created_unix || 0),
      )[0];
  }

  function commandState(command, steamId = "") {
    if (!command) return null;
    const acknowledgements = commandAcknowledgements(command.id, steamId);
    if (acknowledgements.length > 0) {
      return {
        key: "received",
        label: steamId ? "Команда получена" : `Получили: ${acknowledgements.length}`,
      };
    }
    if (Number(command.expires_unix || 0) <= Math.floor(Date.now() / 1000)) {
      return {key: "expired", label: "Истекла"};
    }
    return {key: "pending", label: "Ожидает клиента"};
  }

  function appendBadgeCell(row, label, className) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = label;
    cell.append(badge);
    row.append(cell);
  }

  function renderVersions() {
    const query = elements.versionsSearch.value.trim().toLowerCase();
    const clients = clientRegistry();
    const visibleClients = clients.filter((client) =>
      [
        client.steamid,
        client.steamid64,
        client.nick,
        client.version,
        client.server,
        client.map,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
    const fragment = document.createDocumentFragment();

    for (const client of visibleClients) {
      const row = document.createElement("tr");
      appendLogCell(row, client.steamid, client.steamid64);
      appendLogCell(row, client.nick, `${client.events} событий`);
      appendTextCell(row, client.version || "unknown");
      appendTextCell(row, safeDate(client.timestamp || client.unix * 1000));
      appendLogCell(
        row,
        client.server || "unknown",
        client.map ? `Карта: ${client.map}` : "",
      );

      const statusCell = document.createElement("td");
      const version = versionState(client.version);
      const versionBadge = document.createElement("span");
      versionBadge.className = `version-badge is-${version.key}`;
      versionBadge.textContent = version.label;
      statusCell.append(versionBadge);
      const recentCommand = latestCommandForClient(client.steamid);
      const updateState = commandState(recentCommand, client.steamid);
      if (updateState) {
        const commandMeta = document.createElement("span");
        commandMeta.className = "log-meta";
        commandMeta.textContent = updateState.label;
        statusCell.append(commandMeta);
      }
      row.append(statusCell);

      const actionCell = document.createElement("td");
      const updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.className = "button secondary table-action";
      updateButton.textContent = "Обновить";
      updateButton.dataset.forceUpdate = client.steamid;
      updateButton.disabled = state.commandBusy || !state.access?.canWrite;
      updateButton.addEventListener("click", () =>
        enqueueForceUpdate(client.steamid),
      );
      actionCell.append(updateButton);
      row.append(actionCell);
      fragment.append(row);
    }

    elements.versionsRows.replaceChildren(fragment);
    elements.versionsEmpty.hidden = visibleClients.length > 0;
    elements.versionsCount.textContent = String(clients.length);
    elements.recommendedVersion.textContent =
      `Актуальная: ${CONFIG.recommendedClientVersion}`;
    elements.forceUpdateAll.disabled =
      state.commandBusy || clients.length === 0 || !state.access?.canWrite;

    const commandFragment = document.createDocumentFragment();
    const commands = [...state.commands]
      .sort(
        (a, b) =>
          Number(b.created_unix || 0) - Number(a.created_unix || 0),
      )
      .slice(0, 20);
    for (const command of commands) {
      const row = document.createElement("tr");
      appendTextCell(
        row,
        safeDate(command.created_at || Number(command.created_unix || 0) * 1000),
      );
      appendTextCell(
        row,
        command.target === "*" ? "Все клиенты" : command.target,
      );
      appendTextCell(row, command.issued_by || "—");
      appendTextCell(
        row,
        command.requested_version || CONFIG.recommendedClientVersion,
      );
      const status = commandState(command);
      appendBadgeCell(
        row,
        status?.label || "Неизвестно",
        `command-badge is-${status?.key || "unknown"}`,
      );
      commandFragment.append(row);
    }
    elements.versionCommandRows.replaceChildren(commandFragment);
    elements.commandsEmpty.hidden = commands.length > 0;
    elements.commandsCount.textContent = `${state.commands.length} команд`;
  }

  function renderLogSteamIdOptions() {
    const players = new Map();
    for (const entry of state.logs) {
      const steamId = String(entry?.steamid || "UNKNOWN");
      if (!players.has(steamId)) players.set(steamId, entry?.nick || "UNKNOWN");
    }
    const selected = players.has(state.selectedLogSteamId)
      ? state.selectedLogSteamId
      : "*";
    const fragment = document.createDocumentFragment();
    const allOption = document.createElement("option");
    allOption.value = "*";
    allOption.textContent = "Все SteamID";
    fragment.append(allOption);
    for (const steamId of [...players.keys()].sort()) {
      const option = document.createElement("option");
      option.value = steamId;
      option.textContent = `${steamId} · ${players.get(steamId)}`;
      fragment.append(option);
    }
    elements.logsSteamIdFilter.replaceChildren(fragment);
    elements.logsSteamIdFilter.value = selected;
    state.selectedLogSteamId = selected;
  }

  function renderLogs() {
    renderLogSteamIdOptions();
    const query = elements.logsSearch.value.trim().toLowerCase();
    const selectedSteamId = state.selectedLogSteamId;
    const logs = [...state.logs]
      .sort((a, b) => timestampMs(b) - timestampMs(a))
      .filter((entry) => {
        if (
          selectedSteamId !== "*" &&
          String(entry.steamid || "UNKNOWN") !== selectedSteamId
        ) {
          return false;
        }
        const haystack = [
          entry.timestamp,
          entry.steamid,
          entry.nick,
          entry.action,
          actionLabel(entry.action),
          entry.category,
          entry.detail,
          entry.result,
          RESULT_LABELS[normalizedResult(entry)],
          entry.map,
          entry.server,
          entry.version,
          entry.source,
          SOURCE_LABELS[entry.source],
          entry.command_id,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });

    const groups = new Map();
    for (const entry of logs) {
      const steamId = String(entry.steamid || "UNKNOWN");
      if (!groups.has(steamId)) groups.set(steamId, []);
      groups.get(steamId).push(entry);
    }
    const orderedGroups = [...groups.entries()].sort(
      (a, b) => timestampMs(b[1][0]) - timestampMs(a[1][0]),
    );
    const fragment = document.createDocumentFragment();

    for (const [steamId, entries] of orderedGroups) {
      const headingRow = document.createElement("tr");
      headingRow.className = "log-group-row";
      const headingCell = document.createElement("td");
      headingCell.colSpan = 6;
      const latest = entries[0];
      headingCell.textContent = `${latest.nick || "UNKNOWN"} · ${steamId}`;
      const meta = document.createElement("span");
      meta.className = "log-group-meta";
      meta.textContent = `${entries.length} событий • последнее: ${safeDate(latest.timestamp)}`;
      headingCell.append(meta);
      headingRow.append(headingCell);
      fragment.append(headingRow);

      for (const entry of entries) {
        const row = document.createElement("tr");
        appendTextCell(row, safeDate(entry.timestamp));
        appendLogCell(
          row,
          `${entry.nick || "UNKNOWN"} · ${entry.steamid || "UNKNOWN"}`,
          entry.steamid64 && entry.steamid64 !== "0" ? entry.steamid64 : "",
        );
        appendLogCell(
          row,
          actionLabel(entry.action),
          entry.action || "unknown",
          "log-function",
        );
        appendLogCell(
          row,
          entry.detail || "—",
          [
            entry.server,
            entry.map && `Карта: ${entry.map}`,
            entry.version,
            entry.command_id && `Команда: ${entry.command_id}`,
          ]
            .filter(Boolean)
            .join(" • "),
        );
        appendResultCell(row, entry);
        appendLogCell(
          row,
          SOURCE_LABELS[entry.source] || entry.source || "—",
          entry.source && SOURCE_LABELS[entry.source] ? entry.source : "",
        );
        fragment.append(row);
      }
    }

    elements.logsRows.replaceChildren(fragment);
    elements.logsEmpty.hidden = logs.length > 0;
    elements.logsCount.textContent = String(state.logs.length);
    elements.logsGroupSummary.textContent =
      `${orderedGroups.length} SteamID • ${logs.length} из ${state.logs.length} событий`;
  }

  function renderConnection() {
    elements.gistShort.textContent = state.gistId
      ? `${state.gistId.slice(0, 8)}…`
      : "—";
    elements.githubUser.textContent = state.githubUser?.login || "не подключён";
    elements.githubRole.textContent = state.access?.role || "—";
    elements.whitelistFilename.textContent = CONFIG.whitelistFile;
    elements.logsFilename.textContent = CONFIG.logsFile;
    elements.commandsFilename.textContent = CONFIG.commandsFile;
    elements.disconnectGitHub.disabled = !state.authorized;
    elements.connectGitHub.disabled = state.authorized;
    elements.saveWhitelist.disabled =
      !state.dirty || !state.authorized || !state.access?.canWrite;
    if (state.authorized && state.githubUser) {
      setConnectionState("online", `${state.access.role}: ${state.githubUser.login}`);
    } else {
      setConnectionState("offline", "Не авторизован");
    }

    for (const button of document.querySelectorAll(".nav-button")) {
      button.hidden = !canAccessView(button.dataset.view);
    }
  }

  function renderAll() {
    renderWhitelist();
    renderVersions();
    renderLogs();
    renderConnection();
  }

  async function loadGistData(
    message = "Загрузка данных из GitHub Gist...",
    suppliedGist = null,
  ) {
    if (!ensureAuthorized()) return;
    setFooter(message);
    try {
      const gist = suppliedGist || (await getGist());
      const remote = await readRemoteState(gist);
      state.whitelist = remote.whitelist;
      state.logs = remote.logs;
      state.commands = remote.commands;
      state.revision = revisionOf(gist);
      state.dirty = false;
      state.pendingAudit = [];
      state.selectedSteamId = null;
      state.selectedLogSteamId = "*";
      renderAll();
      setFooter(
        `Данные загружены • ${Object.keys(state.whitelist).length} пользователей • ${clientRegistry().length} клиентов • ${state.logs.length} событий`,
      );
    } catch (error) {
      setConnectionState("error", "Ошибка GitHub");
      setFooter(error.message);
      showToast(error.message, true);
      throw error;
    }
  }

  function buildWebAudit(action, detail, extra = {}) {
    const now = Date.now();
    return {
      schema: 2,
      id: `web-${now}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(now).toISOString(),
      unix: Math.floor(now / 1000),
      steamid: "WEB_ADMIN",
      steamid64: "0",
      nick: state.githubUser?.login || "GitHub Pages admin",
      action,
      category: String(action).split(".")[0] || "web",
      detail,
      result: "success",
      map: "web",
      server: "GitHub Pages",
      version: CONFIG.recommendedClientVersion,
      source: "github-pages",
      ...extra,
    };
  }

  function queueAudit(action, steamId) {
    state.pendingAudit.push(buildWebAudit(action, steamId));
  }

  function createCommandId() {
    if (window.crypto?.randomUUID) {
      return `cmd-${window.crypto.randomUUID()}`;
    }
    return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function enqueueForceUpdate(target) {
    if (!ensureAuthorized()) return;
    if (!state.access?.canWrite) {
      showToast("У этого аккаунта нет права отправлять команды.", true);
      return;
    }
    if (target !== "*" && !isValidSteamId(target)) {
      showToast("Некорректный SteamID клиента.", true);
      return;
    }

    const targetLabel = target === "*" ? "всех известных клиентов" : target;
    if (
      !window.confirm(
        `Принудительно перезагрузить Multi‑Tool у ${targetLabel}? Команда действует 30 минут.`,
      )
    ) {
      return;
    }

    state.commandBusy = true;
    renderVersions();
    setFooter(`Создаю команду обновления для ${targetLabel}...`);
    try {
      const latestGist = await getGist();
      const [commandsSource, logsSource] = await Promise.all([
        getGistFile(latestGist, CONFIG.commandsFile, "[]"),
        getGistFile(latestGist, CONFIG.logsFile, "[]"),
      ]);
      const now = Date.now();
      const nowUnix = Math.floor(now / 1000);
      const command = {
        schema: 1,
        id: createCommandId(),
        action: "client.force_update",
        target,
        issued_by: state.githubUser?.login || "Hunteralook",
        created_at: new Date(now).toISOString(),
        created_unix: nowUnix,
        expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
        expires_unix: nowUnix + 30 * 60,
        requested_version: CONFIG.recommendedClientVersion,
      };
      const retainedCommands = parseCommands(commandsSource)
        .filter(
          (entry) =>
            Number(entry.expires_unix || 0) > nowUnix - 24 * 60 * 60,
        )
        .slice(-(CONFIG.maxCommands - 1));
      const commands = [...retainedCommands, command];
      const audit = buildWebAudit(
        "client.update.request",
        target === "*" ? "Все клиенты" : target,
        {command_id: command.id},
      );
      const mergedLogs = [...parseLogs(logsSource), audit].slice(
        -CONFIG.maxLogs,
      );
      const updatedGist = await apiRequest(
        `/gists/${encodeURIComponent(state.gistId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            files: {
              [CONFIG.commandsFile]: {
                content: JSON.stringify(commands, null, 2),
              },
              [CONFIG.logsFile]: {
                content: JSON.stringify(mergedLogs, null, 2),
              },
            },
          }),
        },
      );
      state.commands = commands;
      state.logs = mergedLogs;
      state.revision = revisionOf(updatedGist);
      renderAll();
      setFooter(`Команда обновления для ${targetLabel} поставлена в очередь.`);
      showToast("Команда отправлена. Клиент получит её в течение 20 секунд.");
    } catch (error) {
      setFooter(error.message);
      showToast(error.message, true);
    } finally {
      state.commandBusy = false;
      renderVersions();
    }
  }

  function markDirty(message) {
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("У этого аккаунта нет права изменять whitelist.", true);
      return;
    }
    state.dirty = true;
    renderWhitelist();
    setFooter(`${message} Нажмите «Сохранить в GitHub».`);
  }

  function upsertUser() {
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("У этого аккаунта нет права изменять whitelist.", true);
      return;
    }
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
    if (!ensureAuthorized() || !state.access?.canWrite) {
      showToast("У этого аккаунта нет права изменять whitelist.", true);
      return;
    }
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
    if (!ensureAuthorized()) return;
    if (!state.access?.canWrite) {
      showToast("У этого аккаунта нет права сохранять whitelist.", true);
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

  async function connectGitHub(tokenOverride = "", restoring = false) {
    const token = String(tokenOverride || elements.tokenInput.value).trim();
    if (!token) {
      setAuthMessage("Введите GitHub token.", "error");
      elements.tokenInput.focus();
      return;
    }

    state.gistId = CONFIG.gistId;
    state.token = token;
    elements.connectGitHub.disabled = true;
    setAuthMessage(
      restoring
        ? "Проверяю сохранённую сессию..."
        : "Проверяю GitHub-аккаунт...",
      "loading",
    );
    try {
      const githubUser = await apiRequest("/user");
      const access = accessForLogin(githubUser.login);
      if (!access) {
        throw new Error(
          `Аккаунту ${githubUser.login} доступ к этой панели не разрешён.`,
        );
      }

      state.githubUser = githubUser;
      state.access = access;
      state.authorized = true;

      setAuthMessage("Аккаунт разрешён. Загружаю защищённые данные...", "loading");
      const gist = await getGist();
      const gistOwner = gist.owner?.login;
      if (!gistOwner || !accessForLogin(gistOwner)) {
        throw new Error("Владелец хранилища не входит в список администраторов.");
      }

      await loadGistData(
        `GitHub подключён: ${state.githubUser.login}. Загрузка Gist...`,
        gist,
      );
      unlockApplication();
      elements.tokenInput.value = "";
      const tokenStored = storeToken(token);
      renderAll();
      showToast(
        tokenStored
          ? `Вход выполнен: ${state.githubUser.login}. Токен сохранён.`
          : `Вход выполнен: ${state.githubUser.login}, но браузер запретил сохранить токен.`,
        !tokenStored,
      );
    } catch (error) {
      clearSession(true);
      setAuthMessage(
        restoring
          ? `Сохранённая сессия недействительна: ${error.message}. Введите новый токен.`
          : `Вход не выполнен: ${error.message}`,
        "error",
      );
      elements.tokenInput.focus();
      if (!restoring) elements.tokenInput.select();
    } finally {
      elements.connectGitHub.disabled = false;
    }
  }

  function clearSession(forgetToken = false) {
    if (forgetToken) forgetStoredToken();
    state.token = "";
    state.githubUser = null;
    state.authorized = false;
    state.access = null;
    state.whitelist = {};
    state.logs = [];
    state.commands = [];
    state.revision = null;
    state.dirty = false;
    state.selectedSteamId = null;
    state.selectedLogSteamId = "*";
    state.commandBusy = false;
    state.pendingAudit = [];
    elements.tokenInput.value = "";
    elements.gistIdInput.value = CONFIG.gistId;
    clearEditor();
    renderAll();
  }

  function lockApplication(message = "Ожидание авторизации") {
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
      !window.confirm("Выйти и отменить несохранённые изменения?")
    ) {
      return;
    }
    clearSession(true);
    lockApplication(
      "Сессия завершена. Сохранённый токен и данные удалены с устройства.",
    );
    elements.tokenInput.focus();
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
    byId("reloadVersions").addEventListener("click", reloadWithConfirmation);
    byId("reloadLogs").addEventListener("click", reloadWithConfirmation);
    elements.forceUpdateAll.addEventListener("click", () =>
      enqueueForceUpdate("*"),
    );
    elements.connectGitHub.addEventListener("click", () => connectGitHub());
    elements.disconnectGitHub.addEventListener("click", disconnectGitHub);
    elements.whitelistSearch.addEventListener("input", renderWhitelist);
    elements.logsSearch.addEventListener("input", renderLogs);
    elements.logsSteamIdFilter.addEventListener("change", () => {
      state.selectedLogSteamId = elements.logsSteamIdFilter.value;
      renderLogs();
    });
    elements.versionsSearch.addEventListener("input", renderVersions);
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
    const storedToken = readStoredToken();
    if (storedToken) {
      await connectGitHub(storedToken, true);
    } else {
      elements.tokenInput.focus();
    }
  }

  initialize();
})();
