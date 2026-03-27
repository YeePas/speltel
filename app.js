const STORAGE_KEY = "spelteller-data-v1";
const CLOUD_CONFIG_KEY = "spelteller-cloud-v1";
const runtimeConfig = getRuntimeConfig();

const state = loadState();
const cloud = loadCloudConfig();
let deferredPrompt;
let editingRoundId = null;
let editingPlayerId = null;
let activeTab = resolveInitialTab();
let swRegistration = null;

const els = {
  installBtn: document.getElementById("installBtn"),
  pwaStatus: document.getElementById("pwaStatus"),
  footerPartyBtn: document.getElementById("footerPartyBtn"),
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
  gameForm: document.getElementById("gameForm"),
  gameName: document.getElementById("gameName"),
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

function wireEvents() {
  for (const button of els.tabButtons) {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  }

  els.playerForm.addEventListener("submit", onCreatePlayer);
  els.resetRankingBtn.addEventListener("click", onResetRanking);
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
    syncPwaStatus("SpelTeller is geinstalleerd op dit apparaat.");
  });

  window.addEventListener("online", () => {
    syncPwaStatus("Je bent weer online.");
  });

  window.addEventListener("offline", () => {
    syncPwaStatus("Offline modus actief. Je lokale speldata blijft beschikbaar.");
  });
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

  const playerIds = Array.from(els.gamePlayers.querySelectorAll("input:checked")).map((input) => input.value);
  if (playerIds.length === 0) {
    alert("Kies minimaal 1 speler voor dit spel.");
    return;
  }

  const game = {
    id: crypto.randomUUID(),
    name,
    playerIds,
    winScore: Number(els.gameWinScore.value) || null,
    rounds: [],
    endedAt: null,
    createdAt: new Date().toISOString()
  };

  state.games.unshift(game);
  state.activeGameId = game.id;
  saveAndRender();
  setActiveTab("score");
  els.gameForm.reset();
}

