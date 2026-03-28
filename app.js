const STORAGE_KEY = "spelteller-data-v1";
const CLOUD_CONFIG_KEY = "spelteller-cloud-v1";
const runtimeConfig = getRuntimeConfig();
const GAME_TEMPLATES = [
  {
    id: "custom",
    name: "Aangepast",
    defaultName: "",
    description: "Vrij spel zonder automatische eindregel. Je rondt het spel zelf af.",
    scoreDirection: "high",
    winThreshold: null,
    autoEnd: false,
    allowSharedWin: true,
    tieBreakLabel: ""
  },
  {
    id: "flip7",
    name: "Flip7",
    defaultName: "Flip7",
    description: "Hoogste score wint. Het spel eindigt automatisch zodra iemand 200 punten haalt.",
    scoreDirection: "high",
    winThreshold: 200,
    autoEnd: true,
    allowSharedWin: false,
    tieBreakLabel: "Speel een extra ronde bij gelijkspel op of boven 200."
  },
  {
    id: "yahtzee",
    name: "Yahtzee",
    defaultName: "Yahtzee",
    description: "Hoogste totaalscore wint. Rond het spel handmatig af wanneer jullie klaar zijn.",
    scoreDirection: "high",
    winThreshold: null,
    autoEnd: false,
    allowSharedWin: true,
    tieBreakLabel: ""
  },
  {
    id: "qwixx",
    name: "Qwixx",
    defaultName: "Qwixx",
    description: "Hoogste totaalscore wint. Handmatig afronden na de laatste beurt.",
    scoreDirection: "high",
    winThreshold: null,
    autoEnd: false,
    allowSharedWin: true,
    tieBreakLabel: ""
  },
  {
    id: "rummikub",
    name: "Rummikub",
    defaultName: "Rummikub",
    description: "Laagste score wint. Fijn voor varianten waarin restpunten worden opgeteld.",
    scoreDirection: "low",
    winThreshold: null,
    autoEnd: false,
    allowSharedWin: true,
    tieBreakLabel: ""
  }
];

const state = loadState();
const cloud = loadCloudConfig();
let deferredPrompt;
let editingRoundId = null;
let editingPlayerId = null;
let activeTab = resolveInitialTab();
let swRegistration = null;
let lastCommittedState = serializeState(state);
const undoStack = [];
const redoStack = [];
let autoPushTimer = null;
let isApplyingRemoteState = false;
let cloudStatusKind = "idle";
let isRoomReady = false;
let isEnteringRoom = false;

const els = {
  appShell: document.querySelector(".app-shell"),
  installBtn: document.getElementById("installBtn"),
  pwaStatus: document.getElementById("pwaStatus"),
  roomGate: document.getElementById("roomGate"),
  roomGateForm: document.getElementById("roomGateForm"),
  roomGateInput: document.getElementById("roomGateInput"),
  roomGateMessage: document.getElementById("roomGateMessage"),
  roomGateStatus: document.getElementById("roomGateStatus"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  footerPartyBtn: document.getElementById("footerPartyBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  playerForm: document.getElementById("playerForm"),
  playerName: document.getElementById("playerName"),
  playerPhoto: document.getElementById("playerPhoto"),
  clearPlayerPhoto: document.getElementById("clearPlayerPhoto"),
  playerColor: document.getElementById("playerColor"),
  playerList: document.getElementById("playerList"),
  resetRankingBtn: document.getElementById("resetRankingBtn"),
  winRanking: document.getElementById("winRanking"),
  winRankingHint: document.getElementById("winRankingHint"),
  playerStats: document.getElementById("playerStats"),
  playerStatsHint: document.getElementById("playerStatsHint"),
  gameForm: document.getElementById("gameForm"),
  gameTemplate: document.getElementById("gameTemplate"),
  templateSummary: document.getElementById("templateSummary"),
  gameName: document.getElementById("gameName"),
  saveGroupBtn: document.getElementById("saveGroupBtn"),
  favoriteGroups: document.getElementById("favoriteGroups"),
  favoriteGroupsHint: document.getElementById("favoriteGroupsHint"),
  randomRoomBtn: document.getElementById("randomRoomBtn"),
  shareLink: document.getElementById("shareLink"),
  copyRoomLinkBtn: document.getElementById("copyRoomLinkBtn"),
  pushCloudBtn: document.getElementById("pushCloudBtn"),
  pullCloudBtn: document.getElementById("pullCloudBtn"),
  supabaseRoom: document.getElementById("supabaseRoom"),
  roomQr: document.getElementById("roomQr"),
  cloudStatus: document.getElementById("cloudStatus"),
  gamePlayers: document.getElementById("gamePlayers"),
  gameWinScore: document.getElementById("gameWinScore"),
  activeGamePanel: document.getElementById("activeGamePanel"),
  activeGameTitle: document.getElementById("activeGameTitle"),
  activeGameMeta: document.getElementById("activeGameMeta"),
  newGameBtn: document.getElementById("newGameBtn"),
  deleteGameBtn: document.getElementById("deleteGameBtn"),
  endGameBtn: document.getElementById("endGameBtn"),
  savedGamesList: document.getElementById("savedGamesList"),
  roundForm: document.getElementById("roundForm"),
  scoreTabHint: document.getElementById("scoreTabHint"),
  roundScores: document.getElementById("roundScores"),
  leaderboardWrap: document.getElementById("leaderboardWrap"),
  leaderboard: document.getElementById("leaderboard"),
  roundTableWrap: document.getElementById("roundTableWrap"),
  roundTableHead: document.getElementById("roundTableHead"),
  roundTableBody: document.getElementById("roundTableBody"),
  editRoundDialog: document.getElementById("editRoundDialog"),
  editRoundForm: document.getElementById("editRoundForm"),
  editRoundLabel: document.getElementById("editRoundLabel"),
  editRoundScores: document.getElementById("editRoundScores"),
  celebrationLayer: document.getElementById("celebrationLayer"),
  confettiCanvas: document.getElementById("confettiCanvas"),
  fireworkCanvas: document.getElementById("fireworkCanvas"),
  balloons: document.getElementById("balloons"),
  winnerText: document.getElementById("winnerText"),
  piggy: document.getElementById("piggy"),
  partyBear: document.getElementById("partyBear"),
  danceBanana: document.getElementById("danceBanana"),
  playerTemplate: document.getElementById("playerTemplate"),
  editPlayerDialog: document.getElementById("editPlayerDialog"),
  editPlayerForm: document.getElementById("editPlayerForm"),
  editPlayerName: document.getElementById("editPlayerName"),
  editPlayerPhoto: document.getElementById("editPlayerPhoto"),
  clearEditPlayerPhoto: document.getElementById("clearEditPlayerPhoto"),
  editPlayerColor: document.getElementById("editPlayerColor"),
  editPlayerRemovePhoto: document.getElementById("editPlayerRemovePhoto"),
  removePhotoLabel: document.getElementById("removePhotoLabel"),
  editPlayerCancelBtn: document.getElementById("editPlayerCancelBtn")
};

wireEvents();
render();
registerPWA();
initializeRoomExperience();

function wireEvents() {
  for (const button of els.tabButtons) {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  }

  els.playerForm.addEventListener("submit", onCreatePlayer);
  els.resetRankingBtn.addEventListener("click", onResetRanking);
  els.gameTemplate.addEventListener("change", onTemplateChange);
  els.saveGroupBtn.addEventListener("click", onSaveFavoriteGroup);
  els.roomGateForm.addEventListener("submit", onJoinRoom);
  els.createRoomBtn.addEventListener("click", onCreateRoomFromGate);
  els.randomRoomBtn.addEventListener("click", onCreateRoomCode);
  els.supabaseRoom.addEventListener("input", onRoomInput);
  els.supabaseRoom.addEventListener("change", onRoomCommit);
  els.copyRoomLinkBtn.addEventListener("click", onCopyShareLink);
  els.pushCloudBtn.addEventListener("click", onPushToCloud);
  els.pullCloudBtn.addEventListener("click", onPullFromCloud);
  els.undoBtn.addEventListener("click", onUndo);
  els.redoBtn.addEventListener("click", onRedo);
  els.clearPlayerPhoto.addEventListener("click", (e) => {
    e.preventDefault();
    els.playerPhoto.value = "";
  });
  els.editPlayerForm.addEventListener("submit", onSavePlayerEdit);
  els.clearEditPlayerPhoto.addEventListener("click", (e) => {
    e.preventDefault();
    els.editPlayerPhoto.value = "";
  });
  els.editPlayerCancelBtn.addEventListener("click", () => {
    editingPlayerId = null;
    els.editPlayerDialog.close();
  });
  els.gameForm.addEventListener("submit", onCreateGame);
  els.roundForm.addEventListener("submit", onAddRound);
  els.newGameBtn.addEventListener("click", onStartNewGame);
  els.deleteGameBtn.addEventListener("click", onDeleteGame);
  els.endGameBtn.addEventListener("click", onEndGame);
  els.footerPartyBtn.addEventListener("click", onFooterParty);
  els.editRoundForm.addEventListener("submit", onSaveRoundEdit);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    syncPwaStatus();
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    syncPwaStatus();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    syncPwaStatus("SpelTel is geinstalleerd op dit apparaat.");
  });

  window.addEventListener("online", () => {
    syncPwaStatus("Je bent weer online.");
  });

  window.addEventListener("offline", () => {
    syncPwaStatus("Offline modus actief. Je lokale speldata blijft beschikbaar.");
  });

  window.addEventListener("focus", () => {
    if (cloud.room) {
      void syncFromCloud({ silent: true, allowOverwrite: true });
    }
  });
}

