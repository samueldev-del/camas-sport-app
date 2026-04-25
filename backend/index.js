const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const app = express();
const port = process.env.PORT || 3000;
const TZ = 'Europe/Berlin';
const LATE_FINE_EUR = 2.0;

app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL);

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

app.patch('/api/players/:id', async (req, res) => {
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

app.delete('/api/players/:id', async (req, res) => {
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

// Vote — confirm presence with position
app.post('/api/vote', async (req, res) => {
  const { playerId, position } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Joueur requis' });
  if (position && !['G','DEF','MIL','ATT'].includes(position)) {
    return res.status(400).json({ error: 'Poste invalide' });
  }

  const match = await getOrCreateCurrentMatch();
  const late = await isLateForMatch(match);

  try {
    const rows = await sql`
      INSERT INTO attendances (match_id, player_id, status, is_late, arrival_time, position)
      VALUES (${match.id}, ${playerId},
              ${late ? 'late' : 'registered'}, ${late}, NOW(), ${position || null})
      RETURNING *
    `;
    if (late) {
      await sql`
        INSERT INTO fines (player_id, match_id, reason, amount)
        VALUES (${playerId}, ${match.id}, 'Retard', ${LATE_FINE_EUR})
      `;
    }
    res.json({ success: true, attendance: rows[0], late });
  } catch (e) {
    if (e.message.includes('unique')) return res.status(409).json({ error: 'Déjà inscrit pour ce match' });
    res.status(500).json({ error: 'Erreur vote' });
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

// Teams (snake draft) — now with starters/subs split + positions
app.get('/api/teams/:matchId', async (req, res) => {
  const matchId = parseInt(req.params.matchId, 10);
  const rows = await sql`
    SELECT p.id, p.name, p.rating, a.position
    FROM attendances a
    JOIN players p ON p.id = a.player_id
    WHERE a.match_id = ${matchId} AND a.status <> 'absent'
    ORDER BY p.rating DESC, p.name ASC
  `;
  const count = rows.length;
  const format =
    count >= 22 ? { type: 'Grand Terrain', format: '11 vs 11', perTeam: 11 } :
    count >= 14 ? { type: 'Terrain Réduit', format: '7 vs 7',   perTeam: 7  } :
                  { type: 'Petit Goal',    format: '5 vs 5',   perTeam: 5  };

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
app.post('/api/match/:id/result', async (req, res) => {
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

// Goals
app.post('/api/goals', async (req, res) => {
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
           COUNT(g.id)::int AS appearances
    FROM players p
    LEFT JOIN goals g ON g.player_id = p.id
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
           SUM(CASE WHEN a.status IN ('present','registered','late') THEN 1 ELSE 0 END)::int AS shows
    FROM players p
    LEFT JOIN attendances a ON a.player_id = p.id
    GROUP BY p.id
    ORDER BY shows DESC, lates ASC, p.name ASC
  `;
  res.json(rows);
});

// Fines / caisse
app.get('/api/fines', async (_req, res) => {
  const rows = await sql`
    SELECT f.*, p.name FROM fines f JOIN players p ON p.id = f.player_id
    ORDER BY f.created_at DESC
  `;
  res.json(rows);
});

app.post('/api/fines/:id/pay', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = await sql`UPDATE fines SET paid = TRUE WHERE id = ${id} RETURNING *`;
  res.json(rows[0]);
});

app.post('/api/fines', async (req, res) => {
  const { playerId, reason, amount } = req.body;
  const rows = await sql`
    INSERT INTO fines (player_id, reason, amount) VALUES (${playerId}, ${reason}, ${amount})
    RETURNING *
  `;
  res.json(rows[0]);
});

app.get('/api/expenses', async (_req, res) => {
  res.json(await sql`SELECT * FROM expenses ORDER BY created_at DESC`);
});

app.post('/api/expenses', async (req, res) => {
  const { reason, amount } = req.body;
  const rows = await sql`INSERT INTO expenses (reason, amount) VALUES (${reason}, ${amount}) RETURNING *`;
  res.json(rows[0]);
});

app.get('/api/caisse', async (_req, res) => {
  const [{ paid_fines }] = await sql`SELECT COALESCE(SUM(amount),0)::float AS paid_fines FROM fines WHERE paid = TRUE`;
  const [{ due_fines }]  = await sql`SELECT COALESCE(SUM(amount),0)::float AS due_fines  FROM fines WHERE paid = FALSE`;
  const [{ expenses }]   = await sql`SELECT COALESCE(SUM(amount),0)::float AS expenses   FROM expenses`;
  res.json({ paid_fines, due_fines, expenses, balance: paid_fines - expenses });
});

// Démarre le serveur uniquement en local (pas en environnement serverless Vercel)
if (require.main === module) {
  app.listen(port, () => console.log(`🔥 Backend CAMAS sur http://localhost:${port}`));
}

module.exports = app;
