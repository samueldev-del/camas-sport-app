// En production (Vercel) : on utilise le chemin relatif — la function serverless est
// servie sur le même domaine sous /api.
// En dev : Vite proxy redirige /api/* vers http://localhost:3000 (cf. vite.config.js).
// Possibilité d'override via VITE_API_URL (ex: http://192.168.1.10:3000 pour tester sur téléphone).
const BASE = import.meta.env.VITE_API_URL || '';

const ADMIN_KEY = 'camas_admin_code';

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

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const code = getAdminCode();
  if (code) headers['x-admin-code'] = code;

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
  listPlayers:     () => req('/api/players'),
  createPlayer:    (body) => req('/api/players', { method: 'POST', body }),
  updatePlayer:    (id, body) => req(`/api/players/${id}`, { method: 'PATCH', body }),
  deletePlayer:    (id) => req(`/api/players/${id}`, { method: 'DELETE' }),
  playerProfile:   (id) => req(`/api/players/${id}/profile`),
  updatePin:       (id, oldPin, newPin) => req(`/api/players/${id}/pin`, { method: 'PATCH', body: { oldPin, newPin } }),

  currentMatch:    () => req('/api/match/current'),
  lastMatch:       () => req('/api/match/last'),

  // Nouveau format: intent = 'yes' | 'maybe' | 'no'. position requis si intent === 'yes'. Ajout du PIN.
  vote:            (playerId, intent, position = null, pin = null) =>
    req('/api/vote', { method: 'POST', body: { playerId, intent, position, pin } }),
  unvote:          (playerId, matchId) =>
    req('/api/vote', { method: 'DELETE', body: { playerId, matchId } }),
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

  // Announcements (lecture publique, écriture admin-only via header)
  listAnnouncements: () => req('/api/announcements'),
  addAnnouncement:   (body) => req('/api/announcements', { method: 'POST', body }),
  updateAnnouncement:(id, body) => req(`/api/announcements/${id}`, { method: 'PATCH', body }),
  deleteAnnouncement:(id) => req(`/api/announcements/${id}`, { method: 'DELETE' }),

  // Man of the Match
  motmVote:    (matchId, voterId, votedId) => req('/api/motm/vote', { method: 'POST', body: { matchId, voterId, votedId } }),
  motmResults: (matchId) => req(`/api/motm/${matchId}`),
  motmMyVote:  (matchId, voterId) => req(`/api/motm/me/${matchId}/${voterId}`),
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
};
