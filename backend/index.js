const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const app = express();
const port = process.env.PORT || 3000;
const TZ = 'Europe/Berlin';
const LATE_FINE_EUR = 2.0;
const PER_TEAM = 11; // format unique : 11 vs 11

app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL);

// ---------- admin auth (PIN partagé via env var) ----------
const ADMIN_CODE = process.env.ADMIN_CODE || '';

function requireAdmin(req, res, next) {
  if (!ADMIN_CODE) {
    return res.status(503).json({ error: 'ADMIN_CODE non configuré côté serveur' });
  }
  const provided = req.headers['x-admin-code'];
  if (provided !== ADMIN_CODE) {
    return res.status(401).json({ error: 'Accès refusé — code admin invalide' });
  }
  next();
}

// Endpoint de vérification du code admin (le frontend l'appelle au login)
app.post('/api/admin/check', (req, res) => {
  const code = req.body?.code || req.headers['x-admin-code'];
  if (!ADMIN_CODE) return res.status(503).json({ ok: false, error: 'ADMIN_CODE non configuré' });
  if (code !== ADMIN_CODE) return res.status(401).json({ ok: false, error: 'Code invalide' });
  res.json({ ok: true });
});

// ---------- helpers ----------
function nextSundayBerlin() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  const weekday = parts.find(p => p.type === 'weekday').value;
  const days = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[weekday];
  const today = new Date(`${y}-${m}-${d}T00:00:00Z`);
  const offset = days === 0 ? 0 : 7 - days;
  today.setUTCDate(today.getUTCDate() + offset);
  return today.toISOString().slice(0, 10);
}

async function getOrCreateCurrentMatch() {
  const date = nextSundayBerlin();
  const existing = await sql`SELECT * FROM matches WHERE match_date = ${date} LIMIT 1`;
  if (existing.length) return existing[0];
  const created = await sql`INSERT INTO matches (match_date) VALUES (${date}) RETURNING *`;
  return created[0];
}

async function isLateForMatch(match) {
  const [{ late }] = await sql`
    SELECT (NOW() AT TIME ZONE ${TZ}) >
           ((${match.match_date}::date + ${match.kickoff_local}::time)) AS late
  `;
  return late;
}

// ---------- routes ----------
app.get('/', (_req, res) => res.send('⚽ CAMAS Sport API'));

// Players
app.get('/api/players', async (_req, res) => {
  const rows = await sql`SELECT id, name, rating FROM players ORDER BY name`;
  res.json(rows);
});

app.post('/api/players', async (req, res) => {
  const { name, rating = 5.0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const rows = await sql`
      INSERT INTO players (name, rating, pin)
      VALUES (${name.trim()}, ${rating}, '')
      RETURNING id, name, rating
    `;
    res.json(rows[0]);
  } catch (e) {
    if (e.message.includes('unique')) return res.status(409).json({ error: 'Ce nom est déjà utilisé' });
    res.status(500).json({ error: 'Erreur création joueur' });
  }
});

