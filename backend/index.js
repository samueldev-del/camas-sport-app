const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const app = express();
const port = process.env.PORT || 3000;
const TZ = 'Europe/Berlin';
const LATE_FINE_EUR = 2.0;
const PER_TEAM = 11; // format unique : 11 vs 11
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function resolveAuthSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;

  // Keep player sessions valid across server restarts when AUTH_SECRET is not set.
  return crypto
    .createHash('sha256')
    .update(process.env.DATABASE_URL || 'camas-sport-auth-secret')
    .digest('hex');
}

const AUTH_SECRET = resolveAuthSecret();

app.use(cors());
app.use(express.json({ limit: '4mb' }));

const sql = neon(process.env.DATABASE_URL);

// ---------- admin auth (code partagé, PIN ou mot de passe d'un joueur admin) ----------
const ADMIN_SHARED_CREDENTIALS = [
  process.env.ADMIN_CODE,
  process.env.ADMIN_PASSWORD,
  process.env.ADMIN_PIN,
  process.env.ADMIN_PASS,
  process.env.ADMIN_SECRET,
]
  .map((value) => (typeof value === 'string' ? value.trim() : ''))
  .filter(Boolean);

function hasSharedAdminCredentialConfigured() {
  return ADMIN_SHARED_CREDENTIALS.length > 0;
}

async function hasAdminPinConfigured() {
  try {
    const rows = await sql`
      SELECT 1
      FROM players
      WHERE is_admin = TRUE AND COALESCE(pin, '') <> ''
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function hasAdminPasswordConfigured() {
  try {
    const rows = await sql`
      SELECT 1
      FROM players
      WHERE is_admin = TRUE AND COALESCE(password_hash, '') <> ''
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function isValidAdminCredential(provided) {
  if (!provided) return false;
  if (ADMIN_SHARED_CREDENTIALS.includes(provided)) return true;
  try {
    const rows = await sql`
      SELECT 1
      FROM players
      WHERE is_admin = TRUE AND pin = ${provided}
      LIMIT 1
    `;
    if (rows.length > 0) return true;
    return await adminPasswordMatches(provided);
  } catch {
    return false;
  }
}

async function requireAdmin(req, res, next) {
  const provided = typeof req.headers['x-admin-code'] === 'string'
    ? req.headers['x-admin-code'].trim()
    : '';

  try {
    const hasConfiguredAdmin = hasSharedAdminCredentialConfigured() || await hasAdminPinConfigured() || await hasAdminPasswordConfigured();
    if (!hasConfiguredAdmin) {
      return res.status(503).json({ error: 'Aucun accès admin configuré côté serveur' });
    }
    if (!(await isValidAdminCredential(provided))) {
      return res.status(401).json({ error: 'Accès refusé — code, PIN ou mot de passe admin invalide' });
    }
    next();
  } catch (error) {
    console.error('admin auth error:', error);
    res.status(500).json({ error: 'Erreur de vérification admin' });
  }
}

// Endpoint de vérification du code admin (le frontend l'appelle au login)
app.post('/api/admin/check', async (req, res) => {
  const code = typeof req.body?.code === 'string'
    ? req.body.code.trim()
    : typeof req.headers['x-admin-code'] === 'string'
      ? req.headers['x-admin-code'].trim()
      : '';

  const hasConfiguredAdmin = hasSharedAdminCredentialConfigured() || await hasAdminPinConfigured() || await hasAdminPasswordConfigured();
  if (!hasConfiguredAdmin) return res.status(503).json({ ok: false, error: 'Aucun accès admin configuré' });
  if (!(await isValidAdminCredential(code))) return res.status(401).json({ ok: false, error: 'Code, PIN ou mot de passe admin invalide' });
  res.json({ ok: true });
});

function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

function normalizePhone(value = '') {
  return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[+]?[0-9]{6,20}$/.test(value);
}

function normalizeAvatarUrl(value = '') {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  if (trimmed.length > 1_500_000) {
    throw new Error('Photo de profil trop lourde');
  }

  const isDataImage = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(trimmed);
  const isRemoteImage = /^https?:\/\/\S+$/i.test(trimmed);
  if (!isDataImage && !isRemoteImage) {
    throw new Error('Format de photo invalide');
  }

  return trimmed;
}

function computeAgeFromBirthDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  const today = new Date();
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();

  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) {
    age -= 1;
  }
  return age;
}

