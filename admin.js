const ADMIN_SESSION_KEY = "speltel-admin-session-v1";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const runtimeConfig = getRuntimeConfig();

const els = {
  loginCard: document.getElementById("adminLoginCard"),
  loginForm: document.getElementById("adminLoginForm"),
  loginStatus: document.getElementById("adminLoginStatus"),
  username: document.getElementById("adminUsername"),
  password: document.getElementById("adminPassword"),
  dashboard: document.getElementById("adminDashboard"),
  refreshRoomsBtn: document.getElementById("refreshRoomsBtn"),
  logoutAdminBtn: document.getElementById("logoutAdminBtn"),
  roomCount: document.getElementById("roomCount"),
  playerCount: document.getElementById("playerCount"),
  gameCount: document.getElementById("gameCount"),
  roomSearch: document.getElementById("roomSearch"),
  adminStatus: document.getElementById("adminStatus"),
  roomList: document.getElementById("roomList")
};

let allRooms = [];

wireEvents();
initialize();

function wireEvents() {
  els.loginForm.addEventListener("submit", onLogin);
  els.refreshRoomsBtn.addEventListener("click", () => {
    void loadRooms();
  });
  els.logoutAdminBtn.addEventListener("click", onLogout);
  els.roomSearch.addEventListener("input", renderRooms);
}

function initialize() {
  const isLoggedIn = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  renderAuthState(isLoggedIn);
  if (isLoggedIn) {
    void loadRooms();
  }
}

function renderAuthState(isLoggedIn) {
  els.loginCard.hidden = isLoggedIn;
  els.dashboard.hidden = !isLoggedIn;
}

function setLoginStatus(message, state = "idle") {
  els.loginStatus.hidden = !message;
  els.loginStatus.textContent = message;
  els.loginStatus.dataset.state = state;
}

function setAdminStatus(message, state = "idle") {
  els.adminStatus.hidden = !message;
  els.adminStatus.textContent = message;
  els.adminStatus.dataset.state = state;
}

function onLogin(event) {
  event.preventDefault();
  const username = els.username.value.trim();
  const password = els.password.value;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    setLoginStatus("Onjuiste admin-gegevens.", "error");
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  setLoginStatus("");
  renderAuthState(true);
  void loadRooms();
}

function onLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  els.loginForm.reset();
  renderAuthState(false);
  setAdminStatus("");
  allRooms = [];
  els.roomList.innerHTML = "";
}

async function loadRooms() {
  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
    setAdminStatus("Supabase config ontbreekt.", "error");
    return;
  }

  setAdminStatus("Rooms laden...", "loading");

  try {
    const response = await fetch(
      `${runtimeConfig.supabaseUrl}/rest/v1/game_state?select=room_id,updated_at,state&order=updated_at.desc`,
      {
        headers: {
          apikey: runtimeConfig.supabaseAnonKey,
          Authorization: `Bearer ${runtimeConfig.supabaseAnonKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rows = await response.json();
    allRooms = Array.isArray(rows) ? rows : [];
    renderSummary();
    renderRooms();
    setAdminStatus(`${allRooms.length} room${allRooms.length === 1 ? "" : "s"} geladen.`, "success");
  } catch (error) {
    console.error(error);
    setAdminStatus(`Rooms laden mislukt (${error.message}).`, "error");
  }
}

function renderSummary() {
  const totals = allRooms.reduce(
    (acc, room) => {
      const snapshot = room.state || {};
      acc.players += Array.isArray(snapshot.players) ? snapshot.players.length : 0;
      acc.games += Array.isArray(snapshot.games) ? snapshot.games.length : 0;
      return acc;
    },
    { players: 0, games: 0 }
  );

  els.roomCount.textContent = String(allRooms.length);
  els.playerCount.textContent = String(totals.players);
  els.gameCount.textContent = String(totals.games);
}

function renderRooms() {
  const query = els.roomSearch.value.trim().toLowerCase();
  const visibleRooms = allRooms.filter((room) => room.room_id.toLowerCase().includes(query));

  els.roomList.innerHTML = "";

  if (visibleRooms.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = query ? "Geen rooms gevonden voor deze zoekterm." : "Nog geen rooms gevonden.";
    els.roomList.appendChild(empty);
    return;
  }

  for (const room of visibleRooms) {
    const snapshot = room.state || {};
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const games = Array.isArray(snapshot.games) ? snapshot.games : [];
    const activeGame = games.find((game) => game.id === snapshot.activeGameId);

    const card = document.createElement("article");
    card.className = "stats-card admin-room-card";
    card.innerHTML = `
      <div class="inline-head">
        <div>
          <h3>${escapeHtml(room.room_id)}</h3>
          <p class="muted">Laatste update: ${formatDate(room.updated_at)}</p>
        </div>
        <div class="inline-actions">
          <a class="ghost-btn tiny" href="./?room=${encodeURIComponent(room.room_id)}">Open Room</a>
          <button type="button" class="danger-btn tiny admin-delete-room-btn">Verwijder</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-pill"><span class="stat-label">Spelers</span><span class="stat-value">${players.length}</span></div>
        <div class="stat-pill"><span class="stat-label">Spellen</span><span class="stat-value">${games.length}</span></div>
        <div class="stat-pill"><span class="stat-label">Actief spel</span><span class="stat-value">${escapeHtml(
          activeGame?.name || "-"
        )}</span></div>
      </div>
      <p class="muted">${players.map((player) => player.name).join(", ") || "Geen spelers in deze room."}</p>
    `;
    card.querySelector(".admin-delete-room-btn").addEventListener("click", () => {
      void deleteRoom(room.room_id);
    });
    els.roomList.appendChild(card);
  }
}

async function deleteRoom(roomId) {
  if (!confirm(`Weet je zeker dat je room '${roomId}' wilt verwijderen?`)) {
    return;
  }

  setAdminStatus(`Room '${roomId}' verwijderen...`, "loading");

  try {
    const response = await fetch(
      `${runtimeConfig.supabaseUrl}/rest/v1/game_state?room_id=eq.${encodeURIComponent(roomId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: runtimeConfig.supabaseAnonKey,
          Authorization: `Bearer ${runtimeConfig.supabaseAnonKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    allRooms = allRooms.filter((room) => room.room_id !== roomId);
    renderSummary();
    renderRooms();
    setAdminStatus(`Room '${roomId}' verwijderd.`, "success");
  } catch (error) {
    console.error(error);
    setAdminStatus(`Room verwijderen mislukt (${error.message}).`, "error");
  }
}

function formatDate(value) {
  if (!value) {
    return "onbekend";
  }

  return new Date(value).toLocaleString("nl-NL");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    supabaseUrl: typeof cfg.supabaseUrl === "string" ? cfg.supabaseUrl.trim().replace(/\/$/, "") : "",
    supabaseAnonKey: typeof cfg.supabaseAnonKey === "string" ? cfg.supabaseAnonKey.trim() : ""
  };
}