function onJoinRoom(event) {
  event.preventDefault();
  enterRoom(els.roomGateInput.value, { source: "gate" });
}

function onCreateRoomFromGate() {
  const room = slugifyRoom(els.roomGateInput.value) || createRoomCode();
  els.roomGateInput.value = room;
  enterRoom(room, { source: "gate", isNewRoom: true });
}

async function onCreatePlayer(event) {
  event.preventDefault();
  const name = els.playerName.value.trim();
  if (!name) {
    return;
  }

  const existing = state.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    alert("Deze speler bestaat al.");
    return;
  }

  const photo = await toDataUrl(els.playerPhoto.files[0]);
  state.players.push({
    id: crypto.randomUUID(),
    name,
    photo,
    color: els.playerColor.value || "#ff6b00"
  });

  saveAndRender();
  els.playerForm.reset();
}

function onCreateGame(event) {
  event.preventDefault();
  if (state.players.length === 0) {
    alert("Maak eerst minimaal 1 speler aan.");
    return;
  }

  const name = els.gameName.value.trim();
  if (!name) {
    return;
  }

  const template = getSelectedTemplate();

  const playerIds = Array.from(els.gamePlayers.querySelectorAll("input:checked")).map((input) => input.value);
  if (playerIds.length === 0) {
    alert("Kies minimaal 1 speler voor dit spel.");
    return;
  }

  const game = {
    id: crypto.randomUUID(),
    name,
    templateId: template.id,
    rules: cloneRules(template),
    playerIds,
    winScore: Number(els.gameWinScore.value) || template.winThreshold || null,
    rounds: [],
    endedAt: null,
    createdAt: new Date().toISOString()
  };

  state.games.unshift(game);
  state.activeGameId = game.id;
  saveAndRender();
  setActiveTab("score");
  els.gameForm.reset();
  els.gameTemplate.value = template.id;
  syncTemplateFields(template);
}

function onAddRound(event) {
  event.preventDefault();
  const game = getActiveGame();
  if (!game || game.endedAt) {
    return;
  }

  const label = `Ronde ${game.rounds.length + 1}`;
  const scores = {};

  for (const input of els.roundScores.querySelectorAll("input")) {
    scores[input.dataset.playerId] = Number(input.value || 0);
  }

  game.rounds.push({
    id: crypto.randomUUID(),
    label,
    scores
  });

  const evaluation = evaluateGameEnd(game);
  if (evaluation.shouldEnd) {
    game.endedAt = new Date().toISOString();
    saveAndRender();
    celebrateGame(game, evaluation.winnerIds);
    return;
  }

  if (evaluation.awaitingTiebreak) {
    alert(evaluation.message);
  }

  saveAndRender();
  els.roundForm.reset();
}

function onStartNewGame() {
  const game = getActiveGame();
  setActiveTab("new-game");

  els.gameName.focus();
  if (!game) {
    return;
  }

  applyPlayerSelection(game.playerIds);

  const template = getGameTemplate(game);
  els.gameTemplate.value = template.id;
  syncTemplateFields(template, { preserveName: false });
  els.gameName.value = "";
  els.gameForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function onResetRanking() {
  if (!confirm("De win ranking opnieuw vanaf nu laten tellen? Bestaande spelers en spellen blijven bewaard.")) {
    return;
  }

  state.rankingResetAt = new Date().toISOString();
  saveAndRender();
}

function onDeleteGame() {
  const game = getActiveGame();
  if (!game) {
    return;
  }

  if (!confirm(`Weet je zeker dat je '${game.name}' wilt verwijderen?`)) {
    return;
  }

  state.games = state.games.filter((g) => g.id !== game.id);
  state.activeGameId = state.games[0]?.id || null;
  saveAndRender();
  if (!state.activeGameId) {
    setActiveTab("new-game");
  }
}

function onEndGame() {
  const game = getActiveGame();
  if (!game || game.endedAt) {
    return;
  }

  const evaluation = evaluateGameEnd(game, { manual: true });
  if (evaluation.awaitingTiebreak) {
    alert(evaluation.message);
    return;
  }

  game.endedAt = new Date().toISOString();
  saveAndRender();
  celebrateGame(game, evaluation.winnerIds);
}

function onFooterParty() {
  const game = getActiveGame();
  if (game) {
    const winner = getGameWinnerIds(game)
      .map((id) => getPlayer(id)?.name)
      .filter(Boolean)
      .join(", ") || "Iedereen";
    playCelebration(`Feestje! Koploper: ${winner}`, `🐷 Yay ${winner}!`);
    return;
  }

  playCelebration("Feestje tijd!", "🐷 Party!");
}

function onSaveRoundEdit(event) {
  event.preventDefault();
  const game = getActiveGame();
  if (!game || !editingRoundId) {
    return;
  }

  const round = game.rounds.find((item) => item.id === editingRoundId);
  if (!round) {
    return;
  }

  round.label = els.editRoundLabel.value.trim() || round.label;
  for (const input of els.editRoundScores.querySelectorAll("input")) {
    round.scores[input.dataset.playerId] = Number(input.value || 0);
  }

  editingRoundId = null;
  els.editRoundDialog.close();
  saveAndRender();
}

function render() {
  renderAppVisibility();
  renderTabs();
  renderGameTemplateOptions();
  renderPlayers();
  renderWinRanking();
  renderPlayerStats();
  renderGamePlayerSelectors();
  renderFavoriteGroups();
  renderSavedGames();
  renderCloudPanel();
  renderHistoryButtons();
  renderActiveGame();
}

function renderAppVisibility() {
  const showGate = !isRoomReady || isEnteringRoom;
  els.roomGate.hidden = !showGate;
  els.roomGate.style.display = showGate ? "grid" : "none";
  document.body.classList.toggle("room-gate-active", showGate);
}

function renderTabs() {
  for (const button of els.tabButtons) {
    const isActive = button.dataset.tabTarget === activeTab;
    button.classList.toggle("is-active", isActive);
  }

  for (const panel of els.tabPanels) {
    panel.hidden = panel.dataset.tabPanel !== activeTab;
  }
}

function setActiveTab(tabName) {
  activeTab = tabName;
  if (window.location.hash !== `#${tabName}`) {
    history.replaceState(null, "", `#${tabName}`);
  }
  renderTabs();
}

function onTemplateChange() {
  syncTemplateFields(getSelectedTemplate());
}

function renderGameTemplateOptions() {
  const currentValue = els.gameTemplate.value || state.lastTemplateId || "custom";
  els.gameTemplate.innerHTML = "";

  for (const template of GAME_TEMPLATES) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    option.selected = template.id === currentValue;
    els.gameTemplate.appendChild(option);
  }

  const selectedTemplate = getTemplateById(currentValue);
  els.gameTemplate.value = selectedTemplate.id;
  syncTemplateFields(selectedTemplate, { preserveName: true });
}