// Modification du code PIN par le joueur lui-même
app.patch('/api/players/:id/pin', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const { oldPin = '', newPin = '' } = req.body || {};

  if (!/^\d{4}$/.test(newPin)) {
    return res.status(400).json({ error: 'Le nouveau code doit être 4 chiffres' });
  }
  if (oldPin && newPin === oldPin) {
    return res.status(400).json({ error: 'Le nouveau code doit être différent' });
  }

  try {
    const [player] = await sql`SELECT pin FROM players WHERE id = ${id}`;
    if (!player) return res.status(404).json({ error: 'Joueur introuvable' });

    if (player.pin && player.pin !== oldPin) {
      return res.status(403).json({ error: 'Ancien code PIN incorrect' });
    }

    await sql`UPDATE players SET pin = ${newPin} WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('updatePin error:', e);
    res.status(500).json({ error: 'Erreur lors de la modification du code' });
  }
});

// Modification d'un joueur (nom/rating) — RÉSERVÉ ADMIN
app.patch('/api/players/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, rating } = req.body;
  const rows = await sql`
    UPDATE players
    SET name   = COALESCE(${name ?? null}, name),
        rating = COALESCE(${rating ?? null}, rating)
    WHERE id = ${id}
    RETURNING id, name, rating
  `;
  res.json(rows[0]);
});

// Suppression d'un joueur — RÉSERVÉ ADMIN (action destructive)
app.delete('/api/players/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await sql`DELETE FROM players WHERE id = ${id}`;
  res.json({ ok: true });
});

// Match
app.get('/api/match/current', async (_req, res) => {
  const match = await getOrCreateCurrentMatch();
  const attendees = await sql`
    SELECT a.*, p.name, p.rating
    FROM attendances a
    JOIN players p ON p.id = a.player_id
    WHERE a.match_id = ${match.id}
    ORDER BY a.vote_time ASC
  `;
  res.json({ match, attendees });
});

// Modifier la date ou l'heure du match actuel (Admin)
app.patch('/api/match/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { match_date, kickoff_local } = req.body;
  try {
    if (match_date) {
      await sql`UPDATE matches SET match_date = ${match_date} WHERE id = ${id}`;
    }
    if (kickoff_local) {
      await sql`UPDATE matches SET kickoff_local = ${kickoff_local} WHERE id = ${id}`;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la modification du match' });
  }
});

// Vote — 3 intentions possibles : 'yes' (vient), 'maybe' (peut-être), 'no' (absent)
app.post('/api/vote', async (req, res) => {
  const { playerId, position, intent = 'yes' } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Joueur requis' });
  if (!['yes','maybe','no'].includes(intent)) {
    return res.status(400).json({ error: 'Intention invalide' });
  }
  if (intent === 'yes' && position && !['G','DEF','MIL','ATT'].includes(position)) {
    return res.status(400).json({ error: 'Poste invalide' });
  }

  const match = await getOrCreateCurrentMatch();
  const late = intent === 'yes' ? await isLateForMatch(match) : false;

  const status = intent === 'no'    ? 'absent'
              : intent === 'maybe' ? 'maybe'
              : (late ? 'late' : 'registered');

  const finalPosition = intent === 'yes' ? (position || null) : null;

  try {
    const rows = await sql`
      INSERT INTO attendances (match_id, player_id, status, is_late, arrival_time, position)
      VALUES (${match.id}, ${playerId}, ${status}, ${late},
              ${intent === 'yes' ? new Date() : null}, ${finalPosition})
      ON CONFLICT (match_id, player_id) DO UPDATE
        SET status       = EXCLUDED.status,
            is_late      = EXCLUDED.is_late,
            arrival_time = EXCLUDED.arrival_time,
            position     = EXCLUDED.position,
            vote_time    = NOW()
      RETURNING *
    `;

    if (intent === 'yes' && late) {
      await sql`
        INSERT INTO fines (player_id, match_id, reason, amount)
        SELECT ${playerId}, ${match.id}, 'Retard', ${LATE_FINE_EUR}
        WHERE NOT EXISTS (
          SELECT 1 FROM fines
          WHERE player_id = ${playerId} AND match_id = ${match.id}
            AND reason = 'Retard' AND paid = FALSE
        )
      `;
    }
    if (intent !== 'yes') {
      await sql`
        DELETE FROM fines
        WHERE match_id = ${match.id} AND player_id = ${playerId} AND paid = FALSE
      `;
    }

    res.json({ success: true, attendance: rows[0], late, status });
  } catch (e) {
    console.error('vote error:', e);
    res.status(500).json({ error: 'Erreur vote: ' + (e.message || 'inconnue') });
  }
});

// Update position after vote
app.patch('/api/vote/position', async (req, res) => {
  const { playerId, matchId, position } = req.body;
  if (!['G','DEF','MIL','ATT'].includes(position)) return res.status(400).json({ error: 'Poste invalide' });
  const rows = await sql`
    UPDATE attendances SET position = ${position}
    WHERE match_id = ${matchId} AND player_id = ${playerId}
    RETURNING *
  `;
  res.json(rows[0]);
});

// Un-vote (cancel presence)
app.delete('/api/vote', async (req, res) => {
  const { playerId, matchId } = req.body;
  await sql`DELETE FROM attendances WHERE match_id = ${matchId} AND player_id = ${playerId}`;
  await sql`DELETE FROM fines WHERE match_id = ${matchId} AND player_id = ${playerId} AND paid = FALSE`;
  res.json({ ok: true });
});

// Teams (snake draft) — format unique : 11 vs 11
app.get('/api/teams/:matchId', async (req, res) => {
  const matchId = parseInt(req.params.matchId, 10);
  const rows = await sql`
    SELECT p.id, p.name, p.rating, a.position
    FROM attendances a
    JOIN players p ON p.id = a.player_id
    WHERE a.match_id = ${matchId} AND a.status IN ('registered','present','late')
    ORDER BY p.rating DESC, p.name ASC
  `;
  const count = rows.length;
  const format = { type: 'Grand Terrain', format: '11 vs 11', perTeam: PER_TEAM };

  const teams = [[], []];
  rows.forEach((p, i) => {
    const round = Math.floor(i / 2);
    const pos = i % 2;
    const idx = round % 2 === 0 ? pos : 1 - pos;
    teams[idx].push({ ...p, rating: Number(p.rating) });
  });

  const result = teams.map(t => {
    const starters = t.slice(0, format.perTeam);
    const subs     = t.slice(format.perTeam);
    return {
      players: t,
      starters, subs,
      total: t.reduce((s, p) => s + p.rating, 0),
      size:  t.length,
    };
  });

  res.json({ count, format, teams: result });
});

// Match result (score) — admin sets final score
app.post('/api/match/:id/result', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { teamA, teamB } = req.body;
  const rows = await sql`
    UPDATE matches
    SET team_a_score = ${teamA ?? null},
        team_b_score = ${teamB ?? null},
        status       = 'done'
    WHERE id = ${id}
    RETURNING *
  `;
  res.json(rows[0]);
});

// Last finished match (for dashboard)
app.get('/api/match/last', async (_req, res) => {
  const rows = await sql`
    SELECT * FROM matches
    WHERE status = 'done' AND team_a_score IS NOT NULL AND team_b_score IS NOT NULL
    ORDER BY match_date DESC LIMIT 1
  `;
  if (!rows.length) return res.json(null);
  const match = rows[0];
  const scorers = await sql`
    SELECT g.*, p.name
    FROM goals g JOIN players p ON p.id = g.player_id
    WHERE g.match_id = ${match.id} AND g.goals > 0
    ORDER BY g.goals DESC
  `;
  res.json({ match, scorers });
});

// Goals — admin only
app.post('/api/goals', requireAdmin, async (req, res) => {
  const { matchId, playerId, goals = 0, assists = 0 } = req.body;
  const rows = await sql`
    INSERT INTO goals (match_id, player_id, goals, assists)
    VALUES (${matchId}, ${playerId}, ${goals}, ${assists})
    ON CONFLICT (match_id, player_id)
    DO UPDATE SET goals = EXCLUDED.goals, assists = EXCLUDED.assists
    RETURNING *
  `;
  res.json(rows[0]);
});

app.get('/api/goals/:matchId', async (req, res) => {
  const matchId = parseInt(req.params.matchId, 10);
  const rows = await sql`
    SELECT g.*, p.name
    FROM goals g JOIN players p ON p.id = g.player_id
    WHERE g.match_id = ${matchId}
    ORDER BY g.goals DESC, g.assists DESC
  `;
  res.json(rows);
});

// Stats
app.get('/api/stats/scorers', async (_req, res) => {
  const rows = await sql`
    SELECT p.id, p.name,
           COALESCE(SUM(g.goals), 0)::int AS goals,
           COALESCE(SUM(g.assists), 0)::int AS assists,
           COUNT(g.id)::int AS appearances,
           MAX(m.match_date) AS last_goal_date
    FROM players p
    LEFT JOIN goals g  ON g.player_id = p.id
    LEFT JOIN matches m ON m.id = g.match_id AND g.goals > 0
    GROUP BY p.id
    ORDER BY goals DESC, assists DESC, p.name ASC
  `;
  res.json(rows);
});

app.get('/api/stats/attendance', async (_req, res) => {
  const rows = await sql`
    SELECT p.id, p.name,
           COUNT(a.id)::int AS total,
           SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END)::int AS lates,
           SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)::int AS absences,
           SUM(CASE WHEN a.status IN ('present','registered','late') THEN 1 ELSE 0 END)::int AS shows,
           MAX(CASE WHEN a.status IN ('present','registered','late') THEN m.match_date END) AS last_match_date
    FROM players p
    LEFT JOIN attendances a ON a.player_id = p.id
    LEFT JOIN matches m     ON m.id = a.match_id
    GROUP BY p.id
    ORDER BY shows DESC, lates ASC, p.name ASC
  `;
  res.json(rows);
});

app.get('/api/stats/season', async (_req, res) => {
  try {
    const [{ first, last, total }] = await sql`
      SELECT MIN(match_date) AS first, MAX(match_date) AS last, COUNT(*)::int AS total
      FROM matches WHERE status = 'done'
    `;
    res.json({ first, last, total });
  } catch { res.json({ first: null, last: null, total: 0 }); }
});

// Fines / caisse
app.get('/api/fines', requireAdmin, async (_req, res) => {
  const rows = await sql`
    SELECT f.*, p.name FROM fines f JOIN players p ON p.id = f.player_id
    ORDER BY f.created_at DESC
  `;
  res.json(rows);
});

app.post('/api/fines/:id/pay', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = await sql`UPDATE fines SET paid = TRUE WHERE id = ${id} RETURNING *`;
  res.json(rows[0]);
});

app.post('/api/fines', requireAdmin, async (req, res) => {
  const { playerId, reason, amount } = req.body;
  const rows = await sql`
    INSERT INTO fines (player_id, reason, amount) VALUES (${playerId}, ${reason}, ${amount})
    RETURNING *
  `;
  res.json(rows[0]);
});

app.get('/api/expenses', requireAdmin, async (_req, res) => {
  res.json(await sql`SELECT * FROM expenses ORDER BY created_at DESC`);
});

app.post('/api/expenses', requireAdmin, async (req, res) => {
  const { reason, amount } = req.body;
  const rows = await sql`INSERT INTO expenses (reason, amount) VALUES (${reason}, ${amount}) RETURNING *`;
  res.json(rows[0]);
});

app.get('/api/caisse', requireAdmin, async (_req, res) => {
  const [{ paid_fines }] = await sql`SELECT COALESCE(SUM(amount),0)::float AS paid_fines FROM fines WHERE paid = TRUE`;
  const [{ due_fines }]  = await sql`SELECT COALESCE(SUM(amount),0)::float AS due_fines  FROM fines WHERE paid = FALSE`;
  const [{ expenses }]   = await sql`SELECT COALESCE(SUM(amount),0)::float AS expenses   FROM expenses`;
  res.json({ paid_fines, due_fines, expenses, balance: paid_fines - expenses });
});

// ========================================================
// ANNOUNCEMENTS — annonces publiées par l'admin
// ========================================================
app.get('/api/announcements', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT id, title, body, pinned, created_at
      FROM announcements
      ORDER BY pinned DESC, created_at DESC
      LIMIT 20
    `;
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/announcements', requireAdmin, async (req, res) => {
  const { title, body, pinned = false } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Texte requis' });
  
  try {
    const rows = await sql`
      INSERT INTO announcements (title, body, pinned)
      VALUES (${title?.trim() || null}, ${body.trim()}, ${!!pinned})
      RETURNING id, title, body, pinned, created_at
    `;
    res.json(rows[0]);
  } catch (e) {
    console.error("Erreur d'ajout de l'annonce:", e);
    res.status(500).json({ error: "Erreur serveur : " + e.message });
  }
});