function onResetRanking() {
  if (!confirm("De win ranking opnieuw vanaf nu laten tellen? Bestaande spelers en spellen blijven bewaard.")) {
    return;
  }

  state.rankingResetAt = new Date().toISOString();
  saveAndRender();
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

  // check win score
  if (game.winScore) {
    const totals = computeTotals(game);
    const winEntry = Object.entries(totals).find(([, score]) => score >= game.winScore);
    if (winEntry) {
      game.endedAt = new Date().toISOString();
      saveAndRender();
      celebrateGame(game);
      return;
    }
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

  const selectedIds = new Set(game.playerIds);
  for (const checkbox of els.gamePlayers.querySelectorAll("input[type='checkbox']")) {
    checkbox.checked = selectedIds.has(checkbox.value);
  }

  els.gameName.value = "";
  els.gameForm.scrollIntoView({ behavior: "smooth", block: "center" });
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

  game.endedAt = new Date().toISOString();
  saveAndRender();
  celebrateGame(game);
}

function onFooterParty() {
  const game = getActiveGame();
  if (game) {
    const totals = computeTotals(game);
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    const winner = top ? getPlayer(top[0])?.name : "Iedereen";
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
  renderTabs();
  renderPlayers();
  renderWinRanking();
  renderGamePlayerSelectors();
  renderSavedGames();
  renderActiveGame();
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

function renderCloudForm() {
  els.supabaseUrl.value = cloud.url;
  els.supabaseAnonKey.value = cloud.anonKey;
  els.supabaseRoom.value = cloud.room;
  renderCloudStatus();
}

function renderCloudStatus(message) {
  const hasConfig = Boolean(cloud.url && cloud.anonKey && cloud.room);
  if (message) {
    els.cloudStatus.textContent = `Cloud status: ${message}`;
    return;
  }

  if (!hasConfig) {
    els.cloudStatus.textContent = "Cloud status: nog niet verbonden.";
    return;
  }

  const lastSync = cloud.lastSyncedAt ? new Date(cloud.lastSyncedAt).toLocaleString("nl-NL") : "nog niet";
  els.cloudStatus.textContent = `Cloud status: verbonden met room '${cloud.room}' (laatste sync: ${lastSync}).`;
}

function onSaveCloudConfig() {
  cloud.url = sanitizeSupabaseUrl(els.supabaseUrl.value.trim());
  cloud.anonKey = els.supabaseAnonKey.value.trim();
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

async function onPushToCloud() {
  if (!ensureCloudConfig()) {
    return;
  }

  try {
    renderCloudStatus("sync bezig (upload)...");
    await upsertCloudState(cloudSnapshot());
    cloud.lastSyncedAt = new Date().toISOString();
    saveCloudConfig();
    renderCloudStatus("upload klaar.");
  } catch (error) {
    console.error(error);
    renderCloudStatus(`upload mislukt (${error.message}).`);
  }
}

async function onPullFromCloud() {
  if (!ensureCloudConfig()) {
    return;
  }

  try {
    renderCloudStatus("sync bezig (download)...");
    const remoteState = await fetchCloudState();
    if (!remoteState) {
      renderCloudStatus("geen cloud-data gevonden voor deze room.");
      return;
    }

    if (!confirm("Lokale data overschrijven met cloud-data?")) {
      renderCloudStatus("download geannuleerd.");
      return;
    }

    state.players = Array.isArray(remoteState.players) ? remoteState.players : [];
    state.games = Array.isArray(remoteState.games) ? remoteState.games : [];
    state.activeGameId = remoteState.activeGameId || state.games[0]?.id || null;
    cloud.lastSyncedAt = new Date().toISOString();
    saveCloudConfig();
    saveAndRender();
    renderCloudStatus("download klaar.");
  } catch (error) {
    console.error(error);
    renderCloudStatus(`download mislukt (${error.message}).`);
  }
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

function cloudSnapshot() {
  return {
    players: state.players,
    games: state.games,
    activeGameId: state.activeGameId
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
}

async function fetchCloudState() {
  const endpoint = `${cloud.url}/rest/v1/game_state?room_id=eq.${encodeURIComponent(
    cloud.room
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

  return rows[0].state;
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

    avatar.src = player.photo || createAvatar(player.name, player.color);
    avatar.alt = player.name;
    avatar.style.borderColor = player.color || "#ff6b00";
    name.textContent = player.name;

    const editBtn = node.querySelector(".edit-btn");
    const removeBtn = node.querySelector(".remove-btn");

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
    wrapper.className = "choice";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = player.id;

    const text = document.createElement("span");
    text.textContent = player.name;

    wrapper.append(input, text);
    els.gamePlayers.appendChild(wrapper);
  }
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

    meta.innerHTML = `<strong>${escapeHtml(game.name)}</strong><br /><small>${game.rounds.length} rondes${
      game.endedAt ? " - klaar" : ""
    }</small>`;

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

  els.activeGameTitle.textContent = game.name;
  els.activeGameMeta.textContent = `${playerNames || "Geen spelers"}${
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
  const totals = computeTotals(game);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  els.leaderboard.innerHTML = "";

  const medals = ["🥇", "🥈", "🥉"];

  sorted.forEach(([playerId, score], index) => {
    const li = document.createElement("li");
    const player = getPlayer(playerId);
    if (index === 0) li.classList.add("rank-1");

    const rankBadge = medals[index] || `${index + 1}.`;
    li.innerHTML = `<span class="rank-badge">${rankBadge}</span><span class="lb-name">${escapeHtml(player?.name || "Onbekend")}</span><span class="lb-score">${score} punten</span>`;
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

function celebrateGame(game) {
  const totals = computeTotals(game);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const winner = top ? getPlayer(top[0])?.name : "Niemand";
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

function getGameWinnerIds(game) {
  const totals = computeTotals(game);
  const scores = Object.entries(totals);
  if (scores.length === 0) {
    return [];
  }

  const topScore = Math.max(...scores.map(([, score]) => score));
  return scores.filter(([, score]) => score === topScore).map(([playerId]) => playerId);
}

function getPlayer(id) {
  return state.players.find((player) => player.id === id);
}

function getActiveGame() {
  return state.games.find((game) => game.id === state.activeGameId) || null;
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      players: [],
      games: [],
      activeGameId: null,
      rankingResetAt: null
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      games: Array.isArray(parsed.games) ? parsed.games : [],
      activeGameId: parsed.activeGameId || null,
      rankingResetAt: parsed.rankingResetAt || null
    };
  } catch {
    return {
      players: [],
      games: [],
      activeGameId: null,
      rankingResetAt: null
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
  const fallback = {
    url: sanitizeSupabaseUrl(runtimeConfig.supabaseUrl),
    anonKey: runtimeConfig.supabaseAnonKey,
    room: "",
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
      room: typeof parsed.room === "string" && parsed.room.trim() ? parsed.room : fallback.room,
      lastSyncedAt: parsed.lastSyncedAt || null
    };
  } catch {
    return fallback;
  }
}

function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloud));
}

function getRuntimeConfig() {
  const cfg = window.SPELTELLER_CONFIG;
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
        if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
      } else {
        if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
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
      statusMessage = "Je kunt SpelTeller op je beginscherm installeren.";
    }
  }

  els.pwaStatus.textContent = statusMessage;
  els.pwaStatus.hidden = !statusMessage;
}