function syncTemplateFields(template, options = {}) {
  const { preserveName = false } = options;
  state.lastTemplateId = template.id;

  const shouldFillName =
    !preserveName ||
    !els.gameName.value.trim() ||
    GAME_TEMPLATES.some((item) => item.defaultName && item.defaultName === els.gameName.value.trim());

  if (shouldFillName) {
    els.gameName.value = template.defaultName;
  }

  els.gameWinScore.value = template.winThreshold ?? "";
  els.gameWinScore.disabled = template.autoEnd && template.winThreshold !== null;

  const scoreLabel = template.scoreDirection === "low" ? "Laagste score wint." : "Hoogste score wint.";
  const endLabel = template.autoEnd
    ? `Automatisch einde bij ${template.winThreshold} punten.`
    : "Handmatig afronden.";
  const tieLabel = template.tieBreakLabel || (template.allowSharedWin ? "Gelijkspel telt als gedeelde winst." : "");
  els.templateSummary.textContent = [template.description, scoreLabel, endLabel, tieLabel].filter(Boolean).join(" ");
}

function getSelectedTemplate() {
  return getTemplateById(els.gameTemplate.value);
}

function renderCloudPanel() {
  els.supabaseRoom.value = cloud.room;
  els.shareLink.value = getShareLink();
  els.copyRoomLinkBtn.disabled = !cloud.room;
  const hasRuntimeCloud = Boolean(cloud.url && cloud.anonKey);
  els.pushCloudBtn.disabled = !hasRuntimeCloud;
  els.pullCloudBtn.disabled = !hasRuntimeCloud;
  const qrUrl = getQrCodeUrl();
  els.roomQr.hidden = !qrUrl;
  if (qrUrl) {
    els.roomQr.src = qrUrl;
  } else {
    els.roomQr.removeAttribute("src");
  }
  renderCloudStatus();
}

function renderRoomGate(options = {}) {
  const {
    message = "Open een bestaande room of maak een nieuwe gezinsruimte om samen verder te spelen.",
    status = "",
    state = "idle"
  } = options;

  els.roomGateInput.value = cloud.room;
  els.roomGateMessage.textContent = message;
  els.roomGateStatus.textContent = status;
  els.roomGateStatus.hidden = !status;
  els.roomGateStatus.dataset.state = state;
  els.roomGate.dataset.state = state;
  els.roomGateInput.disabled = isEnteringRoom;
  els.joinRoomBtn.disabled = isEnteringRoom;
  els.createRoomBtn.disabled = isEnteringRoom;
  els.joinRoomBtn.textContent = isEnteringRoom ? "Bezig..." : "Bestaande Openen";
  els.createRoomBtn.textContent = isEnteringRoom ? "Bezig..." : "Nieuwe Room Maken";
}

function renderCloudStatus(message) {
  const hasConfig = Boolean(cloud.url && cloud.anonKey && cloud.room);
  if (message) {
    setCloudStatusKindFromMessage(message);
    els.cloudStatus.textContent = `Cloud status: ${message}`;
    els.cloudStatus.dataset.state = cloudStatusKind;
    return;
  }

  if (!hasConfig) {
    cloudStatusKind = "idle";
    els.cloudStatus.textContent = "Cloud status: nog niet verbonden.";
    els.cloudStatus.dataset.state = cloudStatusKind;
    return;
  }

  cloudStatusKind = navigator.onLine ? "synced" : "offline";
  const lastSync = cloud.lastSyncedAt ? new Date(cloud.lastSyncedAt).toLocaleString("nl-NL") : "nog niet";
  els.cloudStatus.textContent = `Cloud status: verbonden met room '${cloud.room}' (laatste sync: ${lastSync}).`;
  els.cloudStatus.dataset.state = cloudStatusKind;
}

function onSaveCloudConfig() {
  cloud.url = sanitizeSupabaseUrl(runtimeConfig.supabaseUrl);
  cloud.anonKey = runtimeConfig.supabaseAnonKey;
  cloud.room = els.supabaseRoom.value.trim();

  const hasConfig = Boolean(cloud.url && cloud.anonKey && cloud.room);
  if (!hasConfig) {
    saveCloudConfig();
    renderCloudStatus("onvolledig, vul URL + key + room in.");
    return;
  }

  saveCloudConfig();
  renderCloudStatus("verbinding opgeslagen.");
}

function onRoomInput() {
  const normalized = slugifyRoom(els.supabaseRoom.value);
  cloud.room = normalized;
  els.supabaseRoom.value = normalized;
  saveCloudConfig();
  renderCloudPanel();
  if (!isRoomReady) {
    els.roomGateInput.value = normalized;
  }
}

async function onRoomCommit() {
  if (!cloud.room) {
    return;
  }

  await enterRoom(cloud.room, { source: "panel" });
}

function onCreateRoomCode() {
  const room = createRoomCode();
  els.supabaseRoom.value = room;
  cloud.room = room;
  saveCloudConfig();
  renderCloudPanel();
  void enterRoom(room, { source: "panel", isNewRoom: true });
}

async function onCopyShareLink() {
  const link = getShareLink();
  if (!link) {
    onCreateRoomCode();
  }

  const nextLink = getShareLink();
  if (!nextLink) {
    return;
  }

  try {
    await navigator.clipboard.writeText(nextLink);
    renderCloudStatus("deellink gekopieerd.");
  } catch {
    els.shareLink.select();
    document.execCommand("copy");
    renderCloudStatus("deellink gekopieerd.");
  }
}

function onUndo() {
  if (undoStack.length === 0) {
    return;
  }

  const currentSnapshot = serializeState(state);
  const previousSnapshot = undoStack.pop();
  redoStack.push(currentSnapshot);
  restoreState(previousSnapshot);
}

function onRedo() {
  if (redoStack.length === 0) {
    return;
  }

  const currentSnapshot = serializeState(state);
  const nextSnapshot = redoStack.pop();
  undoStack.push(currentSnapshot);
  restoreState(nextSnapshot);
}