app.patch('/api/announcements/:id', requireAdmin, async (req, res) => {
  const { title, body, pinned } = req.body;
  try {
    if (title !== undefined) await sql`UPDATE announcements SET title = ${title?.trim() || null} WHERE id = ${req.params.id}`;
    if (body !== undefined)  await sql`UPDATE announcements SET body  = ${body?.trim()    || ''}   WHERE id = ${req.params.id}`;
    if (pinned !== undefined) await sql`UPDATE announcements SET pinned = ${!!pinned}             WHERE id = ${req.params.id}`;
    const [row] = await sql`SELECT id, title, body, pinned, created_at FROM announcements WHERE id = ${req.params.id}`;
    res.json(row);
  } catch (e) {
    console.error("Erreur mise à jour annonce:", e);
    res.status(500).json({ error: "Erreur serveur : " + e.message });
  }
});

app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  await sql`DELETE FROM announcements WHERE id = ${req.params.id}`;
  res.json({ ok: true });
});

// ========================================================
// MAN OF THE MATCH — vote du joueur du jour
// ========================================================
app.post('/api/motm/vote', async (req, res) => {
  const { matchId, voterId, votedId } = req.body;
  if (!matchId || !voterId || !votedId) {
    return res.status(400).json({ error: 'matchId, voterId et votedId requis' });
  }
  if (Number(voterId) === Number(votedId)) {
    return res.status(400).json({ error: 'Tu ne peux pas voter pour toi-même' });
  }
  try {
    await sql`
      INSERT INTO motm_votes (match_id, voter_id, voted_id)
      VALUES (${matchId}, ${voterId}, ${votedId})
      ON CONFLICT (match_id, voter_id)
      DO UPDATE SET voted_id = EXCLUDED.voted_id, created_at = NOW()
    `;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/motm/:matchId', async (req, res) => {
  try {
    const rows = await sql`
      SELECT p.id, p.name, COUNT(v.id)::int AS votes
      FROM motm_votes v
      JOIN players p ON p.id = v.voted_id
      WHERE v.match_id = ${req.params.matchId}
      GROUP BY p.id, p.name
      ORDER BY votes DESC, p.name ASC
      LIMIT 10
    `;
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/motm/me/:matchId/:voterId', async (req, res) => {
  try {
    const [row] = await sql`
      SELECT voted_id FROM motm_votes
      WHERE match_id = ${req.params.matchId} AND voter_id = ${req.params.voterId}
    `;
    res.json(row || null);
  } catch {
    res.json(null);
  }
});

app.get('/api/motm/last', async (_req, res) => {
  try {
    const last = await sql`SELECT id, match_date FROM matches WHERE status = 'done' ORDER BY match_date DESC LIMIT 1`;
    if (!last.length) return res.json(null);
    const rows = await sql`
      SELECT p.id, p.name, COUNT(v.id)::int AS votes
      FROM motm_votes v
      JOIN players p ON p.id = v.voted_id
      WHERE v.match_id = ${last[0].id}
      GROUP BY p.id, p.name
      ORDER BY votes DESC LIMIT 5
    `;
    res.json({ matchId: last[0].id, matchDate: last[0].match_date, results: rows });
  } catch {
    res.json(null);
  }
});

// ========================================================
// HISTORIQUE DES MATCHS 
// ========================================================
app.get('/api/match/history', async (_req, res) => {
  try {
    const matches = await sql`
      SELECT id, match_date, team_a_score, team_b_score, photo_url, winner_team
      FROM matches
      WHERE status = 'done' AND team_a_score IS NOT NULL AND team_b_score IS NOT NULL
      ORDER BY match_date DESC
      LIMIT 30
    `;
    if (!matches.length) return res.json([]);
    const ids = matches.map(m => m.id);
    const goals = await sql`
      SELECT g.match_id, g.player_id, g.goals, g.assists, p.name
      FROM goals g JOIN players p ON p.id = g.player_id
      WHERE g.match_id = ANY(${ids}) AND g.goals > 0
      ORDER BY g.goals DESC
    `;
    const byMatch = goals.reduce((acc, g) => {
      (acc[g.match_id] ||= []).push(g);
      return acc;
    }, {});
    res.json(matches.map(m => ({ ...m, scorers: byMatch[m.id] || [] })));
  } catch (e) {
    console.error('history error', e);
    res.json([]);
  }
});

// ========================================================
// PLANNING — calendrier admin
// ========================================================
app.get('/api/match/calendar', requireAdmin, async (_req, res) => {
  const rows = await sql`
    SELECT id, match_date, kickoff_local, status, notes,
           team_a_score, team_b_score, photo_url, winner_team
    FROM matches
    ORDER BY match_date DESC
    LIMIT 60
  `;
  res.json(rows);
});

app.post('/api/match/schedule', requireAdmin, async (req, res) => {
  const { date, kickoff = '10:00', notes = null } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Date invalide (YYYY-MM-DD requis)' });
  }
  try {
    const existing = await sql`SELECT * FROM matches WHERE match_date = ${date} LIMIT 1`;
    if (existing.length) return res.json({ ...existing[0], created: false });
    const created = await sql`
      INSERT INTO matches (match_date, kickoff_local, notes)
      VALUES (${date}, ${kickoff}, ${notes})
      RETURNING *
    `;
    res.json({ ...created[0], created: true });
  } catch (e) {
    console.error('schedule error', e);
    res.status(500).json({ error: 'Erreur planification' });
  }
});

app.delete('/api/match/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [m] = await sql`SELECT status FROM matches WHERE id = ${id}`;
    if (!m) return res.status(404).json({ error: 'Match introuvable' });
    if (m.status === 'done') return res.status(400).json({ error: 'Match terminé, suppression interdite' });
    await sql`DELETE FROM matches WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========================================================
// PHOTO + ÉQUIPE GAGNANTE
// ========================================================
app.patch('/api/match/:id/photo', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { photoUrl = null, winnerTeam = null } = req.body || {};
  
  if (winnerTeam && !['A','B','draw'].includes(winnerTeam)) {
    return res.status(400).json({ error: 'winnerTeam doit être A, B ou draw' });
  }
  
  // NOUVEAU : On autorise "http" ET "data:image" (l'upload direct depuis la galerie)
  if (photoUrl && !/^https?:\/\//i.test(photoUrl) && !/^data:image\//i.test(photoUrl)) {
    return res.status(400).json({ error: 'Format de photo invalide' });
  }
  
  try {
    const rows = await sql`
      UPDATE matches
      SET photo_url   = ${photoUrl},
          winner_team = ${winnerTeam}
      WHERE id = ${id}
      RETURNING id, match_date, team_a_score, team_b_score, photo_url, winner_team
    `;
    if (!rows.length) return res.status(404).json({ error: 'Match introuvable' });
    res.json(rows[0]);
  } catch (e) {
    console.error('photo error', e);
    res.status(500).json({ error: 'Erreur enregistrement photo' });
  }
});

app.get('/api/match/gallery', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT id, match_date, team_a_score, team_b_score, photo_url, winner_team
      FROM matches
      WHERE photo_url IS NOT NULL AND photo_url <> ''
      ORDER BY match_date DESC
      LIMIT 12
    `;
    res.json(rows);
  } catch { res.json([]); }
});

