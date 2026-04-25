// En production (Vercel) : on utilise le chemin relatif — la function serverless est
// servie sur le même domaine sous /api.
// En dev : Vite proxy redirige /api/* vers http://localhost:3000 (cf. vite.config.js).
// Possibilité d'override via VITE_API_URL (ex: http://192.168.1.10:3000 pour tester sur téléphone).
const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Erreur réseau : on donne un message clair
    throw new Error('Réseau indisponible — réessaie dans un instant');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  listPlayers:     () => req('/api/players'),
  createPlayer:    (body) => req('/api/players', { method: 'POST', body }),
  updatePlayer:    (id, body) => req(`/api/players/${id}`, { method: 'PATCH', body }),
  deletePlayer:    (id) => req(`/api/players/${id}`, { method: 'DELETE' }),

  currentMatch:    () => req('/api/match/current'),
  lastMatch:       () => req('/api/match/last'),
  vote:            (playerId, position) => req('/api/vote', { method: 'POST', body: { playerId, position } }),
  unvote:          (playerId, matchId) => req('/api/vote', { method: 'DELETE', body: { playerId, matchId } }),
  updatePosition:  (playerId, matchId, position) => req('/api/vote/position', { method: 'PATCH', body: { playerId, matchId, position } }),

  teams:           (matchId) => req(`/api/teams/${matchId}`),
  setResult:       (matchId, teamA, teamB) => req(`/api/match/${matchId}/result`, { method: 'POST', body: { teamA, teamB } }),

  recordGoals:     (body) => req('/api/goals', { method: 'POST', body }),
  matchGoals:      (matchId) => req(`/api/goals/${matchId}`),

  scorers:         () => req('/api/stats/scorers'),
  attendanceStats: () => req('/api/stats/attendance'),

  fines:           () => req('/api/fines'),
  addFine:         (body) => req('/api/fines', { method: 'POST', body }),
  payFine:         (id) => req(`/api/fines/${id}/pay`, { method: 'POST' }),

  addExpense:      (body) => req('/api/expenses', { method: 'POST', body }),
  caisse:          () => req('/api/caisse'),
};