function renderHistoryButtons() {
  els.undoBtn.disabled = undoStack.length === 0;
  els.redoBtn.disabled = redoStack.length === 0;
}

async function onPushToCloud() {
  await syncToCloud();
}

async function onPullFromCloud() {
  await syncFromCloud({ allowOverwrite: true });
}

function ensureCloudConfig() {
  onSaveCloudConfig();
  const hasConfig = Boolean(cloud.url && cloud.anonKey && cloud.room);
  if (!hasConfig) {
    alert("Vul eerst Supabase URL, Anon Key en Room code in.");
    return false;
  }
  return true;
}

function initializeRoomExperience() {
  isRoomReady = false;
  isEnteringRoom = false;
  renderAppVisibility();
  renderRoomGate({
    state: "idle",
    status: cloud.room ? `Laatst gebruikte room: '${cloud.room}'.` : ""
  });
}

function enterRoom(roomValue, options = {}) {
  const { source = "gate", isNewRoom = false } = options;
  const room = slugifyRoom(roomValue);
  if (!room) {
    renderRoomGate({
      message: "Vul eerst een geldige room code in.",
      status: "Voer een korte room code in met letters en cijfers.",
      state: "error"
    });
    return false;
  }

  activateRoom(room);
  void syncRoomInBackground(room, { source, isNewRoom });
  return true;
}

function activateRoom(room) {
  cloud.room = room;
  saveCloudConfig();
  renderCloudPanel();
  window.history.replaceState(null, "", `${window.location.pathname}?room=${encodeURIComponent(room)}`);
  isRoomReady = true;
  isEnteringRoom = false;
  renderAppVisibility();
  render();
}

async function syncRoomInBackground(room, options = {}) {
  const { source = "gate", isNewRoom = false } = options;
  if (!cloud.url || !cloud.anonKey) {
    renderCloudStatus("cloudconfig ontbreekt, lokale modus actief.");
    return false;
  }

  try {
    renderCloudStatus(isNewRoom ? "nieuwe room wordt klaargezet..." : "room wordt geladen...");
    const remoteRow = await fetchCloudStateByRoom(room);
    if (cloud.room !== room) {
      return false;
    }

    if (remoteRow?.state) {
      applyRemoteState(remoteRow.state);
      cloud.lastSyncedAt = remoteRow.updated_at || new Date().toISOString();
      saveCloudConfig();
      renderCloudStatus();
    } else if (isNewRoom || source !== "startup" || hasMeaningfulLocalState()) {
      await syncToCloud({ silent: true });
      if (cloud.room === room) {
        renderCloudStatus("nieuwe room is klaar.");
      }
    }

    render();
    return true;
  } catch (error) {
    console.error(error);
    renderCloudStatus(`download mislukt (${error.message}).`);
    return false;
  }
}

async function syncToCloud(options = {}) {
  const { silent = false } = options;
  if (!ensureCloudConfig()) {
    return false;
  }

  try {
    if (!silent) {
      renderCloudStatus("sync bezig (upload)...");
    }

    const row = await upsertCloudState(cloudSnapshot());
    cloud.lastSyncedAt = row?.updated_at || new Date().toISOString();
    saveCloudConfig();
    renderCloudStatus(silent ? undefined : "upload klaar.");
    return true;
  } catch (error) {
    console.error(error);
    renderCloudStatus(`upload mislukt (${error.message}).`);
    return false;
  }
}

async function syncFromCloud(options = {}) {
  const { silent = false, allowOverwrite = false } = options;
  if (!ensureCloudConfig()) {
    return false;
  }

  try {
    if (!silent) {
      renderCloudStatus("sync bezig (download)...");
    }

    const remoteRow = await fetchCloudState();
    if (!remoteRow) {
      if (!silent) {
        renderCloudStatus("geen cloud-data gevonden voor deze room.");
      }
      return false;
    }

    if (!allowOverwrite && !confirm("Lokale data overschrijven met cloud-data?")) {
      renderCloudStatus("download geannuleerd.");
      return false;
    }

    applyRemoteState(remoteRow.state);
    cloud.lastSyncedAt = remoteRow.updated_at || new Date().toISOString();
    saveCloudConfig();
    renderCloudStatus(silent ? undefined : "download klaar.");
    return true;
  } catch (error) {
    console.error(error);
    renderCloudStatus(`download mislukt (${error.message}).`);
    return false;
  }
}

function scheduleAutoPush() {
  if (isApplyingRemoteState || !cloud.room || !navigator.onLine) {
    return;
  }

  clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(() => {
    void syncToCloud({ silent: true });
  }, 900);
}

function setCloudStatusKindFromMessage(message) {
  const value = String(message).toLowerCase();
  if (value.includes("mislukt")) {
    cloudStatusKind = "error";
    return;
  }

  if (value.includes("bezig")) {
    cloudStatusKind = "syncing";
    return;
  }

  if (value.includes("offline")) {
    cloudStatusKind = "offline";
    return;
  }

  if (
    value.includes("klaar") ||
    value.includes("verbinding opgeslagen") ||
    value.includes("gekopieerd") ||
    value.includes("verbonden")
  ) {
    cloudStatusKind = "synced";
    return;
  }

  cloudStatusKind = "idle";
}

function applyRemoteState(remoteState) {
  isApplyingRemoteState = true;
  try {
    state.players = Array.isArray(remoteState.players) ? remoteState.players : [];
    state.games = Array.isArray(remoteState.games) ? remoteState.games : [];
    state.groups = Array.isArray(remoteState.groups) ? remoteState.groups : [];
    state.activeGameId = remoteState.activeGameId || state.games[0]?.id || null;
    state.rankingResetAt = remoteState.rankingResetAt || null;
    state.lastTemplateId = remoteState.lastTemplateId || "custom";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastCommittedState = serializeState(state);
    render();
  } finally {
    isApplyingRemoteState = false;
  }
}

function cloudSnapshot() {
  return {
    players: state.players,
    games: state.games,
    groups: state.groups,
    activeGameId: state.activeGameId,
    rankingResetAt: state.rankingResetAt,
    lastTemplateId: state.lastTemplateId
  };
}