// ========================================================
// CONSENT 
// ========================================================
const crypto = require('crypto');
app.post('/api/consent', async (req, res) => {
  const { kind = 'cookies', granted = true, playerId = null } = req.body || {};
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  const ipHash = ip ? crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'camas')).digest('hex').slice(0, 24) : null;
  const ua = (req.headers['user-agent'] || '').toString().slice(0, 200);
  try {
    await sql`
      INSERT INTO consents (player_id, ip_hash, user_agent, consent_kind, granted)
      VALUES (${playerId}, ${ipHash}, ${ua}, ${kind}, ${!!granted})
    `;
  } catch { /* table éventuellement absente */ }
  res.json({ ok: true });
});

// ========================================================
// PLAYER PROFILE 
// ========================================================
app.get('/api/players/:id/profile', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const [player] = await sql`SELECT id, name, rating FROM players WHERE id = ${id}`;
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const [g] = await sql`
      SELECT COALESCE(SUM(goals),0)::int AS goals,
             COALESCE(SUM(assists),0)::int AS assists,
             COUNT(*)::int AS scoring_apps
      FROM goals WHERE player_id = ${id}
    `;
    const [att] = await sql`
      SELECT COUNT(*)::int AS total,
             SUM(CASE WHEN is_late THEN 1 ELSE 0 END)::int AS lates,
             SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::int AS absences,
             SUM(CASE WHEN status IN ('present','registered','late') THEN 1 ELSE 0 END)::int AS shows
      FROM attendances WHERE player_id = ${id}
    `;
    const [{ total_matches }] = await sql`SELECT COUNT(*)::int AS total_matches FROM matches WHERE status = 'done'`;

    let motmWins = 0;
    try {
      const wins = await sql`
        WITH ranked AS (
          SELECT match_id, voted_id, COUNT(*)::int AS votes,
                 RANK() OVER (PARTITION BY match_id ORDER BY COUNT(*) DESC) AS r
          FROM motm_votes GROUP BY match_id, voted_id
        )
        SELECT COUNT(*)::int AS wins FROM ranked WHERE r = 1 AND voted_id = ${id}
      `;
      motmWins = wins[0]?.wins || 0;
    } catch { /* table peut être absente */ }

    let dueAmount = 0;
    try {
      const [d] = await sql`SELECT COALESCE(SUM(amount),0)::float AS due FROM fines WHERE player_id = ${id} AND paid = false`;
      dueAmount = Number(d?.due || 0);
    } catch { /* ignore */ }

    const presenceRatio = total_matches > 0 ? Math.round((att.shows / total_matches) * 100) : 0;
    const punctuality = att.shows > 0 ? Math.round(((att.shows - att.lates) / att.shows) * 100) : 0;

    res.json({
      id: player.id, name: player.name, rating: Number(player.rating),
      goals: g.goals, assists: g.assists,
      shows: att.shows || 0, lates: att.lates || 0, absences: att.absences || 0,
      total_matches: total_matches || 0,
      presence_ratio: presenceRatio,
      punctuality,
      motm_wins: motmWins,
      due_amount: dueAmount,
    });
  } catch (e) {
    console.error('profile error', e);
    res.status(500).json({ error: 'Internal' });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`🔥 Backend CAMAS sur http://localhost:${port}`));
}

module.exports = app;