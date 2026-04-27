// En production (Vercel) : on utilise le chemin relatif — la function serverless est
// servie sur le même domaine sous /api.
// En dev : Vite proxy redirige /api/* vers http://localhost:3000 (cf. vite.config.js).
// Possibilité d'override via VITE_API_URL (ex: http://192.168.1.10:3000 pour tester sur téléphone).
const BASE = import.meta.env.VITE_API_URL || '';

const ADMIN_KEY = 'camas_admin_code';
const PLAYER_TOKEN_KEY = 'camas_player_token';
const PLAYER_USER_KEY = 'camas_player_user';

export function getAdminCode() {
  try { return localStorage.getItem(ADMIN_KEY) || ''; } catch { return ''; }
}
export function setAdminCode(code) {
  try {
    if (code) localStorage.setItem(ADMIN_KEY, code);
    else localStorage.removeItem(ADMIN_KEY);
  } catch { /* ignore */ }
}
export function clearAdminCode() { setAdminCode(''); }

export function getPlayerToken() {
  try { return localStorage.getItem(PLAYER_TOKEN_KEY) || ''; } catch { return ''; }
}
export function setPlayerToken(token) {
  try {
    if (token) localStorage.setItem(PLAYER_TOKEN_KEY, token);
    else localStorage.removeItem(PLAYER_TOKEN_KEY);
  } catch { /* ignore */ }
}
export function clearPlayerToken() { setPlayerToken(''); }

export function getStoredPlayer() {
  try {
    const raw = localStorage.getItem(PLAYER_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function setStoredPlayer(player) {
  try {
    if (player) localStorage.setItem(PLAYER_USER_KEY, JSON.stringify(player));
    else localStorage.removeItem(PLAYER_USER_KEY);
  } catch { /* ignore */ }
}
export function clearStoredPlayer() { setStoredPlayer(null); }

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const code = getAdminCode();
  if (code) headers['x-admin-code'] = code;
  const playerToken = getPlayerToken();
  if (playerToken) headers.Authorization = `Bearer ${playerToken}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Réseau indisponible — réessaie dans un instant', { cause: err });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  authRegister:    (body) => req('/api/auth/register', { method: 'POST', body }),
  authLogin:       (identifier, password) => req('/api/auth/login', { method: 'POST', body: { identifier, password } }),
  authMe:          () => req('/api/auth/me'),
  updateMyProfile: (body) => req('/api/auth/me', { method: 'PATCH', body }),

  listPlayers:     () => req('/api/players'),
  createPlayer:    (body) => req('/api/players', { method: 'POST', body }),
  updatePlayer:    (id, body) => req(`/api/players/${id}`, { method: 'PATCH', body }),
  deletePlayer:    (id) => req(`/api/players/${id}`, { method: 'DELETE' }),
  playerProfile:   (id) => req(`/api/players/${id}/profile`),

  currentMatch:    () => req('/api/match/current'),
  birthdaysToday:  () => req('/api/birthdays/today'),
  birthdaysUpcoming: () => req('/api/birthdays/upcoming'),
  lastMatch:       () => req('/api/match/last'),

  // Nouveau format: intent = 'yes' | 'maybe' | 'no'. position requis si intent === 'yes'.
  vote:            (intent, position = null) =>
    req('/api/vote', { method: 'POST', body: { intent, position } }),
  unvote:          (matchId) =>
    req('/api/vote', { method: 'DELETE', body: { matchId } }),
  updatePosition:  (playerId, matchId, position) =>
    req('/api/vote/position', { method: 'PATCH', body: { playerId, matchId, position } }),

  teams:           (matchId) => req(`/api/teams/${matchId}`),
  setResult:       (matchId, teamA, teamB) =>
    req(`/api/match/${matchId}/result`, { method: 'POST', body: { teamA, teamB } }),

  recordGoals:     (body) => req('/api/goals', { method: 'POST', body }),
  matchGoals:      (matchId) => req(`/api/goals/${matchId}`),

  scorers:         () => req('/api/stats/scorers'),
  attendanceStats: () => req('/api/stats/attendance'),
  seasonRange:     () => req('/api/stats/season'),

  // Historique public des matchs (lecture seule, score + buteurs par dimanche)
  matchHistory:    () => req('/api/match/history'),
  // Galerie photos des équipes vainqueurs (public)
  matchGallery:    () => req('/api/match/gallery'),

  // Calendrier admin
  matchCalendar:   () => req('/api/match/calendar'),
  scheduleMatch:   (date, kickoff = '10:00', notes = null) =>
                     req('/api/match/schedule', { method: 'POST', body: { date, kickoff, notes } }),
  deleteMatch:     (id) => req(`/api/match/${id}`, { method: 'DELETE' }),
  setMatchPhoto:   (id, photoUrl, winnerTeam) =>
                     req(`/api/match/${id}/photo`, { method: 'PATCH', body: { photoUrl, winnerTeam } }),

  fines:           () => req('/api/fines'),
  addFine:         (body) => req('/api/fines', { method: 'POST', body }),
  payFine:         (id) => req(`/api/fines/${id}/pay`, { method: 'POST' }),

  listExpenses:    () => req('/api/expenses'),
  addExpense:      (body) => req('/api/expenses', { method: 'POST', body }),
  caisse:          () => req('/api/caisse'),
  inventory:       () => req('/api/inventory'),
  addInventoryItem:(body) => req('/api/inventory', { method: 'POST', body }),
  updateInventoryItem: (id, body) => req(`/api/inventory/${id}`, { method: 'PATCH', body }),
  deleteInventoryItem: (id) => req(`/api/inventory/${id}`, { method: 'DELETE' }),

  // Announcements (lecture publique, écriture admin-only via header)
  listAnnouncements: () => req('/api/announcements'),
  addAnnouncement:   (body) => req('/api/announcements', { method: 'POST', body }),
  updateAnnouncement:(id, body) => req(`/api/announcements/${id}`, { method: 'PATCH', body }),
  deleteAnnouncement:(id) => req(`/api/announcements/${id}`, { method: 'DELETE' }),

  // Man of the Match
  motmVote:    (matchId, votedId) => req('/api/motm/vote', { method: 'POST', body: { matchId, votedId } }),
  motmResults: (matchId) => req(`/api/motm/${matchId}`),
  motmMyVote:  (matchId) => req(`/api/motm/me/${matchId}`),
  motmLast:    () => req('/api/motm/last'),

  // Consentement RGPD/DSGVO
  recordConsent: (kind, granted = true) => req('/api/consent', { method: 'POST', body: { kind, granted } }),

  // Vérifie le code admin auprès du backend
  adminCheck:      (code) => fetch(`${BASE}/api/admin/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Code admin invalide');
    return d;
  }),

  // Ajout de la route pour modifier le match (admin)
  updateMatch:     (id, data) => req(`/api/match/${id}`, { method: 'PATCH', body: data }),
  updateMatchPhoto: (id, photoUrl, winnerTeam) =>
    req(`/api/match/${id}/photo`, { method: 'PATCH', body: { photoUrl, winnerTeam } }),
};