async function upsertCloudState(payloadState) {
  const endpoint = `${cloud.url}/rest/v1/game_state?on_conflict=room_id`;
  const body = [
    {
      room_id: cloud.room,
      state: payloadState,
      updated_at: new Date().toISOString()
    }
  ];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: cloud.anonKey,
      Authorization: `Bearer ${cloud.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function fetchCloudState() {
  return fetchCloudStateByRoom(cloud.room);
}

async function fetchCloudStateByRoom(roomId) {
  const endpoint = `${cloud.url}/rest/v1/game_state?room_id=eq.${encodeURIComponent(
    roomId
  )}&select=state,updated_at&limit=1`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: cloud.anonKey,
      Authorization: `Bearer ${cloud.anonKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
}

function sanitizeSupabaseUrl(value) {
  return value.replace(/\/$/, "");
}

function renderPlayers() {
  els.playerList.innerHTML = "";

  for (const player of state.players) {
    const node = els.playerTemplate.content.cloneNode(true);
    const item = node.querySelector("li");
    const avatar = node.querySelector(".avatar");
    const name = node.querySelector(".name");
    const editBtn = node.querySelector(".edit-btn");
    const removeBtn = node.querySelector(".remove-btn");

    avatar.src = player.photo || createAvatar(player.name, player.color);
    avatar.alt = player.name;
    avatar.style.borderColor = player.color || "#ff6b00";
    name.textContent = player.name;

    editBtn.addEventListener("click", () => onEditPlayer(player.id));

    removeBtn.addEventListener("click", () => {
      const hasOpenGames = state.games.some((game) => !game.endedAt && game.playerIds.includes(player.id));
      if (hasOpenGames) {
        alert("Deze speler zit nog in een lopend spel en kan nu niet weg. Rond dat spel eerst af met Eindspel.");
        return;
      }
      state.players = state.players.filter((p) => p.id !== player.id);
      saveAndRender();
    });

    item.dataset.playerId = player.id;
    els.playerList.appendChild(node);
  }
}

function renderWinRanking() {
  const ranking = computeWinRanking();
  els.winRanking.innerHTML = "";

  if (ranking.length === 0) {
    els.winRanking.hidden = true;
    els.winRankingHint.hidden = false;
    return;
  }

  els.winRanking.hidden = false;
  els.winRankingHint.hidden = true;

  const medals = ["🥇", "🥈", "🥉"];

  ranking.forEach((entry, index) => {
    const li = document.createElement("li");
    if (index === 0) {
      li.classList.add("rank-1");
    }

    const sharedSuffix = entry.sharedWins > 0 ? `, ${entry.sharedWins} gedeeld` : "";
    const rankBadge = medals[index] || `${index + 1}.`;
    li.innerHTML = `<span class="rank-badge">${rankBadge}</span><span class="lb-name">${escapeHtml(
      entry.name
    )}</span><span class="lb-score">${entry.wins} winst${entry.wins === 1 ? "" : "en"}${sharedSuffix}</span>`;
    els.winRanking.appendChild(li);
  });
}

function renderPlayerStats() {
  const stats = computePlayerStats();
  els.playerStats.innerHTML = "";

  if (stats.length === 0) {
    els.playerStats.hidden = true;
    els.playerStatsHint.hidden = false;
    return;
  }

  els.playerStats.hidden = false;
  els.playerStatsHint.hidden = true;

  for (const entry of stats) {
    const card = document.createElement("article");
    card.className = "stats-card";
    card.innerHTML = `
      <h4>${escapeHtml(entry.name)}</h4>
      <div class="stats-grid">
        <div class="stat-pill"><span class="stat-label">Gewonnen</span><span class="stat-value">${entry.wins}</span></div>
        <div class="stat-pill"><span class="stat-label">Gem. punten</span><span class="stat-value">${entry.averageScore}</span></div>
        <div class="stat-pill"><span class="stat-label">Hoogste ronde</span><span class="stat-value">${entry.highestRound}</span></div>
        <div class="stat-pill"><span class="stat-label">Win streak</span><span class="stat-value">${entry.longestStreak}</span></div>
      </div>
    `;
    els.playerStats.appendChild(card);
  }
}

function onEditPlayer(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  editingPlayerId = playerId;
  els.editPlayerName.value = player.name;
  els.editPlayerColor.value = player.color || "#ff6b00";
  els.editPlayerPhoto.value = "";
  els.editPlayerRemovePhoto.checked = false;
  els.removePhotoLabel.hidden = !player.photo;
  els.editPlayerDialog.showModal();
}

async function onSavePlayerEdit(event) {
  event.preventDefault();
  const player = state.players.find((p) => p.id === editingPlayerId);
  if (!player) return;

  const name = els.editPlayerName.value.trim();
  if (!name) return;

  const duplicate = state.players.find(
    (p) => p.id !== editingPlayerId && p.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    alert("Er bestaat al een speler met deze naam.");
    return;
  }

  const newPhoto = await toDataUrl(els.editPlayerPhoto.files[0]);
  player.name = name;
  player.color = els.editPlayerColor.value;
  if (els.editPlayerRemovePhoto.checked) {
    player.photo = "";
  } else if (newPhoto) {
    player.photo = newPhoto;
  }

  editingPlayerId = null;
  els.editPlayerDialog.close();
  saveAndRender();
}

function renderGamePlayerSelectors() {
  els.gamePlayers.innerHTML = "";
  for (const player of state.players) {
    const wrapper = document.createElement("label");
    wrapper.className = "choice game-player-choice";
    wrapper.style.setProperty("--player-accent", player.color || "#ff6b00");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = player.id;
    input.className = "game-player-checkbox";
    input.addEventListener("change", () => updateGamePlayerChoiceState(wrapper, input.checked));

    const avatar = document.createElement("img");
    avatar.className = "game-player-avatar";
    avatar.src = player.photo || createAvatar(player.name, player.color);
    avatar.alt = "";
    avatar.decoding = "async";

    const textWrap = document.createElement("span");
    textWrap.className = "game-player-meta";

    const text = document.createElement("span");
    text.className = "game-player-name";
    text.textContent = player.name;

    const accent = document.createElement("span");
    accent.className = "game-player-accent";
    accent.setAttribute("aria-hidden", "true");

    textWrap.append(text, accent);
    wrapper.append(input, avatar, textWrap);
    updateGamePlayerChoiceState(wrapper, false);
    els.gamePlayers.appendChild(wrapper);
  }
}

function renderFavoriteGroups() {
  els.favoriteGroups.innerHTML = "";

  if (!Array.isArray(state.groups) || state.groups.length === 0) {
    els.favoriteGroups.hidden = true;
    els.favoriteGroupsHint.hidden = false;
    return;
  }

  els.favoriteGroups.hidden = false;
  els.favoriteGroupsHint.hidden = true;

  for (const group of state.groups) {
    const item = document.createElement("div");
    item.className = "chip-item";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "ghost-btn tiny";
    applyBtn.textContent = group.name;
    applyBtn.addEventListener("click", () => applyFavoriteGroup(group.id));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "tiny danger-btn";
    removeBtn.textContent = "✕";
    removeBtn.title = `${group.name} verwijderen`;
    removeBtn.addEventListener("click", () => removeFavoriteGroup(group.id));

    item.append(applyBtn, removeBtn);
    els.favoriteGroups.appendChild(item);
  }
}

function onSaveFavoriteGroup() {
  const selectedIds = getSelectedGamePlayerIds();
  if (selectedIds.length === 0) {
    alert("Selecteer eerst minimaal 1 speler voor je favoriete groep.");
    return;
  }

  const name = prompt("Naam voor deze favoriete groep?");
  if (!name || !name.trim()) {
    return;
  }

  const trimmedName = name.trim();
  const existing = state.groups.find((group) => group.name.toLowerCase() === trimmedName.toLowerCase());
  if (existing) {
    existing.playerIds = selectedIds;
  } else {
    state.groups.push({
      id: crypto.randomUUID(),
      name: trimmedName,
      playerIds: selectedIds
    });
  }

  saveAndRender();
  applyPlayerSelection(selectedIds);
}

function applyFavoriteGroup(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }

  applyPlayerSelection(group.playerIds);
}

function removeFavoriteGroup(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }

  if (!confirm(`Favoriete groep '${group.name}' verwijderen?`)) {
    return;
  }

  state.groups = state.groups.filter((item) => item.id !== groupId);
  saveAndRender();
}

function getSelectedGamePlayerIds() {
  return Array.from(els.gamePlayers.querySelectorAll("input:checked")).map((input) => input.value);
}