function normalizeBirthDate(value = '') {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    throw new Error('Date de naissance invalide');
  }

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  const isValidDate = !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day);

  if (!isValidDate) {
    throw new Error('Date de naissance invalide');
  }

  const computedAge = computeAgeFromBirthDate(iso);
  if (computedAge < 10 || computedAge > 99) {
    throw new Error('Date de naissance invalide');
  }

  return iso;
}

function formatBirthDate(value = null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, storedHash = '') {
  const [salt, expectedDigest] = storedHash.split(':');
  if (!salt || !expectedDigest) return false;
  const actualDigest = crypto.scryptSync(password, salt, 64).toString('hex');
  const expected = Buffer.from(expectedDigest, 'hex');
  const actual = Buffer.from(actualDigest, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function adminPasswordMatches(password) {
  if (!password) return false;
  try {
    const rows = await sql`
      SELECT password_hash
      FROM players
      WHERE is_admin = TRUE AND COALESCE(password_hash, '') <> ''
    `;
    return rows.some((row) => verifyPassword(password, row.password_hash));
  } catch {
    return false;
  }
}

function signToken(playerId) {
  const payload = {
    sub: playerId,
    exp: Date.now() + AUTH_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token = '') {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readAuthToken(req) {
  const rawHeader = typeof req.headers.authorization === 'string'
    ? req.headers.authorization.trim()
    : '';
  if (!rawHeader.startsWith('Bearer ')) return '';
  return rawHeader.slice(7).trim();
}

function serializePlayerAccount(player) {
  return {
    id: player.id,
    name: player.name,
    pronoun: player.pronoun,
    birthDate: formatBirthDate(player.birth_date),
    age: player.age,
    email: player.email,
    phone: player.phone,
    avatarUrl: player.avatar_url || null,
    rating: player.rating,
    isAdmin: !!player.is_admin,
  };
}

async function requirePlayerAuth(req, res, next) {
  const token = readAuthToken(req);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Session joueur invalide ou expirée' });

  try {
    const [player] = await sql`
      SELECT id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin, password_hash
      FROM players
      WHERE id = ${payload.sub}
      LIMIT 1
    `;
    if (!player?.password_hash) {
      return res.status(401).json({ error: 'Compte joueur introuvable' });
    }
    req.player = serializePlayerAccount(player);
    next();
  } catch (error) {
    console.error('player auth error:', error);
    res.status(500).json({ error: 'Erreur de vérification joueur' });
  }
}

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

function todayBerlinParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  return {
    year: Number(parts.find(part => part.type === 'year')?.value || 0),
    month: Number(parts.find(part => part.type === 'month')?.value || 0),
    day: Number(parts.find(part => part.type === 'day')?.value || 0),
  };
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function birthdayOccurrenceForYear(month, day, year) {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return new Date(Date.UTC(year, 1, 28));
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function upcomingBirthdayInfo(value, today = todayBerlinParts()) {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;

  const todayDate = new Date(Date.UTC(today.year, today.month - 1, today.day));
  let occurrenceYear = today.year;
  let occurrence = birthdayOccurrenceForYear(month, day, occurrenceYear);

  if (occurrence < todayDate) {
    occurrenceYear += 1;
    occurrence = birthdayOccurrenceForYear(month, day, occurrenceYear);
  }

  const daysUntil = Math.round((occurrence - todayDate) / 86400000);
  return {
    nextOccurrence: occurrence.toISOString().slice(0, 10),
    daysUntil,
    turnsAge: occurrenceYear - year,
  };
}

async function getOrCreateCurrentMatch() {
  await matchSchemaBootstrap;
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

async function ensureInventoryTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity_total INT NOT NULL DEFAULT 0 CHECK (quantity_total >= 0),
        quantity_ready INT NOT NULL DEFAULT 0 CHECK (quantity_ready >= 0 AND quantity_ready <= quantity_total),
        storage_location TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (category, name)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_inventory_items_category_name
      ON inventory_items(category, name)
    `;
    await sql`
      INSERT INTO inventory_items (category, name, quantity_total, quantity_ready, storage_location, notes)
      SELECT category, name, quantity_total, quantity_ready, storage_location, notes
      FROM (
        VALUES
          ('Ballons', 'Ballons de match', 12, 10, 'Armoire principale', 'Verifier la pression avant chaque dimanche'),
          ('Chasubles', 'Chasubles vertes', 18, 16, 'Sac textile A', 'Lot principal pour Team A'),
          ('Chasubles', 'Chasubles rouges', 18, 17, 'Sac textile B', 'Lot principal pour Team B'),
          ('Cones', 'Coupelles d''echauffement', 40, 35, 'Caisse terrain', 'Pour ateliers et delimitation'),
          ('Arbitrage', 'Sifflets', 3, 3, 'Boite coach', 'Un reserve inclus'),
          ('Entretien', 'Pompes + aiguilles', 2, 2, 'Armoire principale', 'Controle hebdomadaire recommande'),
          ('Sante', 'Trousse de secours', 1, 1, 'Sac medical', 'Verifier le reapprovisionnement mensuel'),
          ('Recuperation', 'Glaciere + poches de glace', 1, 1, 'Local materiel', 'Utilise pour les petits bobos')
      ) AS seed(category, name, quantity_total, quantity_ready, storage_location, notes)
      WHERE NOT EXISTS (SELECT 1 FROM inventory_items)
    `;
  } catch (error) {
    console.error('inventory bootstrap error:', error);
  }
}

async function ensurePlayerAccountSchema() {
  try {
    await sql`ALTER TABLE players ALTER COLUMN pin DROP NOT NULL`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS pronoun TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS age INT CHECK (age IS NULL OR age BETWEEN 10 AND 99)`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_date DATE`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS password_hash TEXT`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email_unique ON players (LOWER(email)) WHERE email IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_phone_unique ON players (phone) WHERE phone IS NOT NULL`;
  } catch (error) {
    console.error('player account bootstrap error:', error);
  }
}

async function ensureAttendanceSchema() {
  try {
    await sql`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS position TEXT`;
    await sql`ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_position_check`;
    await sql`
      ALTER TABLE attendances
      ADD CONSTRAINT attendances_position_check
      CHECK (position IS NULL OR position IN ('G','DEF','MIL','ATT'))
    `;
  } catch (error) {
    console.error('attendance bootstrap error:', error);
  }
}

async function ensureMatchSchema() {
  try {
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS kickoff_local TIME NOT NULL DEFAULT '10:00'`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS notes TEXT`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_score INT`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_score INT`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS photo_url TEXT`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team TEXT`;
    await sql`ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_team_check`;
    await sql`
      ALTER TABLE matches
      ADD CONSTRAINT matches_winner_team_check
      CHECK (winner_team IS NULL OR winner_team IN ('A','B','draw'))
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_matches_done_date ON matches(match_date DESC) WHERE status = 'done'`;
  } catch (error) {
    console.error('match schema bootstrap error:', error);
  }
}

const playerAccountsBootstrap = ensurePlayerAccountSchema();
const attendanceBootstrap = ensureAttendanceSchema();
const inventoryBootstrap = ensureInventoryTable();
const matchSchemaBootstrap = ensureMatchSchema();

// ---------- routes ----------
app.get('/', (_req, res) => res.send('⚽ CAMAS Sport API'));

app.post('/api/auth/register', async (req, res) => {
  await playerAccountsBootstrap;

  const {
    name = '', pronoun = '', birthDate = '',
    email = '', phone = '',
    avatarUrl = '',
    password = '', passwordConfirm = '',
  } = req.body || {};

  const cleanName = name.trim();
  const cleanPronoun = pronoun.trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  let cleanAvatarUrl;
  let cleanBirthDate;

  try {
    cleanAvatarUrl = normalizeAvatarUrl(avatarUrl);
    cleanBirthDate = normalizeBirthDate(birthDate);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!cleanName || !cleanPronoun || !cleanBirthDate || !cleanEmail || !cleanPhone || !password || !passwordConfirm) {
    return res.status(400).json({ error: 'Tous les champs du compte sont requis' });
  }
  if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Adresse email invalide' });
  if (!isValidPhone(cleanPhone)) return res.status(400).json({ error: 'Numéro de téléphone invalide' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  if (password !== passwordConfirm) return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });

  try {
    const emailConflict = await sql`
      SELECT id FROM players
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `;
    if (emailConflict.length) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const phoneConflict = await sql`
      SELECT id FROM players
      WHERE phone = ${cleanPhone}
      LIMIT 1
    `;
    if (phoneConflict.length) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });

    const passwordHash = hashPassword(password);
    const existingByName = await sql`
      SELECT id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin, password_hash
      FROM players
      WHERE LOWER(name) = LOWER(${cleanName})
      LIMIT 1
    `;

    let rows;
    if (existingByName.length) {
      if (existingByName[0].password_hash) {
        return res.status(409).json({ error: 'Un compte existe déjà pour ce joueur' });
      }
      rows = await sql`
        UPDATE players
        SET pronoun = ${cleanPronoun},
            birth_date = ${cleanBirthDate},
            age = NULL,
            email = ${cleanEmail},
            phone = ${cleanPhone},
            avatar_url = ${cleanAvatarUrl},
            password_hash = ${passwordHash}
        WHERE id = ${existingByName[0].id}
        RETURNING id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin
      `;
    } else {
      rows = await sql`
        INSERT INTO players (name, pronoun, birth_date, email, phone, avatar_url, password_hash, rating)
        VALUES (${cleanName}, ${cleanPronoun}, ${cleanBirthDate}, ${cleanEmail}, ${cleanPhone}, ${cleanAvatarUrl}, ${passwordHash}, 5.0)
        RETURNING id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin
      `;
    }

    const user = serializePlayerAccount(rows[0]);
    res.status(201).json({ user, token: signToken(user.id) });
  } catch (error) {
    console.error('register error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  await playerAccountsBootstrap;

  const { identifier = '', password = '' } = req.body || {};
  const cleanIdentifier = identifier.trim();
  const emailCandidate = normalizeEmail(cleanIdentifier);
  const phoneCandidate = normalizePhone(cleanIdentifier);

  if (!cleanIdentifier || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  try {
    const rows = await sql`
      SELECT id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin, password_hash
      FROM players
      WHERE LOWER(email) = ${emailCandidate} OR phone = ${phoneCandidate}
      LIMIT 1
    `;
    const player = rows[0];
    if (!player?.password_hash || !verifyPassword(password, player.password_hash)) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = serializePlayerAccount(player);
    res.json({ user, token: signToken(user.id) });
  } catch (error) {
    console.error('login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

app.get('/api/auth/me', requirePlayerAuth, async (req, res) => {
  res.json({ user: req.player });
});

app.patch('/api/auth/me', requirePlayerAuth, async (req, res) => {
  await playerAccountsBootstrap;

  const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl');
  let cleanAvatarUrl;
  let cleanBirthDate;
  try {
    if (hasAvatarUpdate) {
      cleanAvatarUrl = normalizeAvatarUrl(req.body?.avatarUrl);
    }
    if (req.body?.birthDate !== undefined) {
      cleanBirthDate = normalizeBirthDate(req.body.birthDate);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const [current] = await sql`
      SELECT id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin
      FROM players
      WHERE id = ${req.player.id}
      LIMIT 1
    `;
    if (!current) return res.status(404).json({ error: 'Compte joueur introuvable' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : current.name;
    const pronoun = req.body?.pronoun !== undefined ? String(req.body.pronoun).trim() : current.pronoun;
    const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : current.email;
    const phone = req.body?.phone !== undefined ? normalizePhone(req.body.phone) : current.phone;
    const birthDate = req.body?.birthDate !== undefined ? cleanBirthDate : current.birth_date;
    const avatarUrl = hasAvatarUpdate ? cleanAvatarUrl : current.avatar_url;

    if (!name || !pronoun || !birthDate || !email || !phone) {
      return res.status(400).json({ error: 'Tous les champs du profil sont requis' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Adresse email invalide' });
    if (!isValidPhone(phone)) return res.status(400).json({ error: 'Numéro de téléphone invalide' });

    const [nameConflict] = await sql`
      SELECT id FROM players
      WHERE LOWER(name) = LOWER(${name}) AND id <> ${req.player.id}
      LIMIT 1
    `;
    if (nameConflict) return res.status(409).json({ error: 'Ce nom est déjà utilisé' });

    const [emailConflict] = await sql`
      SELECT id FROM players
      WHERE LOWER(email) = ${email} AND id <> ${req.player.id}
      LIMIT 1
    `;
    if (emailConflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const [phoneConflict] = await sql`
      SELECT id FROM players
      WHERE phone = ${phone} AND id <> ${req.player.id}
      LIMIT 1
    `;
    if (phoneConflict) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });

    const rows = await sql`
      UPDATE players
      SET name = ${name},
          pronoun = ${pronoun},
          birth_date = ${birthDate},
          age = NULL,
          email = ${email},
          phone = ${phone},
          avatar_url = ${avatarUrl}
      WHERE id = ${req.player.id}
      RETURNING id, name, pronoun, birth_date, age, email, phone, avatar_url, rating, is_admin
    `;
    res.json({ user: serializePlayerAccount(rows[0]) });
  } catch (error) {
    console.error('profile update error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// Players
app.get('/api/players', async (_req, res) => {
  await playerAccountsBootstrap;
  const rows = await sql`
    SELECT id, name, rating, avatar_url AS "avatarUrl"
    FROM players
    ORDER BY name
  `;
  res.json(rows);
});

app.get('/api/birthdays/today', async (_req, res) => {
  const { month, day } = todayBerlinParts();

  try {
    const rows = await sql`
      SELECT id, name, birth_date
      FROM players
      WHERE birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = ${month}
        AND EXTRACT(DAY FROM birth_date) = ${day}
      ORDER BY name ASC
    `;

    res.json(rows.map((player) => ({
      id: player.id,
      name: player.name,
      birthDate: formatBirthDate(player.birth_date),
      age: computeAgeFromBirthDate(player.birth_date),
    })));
  } catch (error) {
    console.error('birthdays today error:', error);
    res.status(500).json({ error: 'Erreur lecture anniversaires' });
  }
});

app.get('/api/birthdays/upcoming', requireAdmin, async (_req, res) => {
  try {
    const rows = await sql`
      SELECT id, name, birth_date
      FROM players
      WHERE birth_date IS NOT NULL
      ORDER BY name ASC
    `;

    const upcoming = rows
      .map((player) => {
        const info = upcomingBirthdayInfo(player.birth_date);
        if (!info || info.daysUntil < 0 || info.daysUntil > 7) return null;
        return {
          id: player.id,
          name: player.name,
          birthDate: formatBirthDate(player.birth_date),
          nextOccurrence: info.nextOccurrence,
          daysUntil: info.daysUntil,
          turnsAge: info.turnsAge,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.daysUntil - right.daysUntil || left.name.localeCompare(right.name));

    res.json(upcoming);
  } catch (error) {
    console.error('birthdays upcoming error:', error);
    res.status(500).json({ error: 'Erreur lecture anniversaires à venir' });
  }
});

app.post('/api/players', async (req, res) => {
  const { name, rating = 5.0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const rows = await sql`
      INSERT INTO players (name, rating)
      VALUES (${name.trim()}, ${rating})
      RETURNING id, name, rating
    `;
    res.json(rows[0]);
  } catch (e) {
    if (e.message.includes('unique')) return res.status(409).json({ error: 'Ce nom est déjà utilisé' });
    res.status(500).json({ error: 'Erreur création joueur' });
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
app.post('/api/vote', requirePlayerAuth, async (req, res) => {
  await attendanceBootstrap;
  const { playerId: rawPlayerId, position, intent = 'yes' } = req.body || {};
  const playerId = req.player.id;
  if (rawPlayerId && Number(rawPlayerId) !== Number(playerId)) {
    return res.status(403).json({ error: 'Tu ne peux modifier que ta propre présence' });
  }
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
  await attendanceBootstrap;
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
app.delete('/api/vote', requirePlayerAuth, async (req, res) => {
  const { matchId } = req.body || {};
  const playerId = req.player.id;
  if (!matchId) return res.status(400).json({ error: 'Match requis' });
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
  await matchSchemaBootstrap;
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
  await matchSchemaBootstrap;
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
// INVENTAIRE MATERIEL
// ========================================================
app.get('/api/inventory', requireAdmin, async (_req, res) => {
  try {
    await inventoryBootstrap;
    const rows = await sql`
      SELECT *
      FROM inventory_items
      ORDER BY category ASC, name ASC
    `;
    res.json(rows);
  } catch (error) {
    console.error('inventory list error:', error);
    res.status(500).json({ error: 'Erreur lecture inventaire' });
  }
});

app.post('/api/inventory', requireAdmin, async (req, res) => {
  const category = (req.body?.category || '').toString().trim();
  const name = (req.body?.name || '').toString().trim();
  const quantityTotal = Number.parseInt(req.body?.quantityTotal ?? 0, 10);
  const quantityReady = Number.parseInt(req.body?.quantityReady ?? quantityTotal, 10);
  const storageLocation = (req.body?.storageLocation || '').toString().trim() || null;
  const notes = (req.body?.notes || '').toString().trim() || null;

  if (!category || !name) {
    return res.status(400).json({ error: 'Categorie et nom requis' });
  }
  if (!Number.isInteger(quantityTotal) || !Number.isInteger(quantityReady) || quantityTotal < 0 || quantityReady < 0 || quantityReady > quantityTotal) {
    return res.status(400).json({ error: 'Quantites invalides' });
  }

  try {
    await inventoryBootstrap;
    const rows = await sql`
      INSERT INTO inventory_items (category, name, quantity_total, quantity_ready, storage_location, notes)
      VALUES (${category}, ${name}, ${quantityTotal}, ${quantityReady}, ${storageLocation}, ${notes})
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (error) {
    console.error('inventory create error:', error);
    if (error.message.includes('unique')) {
      return res.status(409).json({ error: 'Cet element existe deja dans l\'inventaire' });
    }
    res.status(500).json({ error: 'Erreur ajout inventaire' });
  }
});

app.patch('/api/inventory/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  try {
    await inventoryBootstrap;
    const [current] = await sql`SELECT * FROM inventory_items WHERE id = ${id}`;
    if (!current) return res.status(404).json({ error: 'Element introuvable' });

    const category = req.body?.category !== undefined ? req.body.category.toString().trim() : current.category;
    const name = req.body?.name !== undefined ? req.body.name.toString().trim() : current.name;
    const quantityTotal = req.body?.quantityTotal !== undefined ? Number.parseInt(req.body.quantityTotal, 10) : current.quantity_total;
    const quantityReady = req.body?.quantityReady !== undefined ? Number.parseInt(req.body.quantityReady, 10) : current.quantity_ready;
    const storageLocation = req.body?.storageLocation !== undefined
      ? (req.body.storageLocation || '').toString().trim() || null
      : current.storage_location;
    const notes = req.body?.notes !== undefined
      ? (req.body.notes || '').toString().trim() || null
      : current.notes;

    if (!category || !name) {
      return res.status(400).json({ error: 'Categorie et nom requis' });
    }
    if (!Number.isInteger(quantityTotal) || !Number.isInteger(quantityReady) || quantityTotal < 0 || quantityReady < 0 || quantityReady > quantityTotal) {
      return res.status(400).json({ error: 'Quantites invalides' });
    }

    const rows = await sql`
      UPDATE inventory_items
      SET category = ${category},
          name = ${name},
          quantity_total = ${quantityTotal},
          quantity_ready = ${quantityReady},
          storage_location = ${storageLocation},
          notes = ${notes},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (error) {
    console.error('inventory update error:', error);
    if (error.message.includes('unique')) {
      return res.status(409).json({ error: 'Cet element existe deja dans l\'inventaire' });
    }
    res.status(500).json({ error: 'Erreur mise a jour inventaire' });
  }
});

app.delete('/api/inventory/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    await inventoryBootstrap;
    await sql`DELETE FROM inventory_items WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (error) {
    console.error('inventory delete error:', error);
    res.status(500).json({ error: 'Erreur suppression inventaire' });
  }
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
app.post('/api/motm/vote', requirePlayerAuth, async (req, res) => {
  const { matchId, votedId } = req.body || {};
  const voterId = req.player.id;
  if (!matchId || !votedId) {
    return res.status(400).json({ error: 'matchId et votedId requis' });
  }
  if (Number(voterId) === Number(votedId)) {
    return res.status(400).json({ error: 'Tu ne peux pas voter pour toi-même' });
  }
  try {
    const allowedVoters = await sql`
      SELECT player_id
      FROM attendances
      WHERE match_id = ${matchId} AND player_id IN (${voterId}, ${votedId})
        AND status IN ('registered', 'present', 'late')
    `;
    const allowedIds = new Set(allowedVoters.map(row => Number(row.player_id)));
    if (!allowedIds.has(Number(voterId))) {
      return res.status(403).json({ error: 'Tu dois être présent pour voter' });
    }
    if (!allowedIds.has(Number(votedId))) {
      return res.status(400).json({ error: 'Le joueur choisi n’est pas éligible' });
    }

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

app.get('/api/motm/me/:matchId', requirePlayerAuth, async (req, res) => {
  try {
    const [row] = await sql`
      SELECT voted_id FROM motm_votes
      WHERE match_id = ${req.params.matchId} AND voter_id = ${req.player.id}
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
    await matchSchemaBootstrap;
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
  await matchSchemaBootstrap;
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
  await matchSchemaBootstrap;
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
  await matchSchemaBootstrap;
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
  await matchSchemaBootstrap;
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
    await matchSchemaBootstrap;
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
  Promise.all([inventoryBootstrap, playerAccountsBootstrap, attendanceBootstrap]).finally(() => {
    app.listen(port, () => console.log(`🔥 Backend CAMAS sur http://localhost:${port}`));
  });
}

module.exports = app;