function applyPlayerSelection(playerIds) {
  const selectedIds = new Set(playerIds);
  for (const checkbox of els.gamePlayers.querySelectorAll("input[type='checkbox']")) {
    checkbox.checked = selectedIds.has(checkbox.value);
    updateGamePlayerChoiceState(checkbox.closest(".game-player-choice"), checkbox.checked);
  }
}

function updateGamePlayerChoiceState(node, isSelected) {
  if (!node) {
    return;
  }

  node.classList.toggle("is-selected", isSelected);
}

function renderSavedGames() {
  els.savedGamesList.innerHTML = "";
  if (state.games.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nog geen spellen opgeslagen.";
    els.savedGamesList.appendChild(li);
    return;
  }

  for (const game of state.games) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    const actions = document.createElement("div");
    const openBtn = document.createElement("button");
    const deleteBtn = document.createElement("button");

    const template = getGameTemplate(game);
    meta.innerHTML = `<strong>${escapeHtml(game.name)}</strong><br /><small>${escapeHtml(
      template.name
    )} · ${game.rounds.length} rondes${game.endedAt ? " - klaar" : ""}</small>`;

    openBtn.textContent = "Open";
    openBtn.className = "tiny";
    openBtn.addEventListener("click", () => {
      state.activeGameId = game.id;
      saveAndRender();
      setActiveTab("score");
    });

    deleteBtn.textContent = "Verwijder";
    deleteBtn.className = "tiny ghost-btn";
    deleteBtn.addEventListener("click", () => onDeleteSavedGame(game.id));

    actions.className = "saved-game-actions";
    actions.append(openBtn, deleteBtn);

    li.append(meta, actions);
    els.savedGamesList.appendChild(li);
  }
}

function onDeleteSavedGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) {
    return;
  }

  if (!confirm(`Weet je zeker dat je '${game.name}' wilt verwijderen?`)) {
    return;
  }

  state.games = state.games.filter((item) => item.id !== gameId);
  if (state.activeGameId === gameId) {
    state.activeGameId = state.games[0]?.id || null;
  }

  saveAndRender();
  if (!state.activeGameId && activeTab === "score") {
    setActiveTab("new-game");
  }
}

function renderActiveGame() {
  const game = getActiveGame();
  const hasGame = Boolean(game);

  els.scoreTabHint.hidden = hasGame;
  els.activeGamePanel.hidden = !hasGame;
  els.roundForm.hidden = !hasGame || Boolean(game?.endedAt);
  els.leaderboardWrap.hidden = !hasGame;
  els.roundTableWrap.hidden = !hasGame;

  if (!game) {
    return;
  }

  const playerNames = game.playerIds
    .map((id) => getPlayer(id)?.name)
    .filter(Boolean)
    .join(", ");
  const template = getGameTemplate(game);
  const evaluation = evaluateGameEnd(game, { manual: true });
  const ruleBits = [template.name, template.rulesLabel].filter(Boolean).join(" · ");
  const tieBreakNote = evaluation.awaitingTiebreak ? ` · ${evaluation.message}` : "";

  els.activeGameTitle.textContent = game.name;
  els.activeGameMeta.textContent = `${playerNames || "Geen spelers"} · ${ruleBits}${tieBreakNote}${
    game.endedAt ? " — 🏆 Spel afgelopen" : ""
  }`;

  els.endGameBtn.disabled = Boolean(game.endedAt);

  renderRoundInputs(game);
  renderLeaderboard(game);
  renderRoundTable(game);
}

function renderRoundInputs(game) {
  els.roundScores.innerHTML = "";

  for (const playerId of game.playerIds) {
    const player = getPlayer(playerId);
    if (!player) {
      continue;
    }

    const wrapper = document.createElement("label");
    wrapper.className = "score-input";

    const name = document.createElement("span");
    name.textContent = player.name;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.value = "0";
    input.dataset.playerId = player.id;

    wrapper.append(name, input);
    els.roundScores.appendChild(wrapper);
  }

  const disabled = Boolean(game.endedAt);
  for (const input of els.roundForm.querySelectorAll("input, button")) {
    input.disabled = disabled;
  }
}

function renderLeaderboard(game) {
  const sorted = getRankedEntries(game);
  els.leaderboard.innerHTML = "";

  const medals = ["🥇", "🥈", "🥉"];

  sorted.forEach(({ playerId, score }, index) => {
    const li = document.createElement("li");
    const player = getPlayer(playerId);
    if (index === 0) li.classList.add("rank-1");
    const rankBadge = medals[index] || `${index + 1}.`;
    li.innerHTML = `<span class="rank-badge">${rankBadge}</span><span class="lb-name">${escapeHtml(
      player?.name || "Onbekend"
    )}</span><span class="lb-score">${score} punten</span>`;
    els.leaderboard.appendChild(li);
  });
}

function renderRoundTable(game) {
  els.roundTableHead.innerHTML = "";
  els.roundTableBody.innerHTML = "";

  const baseHeads = ["Ronde", ...game.playerIds.map((id) => getPlayer(id)?.name || "?"), "Acties"];
  for (const title of baseHeads) {
    const th = document.createElement("th");
    th.textContent = title;
    els.roundTableHead.appendChild(th);
  }

  for (const round of game.rounds) {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    titleTd.textContent = round.label;
    tr.appendChild(titleTd);

    for (const playerId of game.playerIds) {
      const td = document.createElement("td");
      td.textContent = round.scores[playerId] ?? 0;
      tr.appendChild(td);
    }

    const actionTd = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "tiny ghost-btn";
    editBtn.textContent = "Bewerk";
    editBtn.addEventListener("click", () => openRoundEdit(game, round));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "tiny danger-btn";
    deleteBtn.textContent = "Verwijder";
    deleteBtn.addEventListener("click", () => {
      if (!confirm("Verwijder deze ronde?")) {
        return;
      }
      game.rounds = game.rounds.filter((item) => item.id !== round.id);
      saveAndRender();
    });

    actionTd.className = "round-actions-cell";
    actionTd.append(editBtn, deleteBtn);
    tr.appendChild(actionTd);

    els.roundTableBody.appendChild(tr);
  }
}

function openRoundEdit(game, round) {
  if (game.endedAt) {
    alert("Dit spel is al afgerond.");
    return;
  }

  editingRoundId = round.id;
  els.editRoundLabel.value = round.label;
  els.editRoundScores.innerHTML = "";

  for (const playerId of game.playerIds) {
    const player = getPlayer(playerId);
    if (!player) {
      continue;
    }

    const wrapper = document.createElement("label");
    wrapper.className = "score-input";

    const name = document.createElement("span");
    name.textContent = player.name;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.value = round.scores[player.id] ?? 0;
    input.dataset.playerId = player.id;

    wrapper.append(name, input);
    els.editRoundScores.appendChild(wrapper);
  }

  els.editRoundDialog.showModal();
}

function celebrateGame(game, winnerIds) {
  const winner = (winnerIds || getGameWinnerIds(game))
    .map((id) => getPlayer(id)?.name)
    .filter(Boolean)
    .join(", ") || "Niemand";
  playCelebration(`Klaar! Winnaar: ${winner}`, `🐷 Hoera ${winner}!`);
}

function playCelebration(message, piggyMessage) {
  els.winnerText.textContent = message;
  els.piggy.textContent = piggyMessage;
  els.partyBear.textContent = "🐻 Ik vier mee!";
  els.danceBanana.textContent = "🍌 Dans-dans!";

  els.celebrationLayer.classList.add("active");
  runConfetti(2400);
  runFireworks(2600);
  runBalloons(18);

  setTimeout(() => {
    els.celebrationLayer.classList.remove("active");
  }, 3200);
}

function runFireworks(durationMs) {
  const canvas = els.fireworkCanvas;
  const ctx = canvas.getContext("2d");
  const sparks = [];
  const colors = ["#ff6b00", "#ffd43b", "#35a7ff", "#2ec4b6", "#ff4d4d"];

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { once: true });

  const start = performance.now();
  requestAnimationFrame(frame);

  function spawnBurst() {
    const cx = canvas.width * (0.15 + Math.random() * 0.7);
    const cy = canvas.height * (0.12 + Math.random() * 0.4);
    const parts = 42;

    for (let i = 0; i < parts; i += 1) {
      const angle = (Math.PI * 2 * i) / parts;
      const speed = 2 + Math.random() * 4.2;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 3
      });
    }

    // Kernflits in het midden voor extra zichtbaar vuurwerk.
    sparks.push({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      life: 0.55,
      color: "#ffffff",
      size: 6
    });
  }

  function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if ((now - start) % 360 < 16) {
      spawnBurst();
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.03;
      s.life -= 0.015;

      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (now - start < durationMs) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

function runBalloons(count) {
  els.balloons.innerHTML = "";
  const colors = ["#ff6b00", "#00a8a8", "#ff4d4d", "#ffd43b", "#35a7ff"];

  for (let i = 0; i < count; i += 1) {
    const b = document.createElement("span");
    b.className = "balloon";
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDelay = `${Math.random() * 0.9}s`;
    b.style.background = colors[i % colors.length];
    els.balloons.appendChild(b);
  }
}

function runConfetti(durationMs) {
  const canvas = els.confettiCanvas;
  const ctx = canvas.getContext("2d");
  const pieces = [];
  const colors = ["#ff6b00", "#00a8a8", "#ff4d4d", "#ffd43b", "#2ec4b6"];

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { once: true });

  for (let i = 0; i < 180; i += 1) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      size: 4 + Math.random() * 8,
      speedY: 2 + Math.random() * 4,
      speedX: -2 + Math.random() * 4,
      angle: Math.random() * Math.PI,
      tilt: Math.random() * 0.12,
      color: colors[i % colors.length]
    });
  }

  const start = performance.now();
  requestAnimationFrame(frame);

  function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const piece of pieces) {
      piece.x += piece.speedX;
      piece.y += piece.speedY;
      piece.angle += piece.tilt;

      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.angle);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      ctx.restore();

      if (piece.y > canvas.height + 20) {
        piece.y = -20;
      }
    }

    if (now - start < durationMs) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

function computeTotals(game) {
  const totals = Object.fromEntries(game.playerIds.map((id) => [id, 0]));

  for (const round of game.rounds) {
    for (const [playerId, score] of Object.entries(round.scores)) {
      totals[playerId] = (totals[playerId] || 0) + Number(score || 0);
    }
  }

  return totals;
}

function evaluateGameEnd(game, options = {}) {
  const { manual = false } = options;
  const rules = getGameRules(game);
  if (!Array.isArray(game.rounds) || game.rounds.length === 0) {
    return {
      shouldEnd: false,
      awaitingTiebreak: false,
      winnerIds: [],
      message: ""
    };
  }

  const rankedEntries = getRankedEntries(game);
  const topEntry = rankedEntries[0];

  if (!topEntry) {
    return {
      shouldEnd: false,
      awaitingTiebreak: false,
      winnerIds: [],
      message: ""
    };
  }

  const winnerIds = rankedEntries
    .filter((entry) => entry.score === topEntry.score)
    .map((entry) => entry.playerId);

  const reachedThreshold =
    rules.autoEnd && rules.winThreshold !== null
      ? rules.scoreDirection === "low"
        ? topEntry.score <= rules.winThreshold
        : topEntry.score >= rules.winThreshold
      : false;

  const hasTie = winnerIds.length > 1;
  if (hasTie && !rules.allowSharedWin) {
    return {
      shouldEnd: false,
      awaitingTiebreak: true,
      winnerIds,
      message: rules.tieBreakLabel || "Er is een gelijkspel. Speel een beslissende ronde."
    };
  }

  if (manual || reachedThreshold) {
    return {
      shouldEnd: true,
      awaitingTiebreak: false,
      winnerIds,
      message: ""
    };
  }

  return {
    shouldEnd: false,
    awaitingTiebreak: false,
    winnerIds,
    message: ""
  };
}

function getRankedEntries(game) {
  const totals = computeTotals(game);
  const directionFactor = getGameRules(game).scoreDirection === "low" ? 1 : -1;
  return Object.entries(totals)
    .map(([playerId, score]) => ({
      playerId,
      score
    }))
    .sort((a, b) => {
      const scoreDelta = directionFactor * (a.score - b.score);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const aName = getPlayer(a.playerId)?.name || "";
      const bName = getPlayer(b.playerId)?.name || "";
      return aName.localeCompare(bName, "nl");
    });
}

function computeWinRanking() {
  const rankingMap = new Map();

  for (const player of state.players) {
    rankingMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      wins: 0,
      sharedWins: 0
    });
  }

  for (const game of state.games) {
    if (!game.endedAt || !Array.isArray(game.rounds) || game.rounds.length === 0) {
      continue;
    }

    if (state.rankingResetAt && new Date(game.endedAt).getTime() < new Date(state.rankingResetAt).getTime()) {
      continue;
    }

    const winners = getGameWinnerIds(game);
    if (winners.length === 0) {
      continue;
    }

    for (const winnerId of winners) {
      const entry = rankingMap.get(winnerId);
      if (!entry) {
        continue;
      }

      entry.wins += 1;
      if (winners.length > 1) {
        entry.sharedWins += 1;
      }
    }
  }

  return Array.from(rankingMap.values())
    .filter((entry) => entry.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.sharedWins - a.sharedWins || a.name.localeCompare(b.name, "nl"));
}

function computePlayerStats() {
  const endedGames = state.games
    .filter((game) => Array.isArray(game.rounds) && game.rounds.length > 0)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return state.players
    .map((player) => {
      let wins = 0;
      let totalScore = 0;
      let gamesPlayed = 0;
      let highestRound = 0;
      let longestStreak = 0;
      let currentStreak = 0;

      for (const game of endedGames) {
        if (!game.playerIds.includes(player.id)) {
          continue;
        }

        const totals = computeTotals(game);
        totalScore += Number(totals[player.id] || 0);
        gamesPlayed += 1;

        for (const round of game.rounds) {
          highestRound = Math.max(highestRound, Number(round.scores[player.id] || 0));
        }

        if (game.endedAt && getGameWinnerIds(game).includes(player.id)) {
          wins += 1;
          currentStreak += 1;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (game.endedAt) {
          currentStreak = 0;
        }
      }

      return {
        playerId: player.id,
        name: player.name,
        wins,
        averageScore: gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0,
        highestRound,
        longestStreak,
        gamesPlayed
      };
    })
    .filter((entry) => entry.gamesPlayed > 0)
    .sort((a, b) => b.wins - a.wins || b.longestStreak - a.longestStreak || a.name.localeCompare(b.name, "nl"));
}

function getGameWinnerIds(game) {
  return evaluateGameEnd(game, { manual: true }).winnerIds;
}

function getTemplateById(templateId) {
  return GAME_TEMPLATES.find((template) => template.id === templateId) || GAME_TEMPLATES[0];
}

function getGameTemplate(game) {
  const template = getTemplateById(game?.templateId || state.lastTemplateId || "custom");
  return {
    ...template,
    rulesLabel: describeRules(getGameRules(game ?? { templateId: template.id, rules: cloneRules(template) }))
  };
}

function getGameRules(game) {
  const template = getTemplateById(game?.templateId);
  return {
    ...cloneRules(template),
    ...(game?.rules || {}),
    winThreshold: game?.winScore ?? game?.rules?.winThreshold ?? template.winThreshold
  };
}

function cloneRules(template) {
  return {
    scoreDirection: template.scoreDirection,
    winThreshold: template.winThreshold,
    autoEnd: template.autoEnd,
    allowSharedWin: template.allowSharedWin,
    tieBreakLabel: template.tieBreakLabel
  };
}

function describeRules(rules) {
  const direction = rules.scoreDirection === "low" ? "laagste score wint" : "hoogste score wint";
  const ending =
    rules.autoEnd && rules.winThreshold !== null
      ? `auto einde bij ${rules.winThreshold}`
      : "handmatig einde";
  const tie = rules.allowSharedWin ? "gedeelde winst ok" : "tie-break bij gelijkspel";
  return `${direction} · ${ending} · ${tie}`;
}

function getShareLink() {
  if (!cloud.room) {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("room", cloud.room);
  url.hash = "new-game";
  return url.toString();
}

function getQrCodeUrl() {
  const link = getShareLink();
  if (!link) {
    return "";
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;
}

function slugifyRoom(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 24);
}

function createRoomCode() {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
}

function getPlayer(id) {
  return state.players.find((player) => player.id === id);
}

function getActiveGame() {
  return state.games.find((game) => game.id === state.activeGameId) || null;
}

function saveAndRender() {
  const currentSnapshot = serializeState(state);
  if (currentSnapshot !== lastCommittedState) {
    undoStack.push(lastCommittedState);
    if (undoStack.length > 40) {
      undoStack.shift();
    }
    redoStack.length = 0;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  lastCommittedState = currentSnapshot;
  render();
  scheduleAutoPush();
}

function serializeState(snapshotState) {
  return JSON.stringify({
    players: snapshotState.players,
    games: snapshotState.games,
    activeGameId: snapshotState.activeGameId,
    rankingResetAt: snapshotState.rankingResetAt,
    groups: snapshotState.groups,
    lastTemplateId: snapshotState.lastTemplateId
  });
}

function restoreState(serializedSnapshot) {
  const snapshot = JSON.parse(serializedSnapshot);
  state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
  state.games = Array.isArray(snapshot.games) ? snapshot.games : [];
  state.activeGameId = snapshot.activeGameId || state.games[0]?.id || null;
  state.rankingResetAt = snapshot.rankingResetAt || null;
  state.groups = Array.isArray(snapshot.groups) ? snapshot.groups : [];
  state.lastTemplateId = typeof snapshot.lastTemplateId === "string" ? snapshot.lastTemplateId : "custom";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  lastCommittedState = serializeState(state);
  render();
  scheduleAutoPush();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      players: [],
      games: [],
      activeGameId: null,
      rankingResetAt: null,
      groups: [],
      lastTemplateId: "custom"
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      games: Array.isArray(parsed.games) ? parsed.games : [],
      activeGameId: parsed.activeGameId || null,
      rankingResetAt: parsed.rankingResetAt || null,
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      lastTemplateId: typeof parsed.lastTemplateId === "string" ? parsed.lastTemplateId : "custom"
    };
  } catch {
    return {
      players: [],
      games: [],
      activeGameId: null,
      rankingResetAt: null,
      groups: [],
      lastTemplateId: "custom"
    };
  }
}

function resolveInitialTab() {
  const hashTab = window.location.hash.replace("#", "");
  if (["players", "new-game", "score"].includes(hashTab)) {
    return hashTab;
  }

  return state.activeGameId ? "score" : "players";
}

function loadCloudConfig() {
  const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
  const urlRoom = slugifyRoom(new URL(window.location.href).searchParams.get("room") || "");
  const fallback = {
    url: sanitizeSupabaseUrl(runtimeConfig.supabaseUrl),
    anonKey: runtimeConfig.supabaseAnonKey,
    room: urlRoom,
    lastSyncedAt: null
  };

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      url:
        typeof parsed.url === "string" && parsed.url.trim()
          ? sanitizeSupabaseUrl(parsed.url)
          : fallback.url,
      anonKey:
        typeof parsed.anonKey === "string" && parsed.anonKey.trim() ? parsed.anonKey : fallback.anonKey,
      room: urlRoom || (typeof parsed.room === "string" && parsed.room.trim() ? slugifyRoom(parsed.room) : ""),
      lastSyncedAt: parsed.lastSyncedAt || null
    };
  } catch {
    return fallback;
  }
}

function hasMeaningfulLocalState() {
  return state.players.length > 0 || state.games.length > 0 || state.groups.length > 0;
}

function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloud));
}

function getRuntimeConfig() {
  const cfg = window.SPELLTEL_CONFIG || window.SPELTELLER_CONFIG;
  if (!cfg || typeof cfg !== "object") {
    return {
      supabaseUrl: "",
      supabaseAnonKey: ""
    };
  }

  return {
    supabaseUrl: typeof cfg.supabaseUrl === "string" ? cfg.supabaseUrl.trim() : "",
    supabaseAnonKey: typeof cfg.supabaseAnonKey === "string" ? cfg.supabaseAnonKey.trim() : ""
  };
}

function createAvatar(name, color = "#ff6b00") {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const textFill = (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#2c1f2a" : "#ffffff";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='100%' height='100%' fill='${color}'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-size='24' font-family='Arial' fill='${textFill}'>${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toDataUrl(file) {
  if (!file) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSize = 240;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > h) {
        if (w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        }
      } else if (h > maxSize) {
        w = Math.round((w * maxSize) / h);
        h = maxSize;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Kon foto niet lezen"));
    };
    img.src = objectUrl;
  });
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        swRegistration = registration;
        monitorServiceWorker(registration);
        syncPwaStatus();
      })
      .catch((error) => {
        console.error("Service worker registratie mislukt", error);
        syncPwaStatus("Installatieondersteuning kon niet volledig worden ingeschakeld.");
      });
  } else {
    syncPwaStatus();
  }
}

function monitorServiceWorker(registration) {
  if (!registration) {
    return;
  }

  if (registration.waiting) {
    syncPwaStatus("Een nieuwe app-versie staat klaar. Heropen de app om te verversen.");
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        syncPwaStatus("Nieuwe versie beschikbaar. Sluit en open de app opnieuw.");
      }
    });
  });
}

function syncPwaStatus(message = "") {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isOffline = !navigator.onLine;

  els.installBtn.hidden = isStandalone || !deferredPrompt;

  let statusMessage = message;
  if (!statusMessage) {
    if (isOffline) {
      statusMessage = "Offline modus actief. Je lokale speldata blijft beschikbaar.";
    } else if (swRegistration?.waiting) {
      statusMessage = "Nieuwe versie beschikbaar. Sluit en open de app opnieuw.";
    } else if (isStandalone) {
      statusMessage = "Appmodus actief.";
    } else if (deferredPrompt) {
        statusMessage = "Je kunt SpelTel op je beginscherm installeren.";
    }
  }

  els.pwaStatus.textContent = statusMessage;
  els.pwaStatus.hidden = !statusMessage;
}
