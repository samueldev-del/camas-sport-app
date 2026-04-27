import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import logoCamas from './assets/logo-camas.jpeg';
import {
  api,
  getAdminCode,
  setAdminCode,
  clearAdminCode,
  getPlayerToken,
  setPlayerToken,
  clearPlayerToken,
  getStoredPlayer,
  setStoredPlayer,
  clearStoredPlayer,
} from './api';
import { t, LANGS, localeFor } from './i18n';
import './App.css';

/* ========================================================
   PLAYER CARD MODAL — Carte joueur premium (style FUT)
   Charge le profil agrégé depuis /api/players/:id/profile
   ======================================================== */

/* ========================================================
   PLAYER CARD MODAL (FUT)
   ======================================================== */
function PlayerCardModal({ player, onClose }) {
  const punct = player.shows ? Math.round(((player.shows - player.lates) / player.shows) * 100) : 0;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="fut-card-container animate-pop" onClick={e => e.stopPropagation()}>
        <div className="fut-card">
          <div className="fut-card-top">
            <div className="fut-rating">{(player.rating || 5).toFixed(1)}</div>
            <div className="fut-pos">{player.position || 'MIL'}</div>
            <div className="fut-flag">🇨🇲</div>
          </div>
          
          <div className="fut-avatar">
            {player.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="fut-name">{player.name.split(' ')[0].toUpperCase()}</div>

          <div className="fut-stats-grid">
            <div className="fut-stat"><span>{player.goals || 0}</span> BUT</div>
            <div className="fut-stat"><span>{player.assists || 0}</span> PAS</div>
            <div className="fut-stat"><span>{player.shows || 0}</span> PRS</div>
            <div className="fut-stat"><span>{punct}%</span> PCT</div>
          </div>

        </div>
        <button className="btn-close-card" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

const TABS_BASE = [
  { id: 'home',     icon: '🏠', key: 'tab_home',    adminOnly: false },
  { id: 'players',  icon: '👥', key: 'tab_players', adminOnly: false },
  { id: 'teams',    icon: '👕', key: 'tab_teams',   adminOnly: false },
  { id: 'stats',    icon: '📈', key: 'tab_stats',   adminOnly: false },
  { id: 'admin',    icon: '🛠️', key: 'tab_admin',   adminOnly: true  },
];

const POSITIONS = [
  { code: 'G',   key: 'pos_G'   },
  { code: 'DEF', key: 'pos_DEF' },
  { code: 'MIL', key: 'pos_MIL' },
  { code: 'ATT', key: 'pos_ATT' },
];

const LANG_KEY = 'camas_lang';

const fmtTime = (iso, lang) => iso
  ? new Date(iso).toLocaleTimeString(localeFor(lang), { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
  : '—';
const fmtDate = (iso, lang) => iso
  ? new Date(iso).toLocaleDateString(localeFor(lang), { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: 'long' })
  : '';
const fmtShortDate = (iso, lang) => iso
  ? new Date(iso).toLocaleDateString(localeFor(lang), { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short' })
  : '';

const DEFAULT_KICKOFF = '10:00';

function normalizeClockTime(value, fallback = DEFAULT_KICKOFF) {
  if (typeof value !== 'string') return fallback;
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function shiftClockTime(value, offsetMinutes) {
  const [hours, minutes] = normalizeClockTime(value).split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes + offsetMinutes;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const nextMinutes = String(wrapped % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

function replaceTimeToken(text, nextTime) {
  return typeof text === 'string' ? text.replace(/\b\d{2}(?:h|:)\d{2}\b/, nextTime) : text;
}

function formatShareTime(value, lang) {
  const normalized = normalizeClockTime(value);
  return lang === 'fr' ? normalized.replace(':', 'h') : normalized;
}

function formatBirthDateInput(value = '') {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [];

  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));

  return parts.join('.');
}

function isBirthDateComplete(value = '') {
  return /^\d{2}\.\d{2}\.\d{4}$/.test(value);
}

function formatBirthDateDisplay(value = '') {
  if (!value) return '—';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function initialsFromName(value = '') {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'CM';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

function buildProfileAvatar(name = '') {
  const initials = initialsFromName(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${initials}">
      <defs>
        <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#126746" />
          <stop offset="100%" stop-color="#e7ba3a" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="28" fill="url(#avatarGradient)" />
      <circle cx="48" cy="48" r="30" fill="rgba(255,255,255,0.14)" />
      <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function loadImageFromDataUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('avatar-load-failed'));
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('avatar-read-failed'));
    reader.readAsDataURL(file);
  });
}

async function compressAvatarFile(file, messages) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    throw new Error(messages.invalidType);
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(messages.tooLarge);
  }

  try {
    const source = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(source);
    const side = Math.min(image.width, image.height);
    const offsetX = (image.width - side) / 2;
    const offsetY = (image.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;

    const context = canvas.getContext('2d');
    context.drawImage(image, offsetX, offsetY, side, side, 0, 0, 320, 320);
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    throw new Error(messages.processing);
  }
}

export default function App() {
    // Fonction pour mettre à jour le match depuis l'admin (date, heure, notes)
    const onUpdateMatch = async (fields) => {
      if (!match) return;
      try {
        await api.updateMatch(match.id, fields);
        await loadHome();
        flash(tr('admin_match_updated'), 'ok');
      } catch (e) {
        flash(e.message, 'err');
      }
    };
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'fr'; } catch { return 'fr'; }
  });
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminCode());
  const [currentUser, setCurrentUser] = useState(() => getStoredPlayer());
  const [authChecked, setAuthChecked] = useState(() => !getPlayerToken());
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [tab, setTab] = useState('home');
  const [players, setPlayers] = useState([]);
  const [match, setMatch] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [lastMatch, setLastMatch] = useState(null);
  const [birthdaysToday, setBirthdaysToday] = useState([]);
  const [teams, setTeams] = useState(null);
  const [scorers, setScorers] = useState([]);
  const [attStats, setAttStats] = useState([]);
  const [matchGoals, setMatchGoals] = useState([]);
  const [fines, setFines] = useState([]);
  const [caisse, setCaisse] = useState({ paid_fines: 0, due_fines: 0, expenses: 0, balance: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const [motmResults, setMotmResults] = useState([]);
  const [motmLast, setMotmLast] = useState(null);
  // Galerie publique des photos de matchs vainqueurs (chargée côté accueil)
  const [gallery, setGallery] = useState([]);
  // Calendrier des matchs programmés (admin uniquement)
  const [calendar, setCalendar] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [legal, setLegal] = useState(null);            // 'impressum' | 'privacy' | null
  const [cookieAck, setCookieAck] = useState(() => {
    try { return localStorage.getItem('camas_cookie_ack') === '1'; } catch { return true; }
  });
  const [toast, setToast] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);

  // Carte joueur sélectionné
  const [selectedPlayerCard, setSelectedPlayerCard] = useState(null);

  // Ouvre la carte joueur (définie inline dans le rendu)

  const tr = useCallback((key, vars) => t(lang, key, vars), [lang]);
  const profileAvatarSrc = currentUser
    ? (currentUser.avatarUrl || buildProfileAvatar(currentUser.name))
    : logoCamas;

  const switchLang = (code) => {
    setLang(code);
    try { localStorage.setItem(LANG_KEY, code); } catch { /* ignore */ }
  };

  const flash = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3200);
  }, []);

  const onAdminLogin = async (code) => {
    try {
      // On force temporairement le code dans localStorage pour que api.js l'ajoute au header
      setAdminCode(code);
      await api.adminCheck(code);
      setIsAdmin(true);
      setAdminModalOpen(false);
      flash(tr('admin_ok'), 'ok');
    } catch (e) {
      clearAdminCode();
      setIsAdmin(false);
      flash(e.message || tr('invalid_admin'), 'err');
      throw e;
    }
  };

  const onAdminLogout = () => {
    clearAdminCode();
    setIsAdmin(false);
    if (tab === 'admin') setTab('home');
    flash(tr('admin_logout'), 'ok');
  };

  const openAccountPage = (messageKey = 'auth_required') => {
    if (messageKey === 'auth_go_home_prompt') {
      setTab('home');
      flash(tr(messageKey), 'warn');
      return;
    }
    setTab('account');
    if (messageKey) flash(tr(messageKey), 'warn');
  };

  const onPlayerLogout = () => {
    clearPlayerToken();
    clearStoredPlayer();
    setCurrentUser(null);
    if (tab === 'account') setTab('home');
    flash(tr('auth_logout'), 'ok');
  };

  const acceptCookies = () => {
    try { localStorage.setItem('camas_cookie_ack', '1'); } catch { /* ignore */ }
    setCookieAck(true);
    api.recordConsent('cookies', true).catch(() => { /* best effort */ });
  };

  const loadHome = async () => {
    try {
      const [m, ps, last, anns, ml, gal, birthdays] = await Promise.all([
        api.currentMatch(), api.listPlayers(), api.lastMatch(),
        api.listAnnouncements().catch(() => []),
        api.motmLast().catch(() => null),
        api.matchGallery().catch(() => []),
        api.birthdaysToday().catch(() => []),
      ]);
      setMatch(m.match); setAttendees(m.attendees); setPlayers(ps); setLastMatch(last);
      setAnnouncements(anns); setMotmLast(ml);
      setGallery(gal);
      setBirthdaysToday(Array.isArray(birthdays) ? birthdays : []);
      if (m.match?.id) {
        try { const r = await api.motmResults(m.match.id); setMotmResults(r); } catch { /* ignore */ }
      } else {
        setMotmResults([]);
      }
    } catch (e) { console.warn(e); }
  };

  const loadAdmin = async () => {
    if (!isAdmin) return;
    try {
      const [f, c, a, cal, inv] = await Promise.all([
        api.fines(), api.caisse(),
        api.listAnnouncements().catch(() => []),
        api.matchCalendar().catch(() => []),
        api.inventory().catch(() => []),
      ]);
      setFines(f); setCaisse(c); setAnnouncements(a); setCalendar(cal); setInventory(inv);
    } catch (e) { console.warn(e); }
  };

  const loadTeams = async (matchId = match?.id) => {
    if (!matchId) return;
    try {
      const [t, g] = await Promise.all([api.teams(matchId), api.matchGoals(matchId)]);
      setTeams(t); setMatchGoals(g);
    } catch (e) { console.warn(e); }
  };

  const loadStats = async () => {
    try {
      const [s, a] = await Promise.all([api.scorers(), api.attendanceStats()]);
      setScorers(s); setAttStats(a);
    } catch (e) { console.warn(e); }
  };

  const loadHomeRef = useRef(loadHome);
  const loadStatsRef = useRef(loadStats);
  const loadTeamsRef = useRef(loadTeams);
  const loadAdminRef = useRef(loadAdmin);

  useEffect(() => {
    loadHomeRef.current = loadHome;
    loadStatsRef.current = loadStats;
    loadTeamsRef.current = loadTeams;
    loadAdminRef.current = loadAdmin;
  });

  const finishPlayerSession = async (session, successKey, nextTab = 'home') => {
    setPlayerToken(session.token);
    setStoredPlayer(session.user);
    setCurrentUser(session.user);
    await Promise.all([loadHome(), loadStats()]);
    setTab(nextTab);
    flash(tr(successKey), 'ok');
  };

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) return;

    api.authMe()
      .then(({ user }) => {
        setCurrentUser(user);
        setStoredPlayer(user);
      })
      .catch(() => {
        clearPlayerToken();
        clearStoredPlayer();
        setCurrentUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHomeRef.current();
      void loadStatsRef.current();
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (tab === 'teams') void loadTeamsRef.current(match?.id);
      else if (tab === 'stats') void loadStatsRef.current();
      else if (tab === 'admin' && isAdmin) void loadAdminRef.current();
    });
  }, [tab, isAdmin, match?.id]);

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const visibleTabs = TABS_BASE; // on les affiche toutes — caisse devient verrouillée si non-admin

  return (
    <div className="app">
      <div className="tablet">
        {/* HEADER */}
        <header className="header">
          <div className="logo-circle">
            <img src={logoCamas} alt="CAMAS e.V." />
          </div>

          <div className="header-meta">
            <div className="brand-line">
              <h1 className="brand-title">{tr('app_title')}</h1>
              <span className="brand-sub">CAMAS e.V. · Stuttgart</span>
            </div>

            <nav className="top-nav mobile-bottom">
              {visibleTabs.map(tt => (
                <button
                  key={tt.id}
                  className={`nav-tab ${tab === tt.id ? 'active' : ''} ${tt.adminOnly && !isAdmin ? 'locked' : ''}`}
                  onClick={() => setTab(tt.id)}
                  title={tt.adminOnly && !isAdmin ? tr('admin_locked') : ''}
                >
                  <span className="nav-ic">{tt.icon}{tt.adminOnly && !isAdmin ? <span className="lock-mini">🔒</span> : null}</span>
                  <span className="nav-lbl">{tr(tt.key)}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="header-tools">
            <div className="lang-switch" role="group" aria-label={tr('lang_label')}>
              {LANGS.map(l => (
                <button
                  key={l.code}
                  className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                  onClick={() => switchLang(l.code)}
                  aria-pressed={lang === l.code}
                >
                  <span className="lang-flag">{l.flag}</span>
                  <span className="lang-code">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <button className={`account-chip ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>
              <span className="account-chip-avatar-shell">
                <img className="account-chip-avatar" src={profileAvatarSrc} alt={tr('auth_profile')} />
              </span>
              <span className="account-chip-copy">
                <span className="account-chip-label">{tr('auth_profile')}</span>
                <strong>{currentUser ? currentUser.name.split(' ')[0] : tr('auth_account_cta')}</strong>
              </span>
            </button>

            {installEvt && (
              <button className="btn-install" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>
                {tr('install_btn')}
              </button>
            )}
          </div>
        </header>
        <div className="flag-stripe" />

        {/* CONTENT */}
        <main className="content">
          {tab === 'home' && (
            <HomePage
              tr={tr} lang={lang}
              currentUser={currentUser}
              birthdaysToday={birthdaysToday}
              match={match} attendees={attendees} players={players} scorers={scorers} attStats={attStats} setSelectedPlayerCard={setSelectedPlayerCard} lastMatch={lastMatch}
              announcements={announcements} motmResults={motmResults} motmLast={motmLast}
              onRequireAuth={openAccountPage}
              onConfirm={async (intent, position) => {
                try {
                  const r = await api.vote(intent, position);
                  if (intent === 'yes') flash(r.late ? tr('presence_late') : tr('presence_ok'), r.late ? 'warn' : 'ok');
                  else if (intent === 'maybe') flash(tr('maybe_ok'), 'warn');
                  else flash(tr('absent_ok'), 'err');
                  loadHome();
                } catch (e) { flash(e.message, 'err'); }
              }}
              onUnvote={async () => {
                try { await api.unvote(match.id); flash(tr('presence_cancel')); loadHome(); }
                catch (e) { flash(e.message, 'err'); }
              }}
              onMotmVote={async (voterId, votedId) => {
                try { await api.motmVote(match.id, votedId); flash(tr('motm_recorded'), 'ok'); const r = await api.motmResults(match.id); setMotmResults(r); }
                catch (e) { flash(e.message, 'err'); }
              }}
            />
          )}

          {tab === 'players' && <PlayersPage tr={tr} isAdmin={isAdmin} currentUser={currentUser} players={players} attendees={attendees} onReload={loadHome} flash={flash} onRequireAuth={openAccountPage} />}

          {tab === 'account' && (
            <AccountPage
              tr={tr}
              currentUser={currentUser}
              authChecked={authChecked}
              onRegister={async (payload) => {
                const session = await api.authRegister(payload);
                await finishPlayerSession(session, 'auth_register_photo_prompt', 'account');
              }}
              onLogin={async (identifier, password) => {
                const session = await api.authLogin(identifier, password);
                await finishPlayerSession(session, 'auth_login_ok');
              }}
              onUpdateProfile={async (payload) => {
                const { user } = await api.updateMyProfile(payload);
                setStoredPlayer(user);
                setCurrentUser(user);
                flash(tr('auth_profile_saved'), 'ok');
                return user;
              }}
              onLogout={onPlayerLogout}
              onGoHome={() => setTab('home')}
            />
          )}

          {tab === 'teams' && (
            <StadiumPage
              tr={tr} lang={lang} isAdmin={isAdmin}
              teams={teams} match={match} goals={matchGoals} attendees={attendees}
              onReload={loadTeams}
              onSetPosition={async (playerId, position) => {
                try { await api.updatePosition(playerId, match.id, position); loadTeams(); loadHome(); }
                catch (e) { flash(e.message, 'err'); }
              }}
            />
          )}

          {tab === 'stats' && <StatsPage tr={tr} scorers={scorers} attendance={attStats} />}

          {tab === 'admin' && (
            isAdmin ? (
              <AdminDashboard
                tr={tr} lang={lang}
                announcements={announcements} fines={fines} caisse={caisse}
                players={players} match={match} motmResults={motmResults}
                teams={teams} matchGoals={matchGoals} calendar={calendar} inventory={inventory}
                onLogout={onAdminLogout}
                onAddAnnouncement={async (body, title, pinned) => {
                  try { await api.addAnnouncement({ body, title, pinned }); loadAdmin(); loadHome(); flash(tr('ann_published'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onDeleteAnnouncement={async (id) => {
                  if (!confirm(tr('ann_delete_confirm'))) return;
                  try { await api.deleteAnnouncement(id); loadAdmin(); loadHome(); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onTogglePin={async (a) => {
                  try { await api.updateAnnouncement(a.id, { pinned: !a.pinned }); loadAdmin(); loadHome(); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onPay={async (id) => { try { await api.payFine(id); loadAdmin(); flash(tr('fine_paid')); } catch (e) { flash(e.message, 'err'); } }}
                onAddExpense={async (reason, amount) => { try { await api.addExpense({ reason, amount }); loadAdmin(); flash(tr('expense_added')); } catch (e) { flash(e.message, 'err'); } }}
                onAddFine={async (playerId, reason, amount) => { try { await api.addFine({ playerId, reason, amount }); loadAdmin(); flash(tr('fine_added')); } catch (e) { flash(e.message, 'err'); } }}
                onSaveScore={async (matchId, a, b) => {
                  try { await api.setResult(matchId, a, b); await loadTeams(); await loadHome(); flash(tr('score_saved'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onAddGoal={async (matchId, playerId, goals, assists) => {
                  try { await api.recordGoals({ matchId, playerId, goals, assists }); await loadTeams(); flash(tr('goal_saved'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onSetMatchPhoto={async (matchId, photoUrl, winnerTeam) => {
                  try { await api.setMatchPhoto(matchId, photoUrl, winnerTeam); await loadHome(); flash(tr('admin_match_photo_ok'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onScheduleMatch={async (date, kickoff, notes) => {
                  try { const r = await api.scheduleMatch(date, kickoff, notes); await loadAdmin(); flash(r.created ? tr('admin_plan_created') : tr('admin_plan_existing'), 'ok'); return r; }
                  catch (e) { flash(e.message, 'err'); throw e; }
                }}
                onDeleteMatch={async (id) => {
                  if (!confirm(tr('admin_plan_del_confirm'))) return;
                  try { await api.deleteMatch(id); await loadAdmin(); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onAddInventoryItem={async (body) => {
                  try { await api.addInventoryItem(body); await loadAdmin(); flash(tr('inventory_added'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); throw e; }
                }}
                onUpdateInventoryItem={async (id, body) => {
                  try { await api.updateInventoryItem(id, body); await loadAdmin(); flash(tr('inventory_updated'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); throw e; }
                }}
                onDeleteInventoryItem={async (id) => {
                  if (!confirm(tr('inventory_delete_confirm'))) return;
                  try { await api.deleteInventoryItem(id); await loadAdmin(); flash(tr('inventory_deleted'), 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onUpdateMatch={onUpdateMatch}
              />
            ) : (
              <LockedSection tr={tr} onUnlock={() => setAdminModalOpen(true)} />
            )
          )}

          {/* SECTIONS PUBLIQUES — réservées à l'accueil */}
          {tab === 'home' && (
            <>
              <PublicAnnouncementsSection tr={tr} lang={lang} announcements={announcements} />
              <WinningGallerySection tr={tr} lang={lang} gallery={gallery} />
            </>
          )}
        </main>

        {/* FOOTER */}
        <div className="flag-stripe" />
        <footer className="footer">
          <div className="footer-block">
            <div className="footer-icon footer-icon-stadium" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <strong>{tr('footer_stadium')}</strong>
              <p>Hofener Straße 171<br/>70374 Stuttgart</p>
            </div>
          </div>
          <div className="footer-block">
            <div className="footer-icon footer-icon-resp" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
            </div>
            <div>
              <strong>{tr('footer_resp')}</strong>
              <p>Olivier Saly<br/><span className="muted-txt">{tr('footer_resp_sub')}</span></p>
            </div>
          </div>
          <div className="footer-block">
            <div className="footer-icon footer-icon-pp" aria-hidden="true">
              <PayPalIcon />
            </div>
            <div>
              <strong>{tr('footer_paypal')}</strong>
              <p>
                <a className="footer-link" href="mailto:finances@camasev.com">finances@camasev.com</a>
              </p>
            </div>
          </div>
        </footer>

        {/* Bandeau légal — obligatoire en Allemagne */}
        <div className="legal-bar">
          <button className="legal-link" onClick={() => setLegal('impressum')}>{tr('legal_impressum')}</button>
          <span aria-hidden="true">·</span>
          <button className="legal-link" onClick={() => setLegal('privacy')}>{tr('legal_privacy')}</button>
          <span aria-hidden="true">·</span>
          <span className="legal-copy">© {new Date().getFullYear()} CAMAS e.V.</span>
        </div>
      </div>

      {adminModalOpen && (
        <AdminModal tr={tr} onClose={() => setAdminModalOpen(false)} onSubmit={onAdminLogin} />
      )}

      {legal && (
        <LegalModal tr={tr} kind={legal} onClose={() => setLegal(null)} />
      )}

      {!cookieAck && (
        <CookieBanner tr={tr} onAccept={acceptCookies} onMore={() => setLegal('privacy')} />
      )}

      {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.msg}</div>}

      {selectedPlayerCard && (
        <PlayerCardModal player={selectedPlayerCard} tr={tr} onClose={() => setSelectedPlayerCard(null)} />
      )}
    </div>
  );
}

/* ========================================================
   PAYPAL ICON (inline SVG, palette officielle)
   ======================================================== */
function PayPalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-label="PayPal" role="img">
      <path fill="#003087" d="M7.6 21.5h-3a.5.5 0 0 1-.5-.6L6.7 4.4a.7.7 0 0 1 .7-.6h6.5c2.6 0 4.5.6 5.5 1.7.6.7.9 1.6.8 2.7 0 .1 0 .2-.1.3l-.1.6c-.5 3.6-2.9 4.9-6.2 4.9h-1.2a.7.7 0 0 0-.7.6l-.7 4.7v.2a.5.5 0 0 1-.5.4H7.9c-.2 0-.3-.1-.3-.3v-.5z"/>
      <path fill="#0070E0" d="M19.6 8.5c0 .1 0 .2-.1.3l-.1.6c-.5 3.6-2.9 4.9-6.2 4.9h-1.2a.7.7 0 0 0-.7.6l-.9 5.7a.4.4 0 0 0 .4.5h2.9a.6.6 0 0 0 .6-.5l.1-.2.6-3.5v-.2a.6.6 0 0 1 .6-.5h.4c2.9 0 5.1-1.1 5.7-4.5.3-1.4.1-2.6-.6-3.4-.2-.2-.3-.4-.5-.5z"/>
      <path fill="#001C64" d="M19 8.2a8 8 0 0 0-.7-.2 8.6 8.6 0 0 0-1.5-.1h-4.2a.6.6 0 0 0-.6.5L11 14.3l-.1.2c.1-.4.4-.6.7-.6h1.2c3.4 0 6-1.4 6.6-5.4 0-.1 0-.2.1-.3z"/>
    </svg>
  );
}

/* ========================================================
   ADMIN MODAL + LOCKED SECTION
   ======================================================== */
function AdminModal({ tr, onClose, onSubmit }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try { await onSubmit(code.trim()); }
    catch { /* géré côté parent */ }
    finally { setBusy(false); }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small admin-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>🔒 {tr('admin_modal_title')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <form className="new-form" onSubmit={submit}>
          <p className="admin-intro">{tr('admin_intro')}</p>
          <label>{tr('admin_code')}</label>
          <input
            type="password" autoFocus inputMode="text"
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="••••••••"
          />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy || !code.trim()}>
              {busy ? '…' : tr('admin_unlock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LockedSection({ tr, onUnlock }) {
  return (
    <section className="panel locked-panel">
      <div className="locked-icon">🔒</div>
      <h2>{tr('admin_locked')}</h2>
      <p className="muted-txt">{tr('admin_locked_hint')}</p>
      <button className="btn-primary" onClick={onUnlock}>{tr('admin_login')}</button>
    </section>
  );
}

function AccountAvatarField({ tr, previewSrc, hint, busy, onChange }) {
  return (
    <div className="account-avatar-field">
      <div className="account-avatar-copy">
        <span className="account-shell-kicker">{tr('auth_avatar')}</span>
        <p>{hint}</p>
      </div>
      <div className="account-avatar-row">
        <img className="account-avatar-preview" src={previewSrc} alt={tr('auth_profile')} />
        <label className={`account-avatar-picker ${busy ? 'busy' : ''}`}>
          <input className="account-avatar-input" type="file" accept="image/*" onChange={onChange} disabled={busy} />
          <span>{busy ? tr('auth_avatar_uploading') : tr('auth_avatar_pick')}</span>
        </label>
      </div>
    </div>
  );
}

function AccountPage({ tr, currentUser, authChecked, onRegister, onLogin, onUpdateProfile, onLogout, onGoHome }) {
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [pronoun, setPronoun] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerBusy, setRegisterBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const visualTitle = currentUser ? tr('auth_connected_title') : tr('auth_visual_title');
  const visualCopy = currentUser ? tr('auth_connected_sub') : tr('auth_visual_sub');
  const isRegisterMode = authMode === 'register';
  const avatarMessages = {
    invalidType: tr('auth_avatar_invalid'),
    tooLarge: tr('auth_avatar_too_large'),
    processing: tr('auth_avatar_processing_err'),
  };
  const connectedPreview = currentUser?.avatarUrl || buildProfileAvatar(currentUser?.name || '');

  const updateConnectedAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarBusy(true);
    setFeedback('');
    try {
      const nextAvatarUrl = await compressAvatarFile(file, avatarMessages);
      await onUpdateProfile({ avatarUrl: nextAvatarUrl });
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!isBirthDateComplete(birthDate)) {
      setFeedback(tr('auth_birth_date_invalid'));
      return;
    }
    setRegisterBusy(true);
    setFeedback('');
    try {
      await onRegister({ name, pronoun, birthDate, email, phone, password, passwordConfirm });
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setRegisterBusy(false);
    }
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoginBusy(true);
    setFeedback('');
    try {
      await onLogin(identifier, loginPassword);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  if (!authChecked && !currentUser) {
    return (
      <section className="panel account-page">
        <div className="account-stage">
          <aside className="account-visual">
            <div className="account-visual-content">
              <span className="account-kicker">CAMAS e.V.</span>
              <h2>{visualTitle}</h2>
              <p>{visualCopy}</p>
            </div>
          </aside>
          <div className="account-shell">
            <div className="panel-head"><h2>{tr('auth_account')}</h2></div>
            <p className="empty-row">{tr('loading')}</p>
          </div>
        </div>
      </section>
    );
  }

  if (currentUser) {
    const connectedBirthDate = formatBirthDateDisplay(currentUser.birthDate);

    return (
      <section className="panel account-page account-page-connected">
        <div className="account-stage">
          <aside className="account-visual">
            <div className="account-visual-content">
              <span className="account-kicker">CAMAS e.V.</span>
              <h2>{visualTitle}</h2>
              <p>{visualCopy}</p>
              <div className="account-visual-pills">
                <span>{tr('auth_visual_fast')}</span>
                <span>{tr('auth_visual_presence')}</span>
                <span>{tr('auth_visual_motm')}</span>
              </div>
            </div>
          </aside>
          <div className="account-shell">
            <div className="account-shell-header">
              <span className="account-shell-kicker">{tr('auth_account')}</span>
              <h3>{tr('auth_connected_as')} {currentUser.name}</h3>
              <p>{tr('auth_home_ready')}</p>
            </div>
            {feedback ? <p className="auth-feedback">{feedback}</p> : null}
            <AccountAvatarField
              tr={tr}
              previewSrc={connectedPreview}
              hint={tr('auth_avatar_connected_intro')}
              busy={avatarBusy}
              onChange={updateConnectedAvatar}
            />
            <div className="account-summary-grid">
              <div className="overview-chip"><strong>{currentUser.pronoun || '—'}</strong><span>{tr('auth_pronoun')}</span></div>
              <div className="overview-chip"><strong>{connectedBirthDate}</strong><span>{tr('auth_birth_date')}</span></div>
              <div className="overview-chip"><strong>{currentUser.email || '—'}</strong><span>{tr('auth_email')}</span></div>
              <div className="overview-chip"><strong>{currentUser.phone || '—'}</strong><span>{tr('auth_phone')}</span></div>
            </div>
            <div className="account-actions-card">
              <p>{tr('auth_connected_sub')}</p>
              <div className="row-actions">
                <button type="button" className="btn-ghost" onClick={onGoHome}>{tr('auth_go_home')}</button>
                <button type="button" className="btn-primary" onClick={onLogout}>{tr('auth_logout')}</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel account-page">
      <div className="account-stage">
        <aside className="account-visual">
          <div className="account-visual-content">
            <span className="account-kicker">CAMAS e.V.</span>
            <h2>{visualTitle}</h2>
            <p>{visualCopy}</p>
            <div className="account-visual-pills">
              <span>{tr('auth_visual_fast')}</span>
              <span>{tr('auth_visual_presence')}</span>
              <span>{tr('auth_visual_motm')}</span>
            </div>
          </div>
        </aside>

        <div className="account-shell">
          <div className="account-shell-header">
            <span className="account-shell-kicker">{tr('auth_account')}</span>
            <h3>{tr('auth_account_title')}</h3>
            <p>{tr('auth_account_intro')}</p>
          </div>
          {feedback ? <p className="auth-feedback">{feedback}</p> : null}
          <div className="account-mode-strip" role="tablist" aria-label={tr('auth_account')}>
            <button type="button" className={`account-mode-tab ${!isRegisterMode ? 'active' : ''}`} onClick={() => setAuthMode('login')}>
              {tr('auth_login_title')}
            </button>
            <button type="button" className={`account-mode-tab ${isRegisterMode ? 'active' : ''}`} onClick={() => setAuthMode('register')}>
              {tr('auth_register_title')}
            </button>
          </div>
          <div className="account-grid account-grid-single">
            {isRegisterMode ? (
              <form className="account-card account-card-register" onSubmit={submitRegister}>
                <div className="account-card-head">
                  <h3>{tr('auth_register_title')}</h3>
                  <p>{tr('auth_register_intro')}</p>
                </div>
                <div className="account-form-grid">
                  <div>
                    <label>{tr('auth_name')}</label>
                    <input value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div>
                    <label>{tr('auth_pronoun')}</label>
                    <input value={pronoun} onChange={e => setPronoun(e.target.value)} required />
                  </div>
                  <div>
                    <label>{tr('auth_birth_date')}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={tr('auth_birth_date_ph')}
                      value={birthDate}
                      onChange={e => setBirthDate(formatBirthDateInput(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label>{tr('auth_phone')}</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                  <div className="account-form-span-2">
                    <label>{tr('auth_email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div>
                    <label>{tr('auth_password')}</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength="8" required />
                  </div>
                  <div>
                    <label>{tr('auth_password_confirm')}</label>
                    <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} minLength="8" required />
                  </div>
                </div>
                <button type="submit" className="btn-primary account-submit" disabled={registerBusy}>{registerBusy ? '…' : tr('auth_register_submit')}</button>
                <div className="account-switch-row">
                  <span>{tr('auth_switch_login_prompt')}</span>
                  <button type="button" className="account-switch-link" onClick={() => setAuthMode('login')}>
                    {tr('auth_switch_login')}
                  </button>
                </div>
              </form>
            ) : (
              <form className="account-card account-card-login" onSubmit={submitLogin}>
                <div className="account-card-head">
                  <h3>{tr('auth_login_title')}</h3>
                  <p>{tr('auth_login_intro')}</p>
                </div>
                <label>{tr('auth_identifier')}</label>
                <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder={tr('auth_identifier_ph')} required />
                <label>{tr('auth_password')}</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                <button type="submit" className="btn-primary account-submit" disabled={loginBusy}>{loginBusy ? '…' : tr('auth_login_submit')}</button>
                <div className="account-switch-row">
                  <span>{tr('auth_switch_register_prompt')}</span>
                  <button type="button" className="account-switch-link" onClick={() => setAuthMode('register')}>
                    {tr('auth_switch_register')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PresenceChoiceModal({ tr, currentUser, onClose, onSubmit }) {
  const [position, setPosition] = useState(null);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{tr('confirm_presence')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <p className="pp-intro">{tr('auth_presence_intro', { name: currentUser?.name || '' })}</p>
        <div className="position-picker compact">
          <div className="position-grid">
            {POSITIONS.map(option => (
              <button
                key={option.code}
                type="button"
                className={`pos-card pos-card-${option.code} ${position === option.code ? 'selected' : ''}`}
                onClick={() => setPosition(option.code)}
              >
                <span className="pos-code">{option.code}</span>
                <span className="pos-name">{tr(option.key)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
          <button type="button" className="btn-primary" disabled={!position} onClick={() => onSubmit(position)}>{tr('confirm_presence')}</button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   HOME / DASHBOARD
   ======================================================== */
function HomePage({ tr, lang, currentUser, birthdaysToday, match, attendees, players, scorers, attStats, setSelectedPlayerCard, lastMatch, announcements, motmResults, motmLast, onRequireAuth, onConfirm, onUnvote, onMotmVote }) {
  const [presenceOpen, setPresenceOpen] = useState(false);
  const topScorer = scorers.find(s => s.goals > 0) || scorers[0];

  // Toujours 11 vs 11 — la logique de format auto a été retirée à la demande.
  const fmt = { type: tr('stadium'), format: '11 vs 11' };

  const confirmedAttendees = attendees.filter(a => a.status !== 'maybe' && a.status !== 'absent');
  const yesCount = confirmedAttendees.length;
  const maybeCount = attendees.filter(a => a.status === 'maybe').length;
  const kickoffTime = normalizeClockTime(match?.kickoff_local);
  const meetingTime = shiftClockTime(kickoffTime, -15);
  const lateFineHint = replaceTimeToken(tr('late_fine_sub'), kickoffTime);
  const matchNote = match?.notes?.trim();
  const birthdayList = birthdaysToday.length
    ? new Intl.ListFormat(localeFor(lang), { style: 'long', type: 'conjunction' }).format(birthdaysToday.map(player => player.name))
    : '';

  const handleIntent = async (intent) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (intent === 'yes') {
      setPresenceOpen(true);
      return;
    }
    await onConfirm(intent, null);
  };

  const statusPill = (a) => {
    if (a.status === 'maybe') return <span className="badge badge-yellow">{tr('status_maybe')}</span>;
    if (a.status === 'absent') return <span className="badge badge-red">{tr('status_absent')}</span>;
    if (a.is_late) return <span className="badge badge-red">{tr('status_late')}</span>;
    return <span className="badge badge-green">{tr('status_confirmed')}</span>;
  };

  return (
    <>
      {lastMatch && <LastMatchCard tr={tr} lang={lang} lastMatch={lastMatch} />}

      {birthdaysToday.length > 0 && (
        <section className="panel birthday-banner">
          <div className="birthday-banner-head">
            <div>
              <span className="birthday-kicker">{tr('birthday_today_label')}</span>
              <h2>{tr('birthday_today_title')}</h2>
            </div>
            <span className="birthday-emoji">🎂</span>
          </div>
          <p className="birthday-copy">{tr('birthday_today_copy', { names: birthdayList })}</p>
          <div className="birthday-players">
            {birthdaysToday.map((player) => (
              <div key={player.id} className="birthday-player-pill">
                <strong>{player.name}</strong>
                <span>{tr('birthday_today_age', { age: player.age })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vote « Joueur du jour » — visible quand un match est en cours */}
      <MotMSection
        key={`${match?.id || 'no-match'}-${currentUser?.id || 'guest'}`}
        tr={tr} lang={lang}
        currentUser={currentUser}
        match={match} attendees={attendees} players={players}
        results={motmResults} lastWinner={motmLast}
        onRequireAuth={onRequireAuth}
        onVote={onMotmVote}
      />
      {/* Note: annonces et galerie sont rendues juste avant le footer (cf. App) */}
      {announcements && announcements.length > 0 && null}
      <div className="grid-top">
        <section className="panel presences-panel">
          <div className="panel-head">
            <h2>{tr('attendance_board')}</h2>
            <span className="panel-ic">⚽</span>
          </div>
          <div className="presences-summary">
            <span className="psum psum-green">✅ {yesCount}</span>
            <span className="psum psum-yellow">🤔 {maybeCount}</span>
          </div>
          <table className="presences-table">
            <thead>
              <tr>
                <th>{tr('th_name')}</th>
                <th>{tr('th_position')}</th>
                <th>{tr('th_status')}</th>
                <th>{tr('th_arrival')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {confirmedAttendees.length === 0 && (
                <tr><td colSpan="5" className="empty-row">{tr('no_attendance')}</td></tr>
              )}
              {confirmedAttendees.map(a => (
                <tr key={a.id}>
                  <td onClick={() => {
                    const stats = scorers.find(s => s.id === a.player_id || s.id === a.id) || {};
                    const att = attStats.find(at => at.id === a.player_id || at.id === a.id) || {};
                    setSelectedPlayerCard({ ...a, ...stats, ...att });
                  }} className="clickable-name">{a.name}</td>
                  <td>
                    {a.status === 'maybe'
                      ? <span className="pos-tag pos-maybe">?</span>
                      : a.position
                        ? <span className={`pos-tag pos-${a.position}`}>{a.position}</span>
                        : <span className="muted-txt">—</span>}
                  </td>
                  <td>{statusPill(a)}</td>
                  <td className="time-cell">{fmtTime(a.vote_time, lang)}</td>
                  <td>{currentUser?.id === a.player_id ? <button className="row-x" onClick={() => onUnvote()} title={tr('cancel')}>✕</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel match-panel">
          <div className="panel-head">
            <h2>{tr('next_match')}</h2>
            <span className="panel-ic">⏱️</span>
          </div>
          <p className="kickoff">{tr('kickoff')} <strong>{kickoffTime}</strong> · {match ? fmtDate(match.match_date, lang) : '…'}</p>
          {matchNote && <p className="match-note">{matchNote}</p>}

          <div className="info-box info-yellow">
            <p>{tr('meeting_at')} : <strong>{meetingTime}</strong></p>
            <p className="sub">{tr('meeting_sub')}</p>
          </div>

          <div className="intent-grid">
            <button className="intent-btn intent-yes" onClick={() => handleIntent('yes')}>
              <span className="intent-emoji">⚽</span>
              <span className="intent-lbl">{tr('vote_yes')}</span>
            </button>
            <button className="intent-btn intent-maybe" onClick={() => handleIntent('maybe')}>
              <span className="intent-emoji">🤔</span>
              <span className="intent-lbl">{tr('vote_maybe')}</span>
            </button>
            <button className="intent-btn intent-no" onClick={() => handleIntent('no')}>
              <span className="intent-emoji">❌</span>
              <span className="intent-lbl">{tr('vote_no')}</span>
            </button>
          </div>


          <div className="info-box info-border">
            <p>{tr('poll_closed')}</p>
            <p><strong>{lang === 'de' ? 'Samstag 20:00' : 'samedi 20:00'}</strong></p>
          </div>

          <div className="info-box info-red">
            <p>{tr('late_fine')} : <strong>2€</strong></p>
            <p className="sub">{lateFineHint}</p>
            <span className="fine-ic">🧾</span>
          </div>
        </section>
      </div>

      <div className="grid-bottom">
        <section className="panel small-panel">
          <div className="panel-head">
            <h3>{tr('rules_title')}</h3>
            <span className="panel-ic">⏱️</span>
          </div>
          <ul className="rules">
            <li><span className="check">✓</span> {tr('rule_1')}</li>
            <li><span className="check">✓</span> {tr('rule_2')}</li>
            <li><span className="check">✓</span> {tr('rule_3')}</li>
          </ul>
        </section>

        <section className="panel small-panel scorer-panel">
          <div className="panel-head">
            <h3>{tr('top_scorer')}</h3>
            <span className="flag-badge">🇨🇲</span>
          </div>
          {topScorer ? (
            <div className="scorer-body">
              <div className="scorer-avatar">{topScorer.name.slice(0, 1).toUpperCase()}</div>
              <div className="scorer-stats">
                <p className="scorer-name">{topScorer.name}</p>
                <p><span>🏆</span> <strong>{(topScorer.goals || 0) * 10 + (topScorer.assists || 0) * 3}</strong> pts</p>
                <p><span>⚽</span> <strong>{topScorer.goals || 0}</strong></p>
                <p><span>🅰</span> <strong>{topScorer.assists || 0}</strong></p>
              </div>
            </div>
          ) : (
            <p className="empty-row">{tr('no_goals_yet')}</p>
          )}
        </section>

        <section className="panel small-panel teams-panel">
          <div className="panel-head">
            <h3>{tr('formation')}</h3>
            <span className="flag-badge">🇨🇲</span>
          </div>
          <div className="teams-info">
            <p className="teams-headline">{tr('auto_split')}</p>
            <div className="teams-stats">
              <div><strong>{yesCount}</strong><span>{tr('registered')}</span></div>
              <div><strong>2</strong><span>{tr('teams_count')}</span></div>
              <div><strong>{fmt.format}</strong><span>{tr('format')}</span></div>
            </div>
          </div>
        </section>
      </div>

      {presenceOpen && currentUser && (
        <PresenceChoiceModal
          tr={tr}
          currentUser={currentUser}
          onSubmit={async (position) => {
            await onConfirm('yes', position);
            setPresenceOpen(false);
          }}
          onClose={() => setPresenceOpen(false)}
        />
      )}
    </>
  );
}

function LastMatchCard({ tr, lang, lastMatch }) {
  const { match, scorers } = lastMatch;
  return (
    <section className="last-match">
      <div className="last-match-tag">{tr('last_match')} · {fmtShortDate(match.match_date, lang)}</div>
      <div className="last-match-score">
        <div className="lm-team lm-team-a">
          <span>{tr('team_a')}</span>
          <strong>{match.team_a_score}</strong>
        </div>
        <span className="lm-vs">{tr('vs')}</span>
        <div className="lm-team lm-team-b">
          <strong>{match.team_b_score}</strong>
          <span>{tr('team_b')}</span>
        </div>
      </div>
      {scorers && scorers.length > 0 && (
        <div className="last-match-scorers">
          <span className="muted-txt">{tr('scorers')} :</span>
          {scorers.map(s => (
            <span key={s.id} className="scorer-pill">
              ⚽ {s.name} {s.goals > 1 && `×${s.goals}`}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function AttendanceChangeModal({ tr, attendance, onClose, onSubmit }) {
  const [intent, setIntent] = useState(attendance.status === 'absent' ? 'no' : 'maybe');
  const [position, setPosition] = useState(attendance.position || null);
  const needsPosition = intent === 'yes';

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small choice-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{tr('player_change_choice')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <div className="choice-sheet-body">
          <p className="pp-intro">{tr('player_change_intro', { name: attendance.name })}</p>
          <div className="choice-switch">
            <button type="button" className={`choice-switch-btn ${intent === 'yes' ? 'active yes' : ''}`} onClick={() => setIntent('yes')}>{tr('vote_yes')}</button>
            <button type="button" className={`choice-switch-btn ${intent === 'maybe' ? 'active maybe' : ''}`} onClick={() => setIntent('maybe')}>{tr('vote_maybe')}</button>
            <button type="button" className={`choice-switch-btn ${intent === 'no' ? 'active no' : ''}`} onClick={() => setIntent('no')}>{tr('vote_no')}</button>
          </div>

          {needsPosition && (
            <div className="position-picker compact">
              <div className="position-grid">
                {POSITIONS.map(option => (
                  <button
                    key={option.code}
                    type="button"
                    className={`pos-card pos-card-${option.code} ${position === option.code ? 'selected' : ''}`}
                    onClick={() => setPosition(option.code)}
                  >
                    <span className="pos-code">{option.code}</span>
                    <span className="pos-name">{tr(option.key)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="new-form" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await onSubmit(intent, position);
            } catch {
              // The parent already surfaced the error through flash.
            }
          }}>
            <div className="row-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
              <button type="submit" className="btn-primary" disabled={needsPosition && !position}>{tr('player_change_save')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   PLAYERS PAGE
   ======================================================== */
function PlayersPage({ tr, isAdmin, currentUser, players, attendees, onReload, flash, onRequireAuth }) {
  const [adding, setAdding] = useState(false);
  const [attendanceEditor, setAttendanceEditor] = useState(null);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const presentIds = new Set(attendees.filter(a => a.status !== 'maybe' && a.status !== 'absent').map(a => a.player_id));
  const attendanceByPlayerId = useMemo(() => new Map(attendees.map(a => [a.player_id, a])), [attendees]);
  const averageRating = players.length
    ? players.reduce((sum, player) => sum + Number(player.rating || 0), 0) / players.length
    : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.createPlayer({ name: name.trim(), rating: Number(rating) }); setName(''); setRating(5); setAdding(false); onReload(); flash(tr('player_added', { name: name.trim() })); }
    catch (e) { flash(e.message, 'err'); }
  };
  const updateRating = async (p, v) => { try { await api.updatePlayer(p.id, { rating: Number(v) }); onReload(); } catch (e) { flash(e.message, 'err'); } };
  const remove = async (p) => { if (!confirm(tr('delete_confirm', { name: p.name }))) return; try { await api.deletePlayer(p.id); onReload(); flash(tr('player_removed')); } catch (e) { flash(e.message, 'err'); } };
  const sundayStatus = (attendance) => {
    if (!attendance) return <span className="badge badge-muted">—</span>;
    if (attendance.status === 'maybe') return <span className="badge badge-yellow">{tr('status_maybe')}</span>;
    if (attendance.status === 'absent') return <span className="badge badge-red">{tr('status_absent')}</span>;
    if (attendance.is_late || attendance.status === 'late') return <span className="badge badge-red">{tr('status_late')}</span>;
    return <span className="badge badge-green">{tr('status_confirmed')}</span>;
  };
  const updateChoice = async (intent, position) => {
    try {
      const result = await api.vote(intent, position);
      if (intent === 'yes') flash(result.late ? tr('presence_late') : tr('presence_ok'), result.late ? 'warn' : 'ok');
      else if (intent === 'maybe') flash(tr('maybe_ok'), 'warn');
      else flash(tr('absent_ok'), 'err');
      setAttendanceEditor(null);
      await onReload();
    } catch (error) {
      flash(error.message, 'err');
      throw error;
    }
  };

  return (
    <>
      <section className="panel players-panel">
        <div className="panel-head">
          <h2>{tr('manage_players')}</h2>
          {isAdmin ? <button className="btn-primary" onClick={() => setAdding(a => !a)}>{adding ? tr('cancel') : tr('add_btn')}</button> : <button className="btn-ghost btn-choice-edit" onClick={() => onRequireAuth(null)}>{currentUser ? tr('auth_account') : tr('auth_login_short')}</button>}
        </div>
        {!currentUser && !isAdmin && <p className="muted-txt players-auth-hint">{tr('auth_players_hint')}</p>}
        <div className="players-overview">
          <div className="overview-chip">
            <strong>{players.length}</strong>
            <span>{tr('th_player')}</span>
          </div>
          <div className="overview-chip">
            <strong>{presentIds.size}</strong>
            <span>{tr('status_confirmed')}</span>
          </div>
          <div className="overview-chip">
            <strong>{averageRating.toFixed(1)}</strong>
            <span>{tr('th_level')}</span>
          </div>
        </div>
        {isAdmin && adding && (
          <form className="inline-form" onSubmit={submit}>
            <input placeholder={tr('full_name_ph')} value={name} onChange={e => setName(e.target.value)} autoFocus />
            <label className="rating-input">{tr('th_level')}: <strong>{rating}</strong>
              <input type="range" min="1" max="10" step="0.5" value={rating} onChange={e => setRating(e.target.value)} />
            </label>
            <button className="btn-primary" type="submit">{tr('save')}</button>
          </form>
        )}
        {players.length === 0 ? (
          <p className="empty-row">{tr('no_players')}</p>
        ) : (
          <table className="presences-table player-status-table">
            <thead><tr><th>{tr('th_name')}</th><th>{tr('th_level')}</th><th>{tr('th_sunday')}</th><th>{tr('th_action')}</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {players.map(p => {
                const attendance = attendanceByPlayerId.get(p.id);
                const isCurrentUser = currentUser?.id === p.id;
                const canEditChoice = isCurrentUser && attendance && ['maybe', 'absent'].includes(attendance.status);
                return (
                  <tr key={p.id}>
                    <td>{p.name} {isCurrentUser ? <span className="mini-tag self-tag">{tr('auth_me_badge')}</span> : null}</td>
                    <td>
                      {isAdmin ? (
                        <div className="rating-inline">
                          <input type="range" min="1" max="10" step="0.5" defaultValue={Number(p.rating)} onChange={e => updateRating(p, e.target.value)} />
                          <span className="rating-pill">{Number(p.rating).toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="rating-pill">{Number(p.rating).toFixed(1)}</span>
                      )}
                    </td>
                    <td>{sundayStatus(attendance)}</td>
                    <td>
                      {canEditChoice ? (
                        <button className="btn-ghost btn-choice-edit" onClick={() => setAttendanceEditor(attendance)}>{tr('player_change_choice')}</button>
                      ) : isCurrentUser && !attendance ? (
                        <button className="btn-ghost btn-choice-edit" onClick={() => onRequireAuth('auth_go_home_prompt')}>{tr('auth_go_home')}</button>
                      ) : (
                        <span className="muted-txt">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td><button className="row-x" onClick={() => remove(p)}>🗑</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {attendanceEditor && (
        <AttendanceChangeModal
          tr={tr}
          attendance={attendanceEditor}
          onClose={() => setAttendanceEditor(null)}
          onSubmit={updateChoice}
        />
      )}
    </>
  );
}

/* ========================================================
   STADIUM PAGE
   ======================================================== */
function StadiumPage({ tr, lang, isAdmin, teams, match, goals, onReload, onSetPosition }) {
  if (!teams) return <section className="panel"><p className="empty-row">{tr('loading')}</p></section>;
  if (teams.count < 2) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>🏟️ {tr('stadium')}</h2></div>
        <p className="empty-row">{tr('not_enough')}</p>
      </section>
    );
  }

  const [teamA, teamB] = teams.teams;
  const diff = Math.abs(teamA.total - teamB.total);
  const goalsByPlayer = Object.fromEntries(goals.map(g => [g.player_id, g]));
  const hasOfficialScore = match?.team_a_score != null && match?.team_b_score != null;
  const kickoffTime = normalizeClockTime(match?.kickoff_local);
  const meetingTime = shiftClockTime(kickoffTime, -15);
  const teamSummaries = [teamA, teamB].map((team, index) => ({
    key: index === 0 ? 'A' : 'B',
    label: index === 0 ? tr('team_a') : tr('team_b'),
    total: team.total.toFixed(1),
    starters: team.starters.length,
    subs: team.subs.length,
    average: team.starters.length ? (team.starters.reduce((sum, player) => sum + player.rating, 0) / team.starters.length).toFixed(1) : '0.0',
    preview: team.starters.slice(0, 4),
  }));


  // Génération du message WhatsApp — i18n FR/DE
  const shareToWhatsApp = () => {
    if (!teamA || !teamB) return;
    const fmt = teams?.format?.format || '';
    const shareMeetingTime = formatShareTime(meetingTime, lang);
    const shareKickoffTime = formatShareTime(kickoffTime, lang);

    let msg = `${tr('wa_title')}\n\n`;
    msg += `${replaceTimeToken(tr('wa_meet'), shareMeetingTime)}\n`;
    if (fmt) msg += `${tr('wa_format')} ${fmt}\n`;
    msg += `\n`;

    msg += `${tr('wa_team_a')} (${teamA.total.toFixed(1)} pts)\n`;
    teamA.starters.forEach(p => { msg += `• ${p.name}${p.position ? ' ('+p.position+')' : ''}\n`; });
    if (teamA.subs.length > 0) msg += `${tr('wa_subs')} ${teamA.subs.map(s => s.name).join(', ')}\n`;
    msg += `\n`;

    msg += `${tr('wa_team_b')} (${teamB.total.toFixed(1)} pts)\n`;
    teamB.starters.forEach(p => { msg += `• ${p.name}${p.position ? ' ('+p.position+')' : ''}\n`; });
    if (teamB.subs.length > 0) msg += `${tr('wa_subs')} ${teamB.subs.map(s => s.name).join(', ')}\n`;
    msg += `\n`;

    msg += replaceTimeToken(tr('wa_warn_late'), shareKickoffTime);

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  return (
    <>
      <section className="panel stadium-panel">
        <div className="panel-head">
          <h2>🏟️ {tr('stadium')} · {teams.format.type}</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {isAdmin && <button className="btn-ghost" onClick={onReload}>🔄</button>}
            {isAdmin && <button className="btn-whatsapp" onClick={shareToWhatsApp}>📲 WhatsApp</button>}
          </div>
        </div>

        <div className="format-banner">
          <div className="format-value">{teams.format.format}</div>
          <div className="format-sub">
            {tr('team_a')} <strong>{teamA.total.toFixed(1)}</strong> · {tr('team_b')} <strong>{teamB.total.toFixed(1)}</strong> · {tr('gap')} {diff.toFixed(1)} {tr('pt')}
          </div>
        </div>

        <div className="teams-showcase">
          <div className="teams-showcase-head">
            <h3>{tr('teams_showcase_title')}</h3>
            <span>{tr('meeting_at')} {meetingTime}</span>
          </div>
          <div className="teams-showcase-grid">
            {teamSummaries.map(summary => (
              <article key={summary.key} className={`team-showcase-card team-showcase-card-${summary.key.toLowerCase()}`}>
                <div className="team-showcase-card-head">
                  <strong>{summary.label}</strong>
                  <span className={`pos-tag pos-team-${summary.key}`}>{summary.total} pts</span>
                </div>
                <div className="team-showcase-metrics">
                  <div><strong>{summary.starters}</strong><span>{tr('teams_starters_label')}</span></div>
                  <div><strong>{summary.average}</strong><span>{tr('teams_avg_label')}</span></div>
                  <div><strong>{summary.subs}</strong><span>{tr('teams_subs_label')}</span></div>
                </div>
                <div className="team-showcase-preview">
                  {summary.preview.map(player => (
                    <span key={player.id} className="team-showcase-pill">{player.name.split(' ')[0]}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <Pitch tr={tr} isAdmin={isAdmin} teamA={teamA.starters} teamB={teamB.starters} goalsByPlayer={goalsByPlayer} onSetPosition={onSetPosition} />
      </section>

      {/* SCORE + BUTEURS — lecture seule (la saisie est faite par le responsable depuis l'admin) */}
      <section className="panel">
        <div className="panel-head">
          <h2>{tr('score_locked')}</h2>
          {!isAdmin && <span className="locked-icon-sm" title={tr('score_locked_hint')}>🔒</span>}
        </div>
        {hasOfficialScore ? (
          <div className="official-score">
            <div className="os-team os-team-a">
              <span>{tr('team_a')}</span>
              <strong>{match.team_a_score}</strong>
            </div>
            <span className="os-vs">{tr('vs')}</span>
            <div className="os-team os-team-b">
              <strong>{match.team_b_score}</strong>
              <span>{tr('team_b')}</span>
            </div>
          </div>
        ) : (
          <p className="empty-row">{tr('score_locked_hint')}</p>
        )}
        <div className="goals-block">
          <h3>{tr('buteurs')}</h3>
          {goals.length === 0 ? (
            <p className="empty-row">{tr('no_goals_yet')}</p>
          ) : (
            <ul className="goals-list">
              {goals.map(g => {
                const teamLetter = teamA.starters.some(p => p.id === g.player_id) ? 'A' : teamB.starters.some(p => p.id === g.player_id) ? 'B' : null;
                return (
                  <li key={g.id}>
                    <span className="goal-icon">⚽</span>
                    <span className="goal-name">{g.name}</span>
                    {teamLetter && <span className={`pos-tag pos-team-${teamLetter}`}>{teamLetter === 'A' ? tr('team_a') : tr('team_b')}</span>}
                    <span className="goal-count">×{g.goals}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* REMPLAÇANTS */}
      <section className="panel">
        <div className="panel-head"><h2>{tr('subs_title')}</h2></div>
        <div className="subs-grid">
          <div className="sub-team sub-team-a">
            <h4>{tr('team_a')} · {teamA.subs.length} {tr('subs_count')}</h4>
            {teamA.subs.length === 0 ? <p className="empty-row small">{tr('none')}</p> : (
              <ul className="subs-list">
                {teamA.subs.map(p => (
                  <li key={p.id}>
                    <div className="tile-avatar small">{p.name.slice(0,1).toUpperCase()}</div>
                    <span>{p.name}</span>
                    <span className="rating-pill">{p.rating.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sub-team sub-team-b">
            <h4>{tr('team_b')} · {teamB.subs.length} {tr('subs_count')}</h4>
            {teamB.subs.length === 0 ? <p className="empty-row small">{tr('none')}</p> : (
              <ul className="subs-list">
                {teamB.subs.map(p => (
                  <li key={p.id}>
                    <div className="tile-avatar small">{p.name.slice(0,1).toUpperCase()}</div>
                    <span>{p.name}</span>
                    <span className="rating-pill">{p.rating.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Pitch({ tr, isAdmin, teamA, teamB, goalsByPlayer, onSetPosition }) {
  const groupByPos = (team) => {
    const g = { G: [], DEF: [], MIL: [], ATT: [] };
    team.forEach(p => { g[p.position || 'MIL'].push(p); });
    return g;
  };
  const A = groupByPos(teamA);
  const B = groupByPos(teamB);

  return (
    <div className="pitch">
      <div className="pitch-lines">
        <div className="center-circle" />
        <div className="center-line" />
        <div className="penalty-top" />
        <div className="penalty-bottom" />
        <div className="goal-top" />
        <div className="goal-bottom" />
      </div>

      <div className="pitch-half pitch-half-a">
        <PositionRow tr={tr} isAdmin={isAdmin} players={A.G}   label="G"   team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={A.DEF} label="DEF" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={A.MIL} label="MIL" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={A.ATT} label="ATT" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
      </div>

      <div className="pitch-half pitch-half-b">
        <PositionRow tr={tr} isAdmin={isAdmin} players={B.ATT} label="ATT" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={B.MIL} label="MIL" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={B.DEF} label="DEF" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={B.G}   label="G"   team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
      </div>

      <div className="pitch-label label-a">{tr('team_a').toUpperCase()}</div>
      <div className="pitch-label label-b">{tr('team_b').toUpperCase()}</div>
    </div>
  );
}

function PositionRow({ tr, isAdmin, players, label, team, goalsByPlayer, onSet }) {
  return (
    <div className={`pos-row pos-row-${label}`}>
      <span className="pos-row-label">{label}</span>
      <div className="pos-row-players">
        {players.length === 0 ? (
          <div className="pos-empty">—</div>
        ) : players.map(p => (
          <PlayerDot key={p.id} tr={tr} isAdmin={isAdmin} player={p} team={team} goals={goalsByPlayer[p.id]?.goals || 0} onSet={onSet} currentPos={label} />
        ))}
      </div>
    </div>
  );
}

function PlayerDot({ tr, isAdmin, player, team, goals, onSet, currentPos }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="player-dot-wrap">
      <button
        className={`player-dot player-dot-${team}`}
        onClick={() => isAdmin && setMenuOpen(m => !m)}
        title={isAdmin ? tr('click_change_pos') : ''}
      >
        <span className="dot-name">{player.name.split(' ')[0]}</span>
        {goals > 0 && <span className="dot-goals">⚽{goals}</span>}
      </button>
      {menuOpen && isAdmin && (
        <div className="dot-menu" onMouseLeave={() => setMenuOpen(false)}>
          {POSITIONS.map(p => (
            <button
              key={p.code}
              className={currentPos === p.code ? 'active' : ''}
              onClick={() => { onSet(player.id, p.code); setMenuOpen(false); }}
            >{p.code}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================
   STATS & CAISSE
   ======================================================== */
function StatsPage({ tr, scorers, attendance }) {
  const totalGoals = scorers.reduce((sum, scorer) => sum + Number(scorer.goals || 0), 0);
  const activePlayers = attendance.filter(player => player.total > 0).length;
  const bestPunctuality = attendance.reduce((best, player) => {
    const punctuality = player.shows ? Math.round(((player.shows - player.lates) / player.shows) * 100) : 0;
    return punctuality > best ? punctuality : best;
  }, 0);

  return (
    <>
      <section className="panel stats-panel">
        <div className="panel-head"><h2>{tr('top_scorers_season')}</h2></div>
        <div className="stats-overview">
          <div className="overview-chip">
            <strong>{totalGoals}</strong>
            <span>{tr('buteurs')}</span>
          </div>
          <div className="overview-chip">
            <strong>{activePlayers}</strong>
            <span>{tr('th_player')}</span>
          </div>
          <div className="overview-chip">
            <strong>{bestPunctuality}%</strong>
            <span>{tr('th_punctuality')}</span>
          </div>
        </div>
        {scorers.filter(s => s.goals > 0).length === 0 ? (
          <p className="empty-row">{tr('no_goals_season')}</p>
        ) : (
          <ol className="rank-list">
            {scorers.filter(s => s.goals > 0).slice(0, 10).map((s, i) => (
              <li key={s.id} className={`rank-${i + 1}`}>
                <span className="rank-n">{i + 1}</span>
                <div className="tile-avatar small">{s.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{s.name}</span>
                <span className="rank-stat">⚽ {s.goals}</span>
                <span className="rank-stat">🅰 {s.assists}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{tr('attendance_punct')}</h2></div>
        {attendance.filter(a => a.total > 0).length === 0 ? (
          <p className="empty-row">{tr('no_history')}</p>
        ) : (
          <table className="presences-table">
            <thead><tr><th>{tr('th_player')}</th><th>{tr('th_present')}</th><th>{tr('th_lates')}</th><th>{tr('th_absences')}</th><th>{tr('th_punctuality')}</th></tr></thead>
            <tbody>
              {attendance.filter(a => a.total > 0).slice(0, 15).map(a => {
                const punct = a.shows ? Math.round(((a.shows - a.lates) / a.shows) * 100) : 0;
                return (
                  <tr key={a.id}>
                    <td>{a.name}</td><td>{a.shows}</td><td>{a.lates}</td><td>{a.absences}</td>
                    <td><span className={`badge ${punct >= 80 ? 'badge-green' : punct >= 50 ? 'badge-yellow' : 'badge-red'}`}>{punct}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ========================================================
   ADMIN DASHBOARD — 4 sous-sections claires
   Match · Annonces · Planning · Caisse
   ======================================================== */
function AdminDashboard({
  tr, lang,
  announcements, fines, caisse, players,
  match, motmResults, teams, matchGoals, calendar, inventory,
  onLogout,
  onAddAnnouncement, onDeleteAnnouncement, onTogglePin,
  onPay, onAddExpense, onAddFine,
  onSaveScore, onAddGoal, onSetMatchPhoto,
  onScheduleMatch, onDeleteMatch,
  onAddInventoryItem, onUpdateInventoryItem, onDeleteInventoryItem,
  onUpdateMatch,
}) {
  const [section, setSection] = useState('match');
  const dueCount = fines.filter(f => !f.paid).length;
  const plannedCount = calendar.filter(item => item.status !== 'done').length;
  const readyUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_ready || 0), 0);
  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_total || 0), 0);
  const readyRatio = totalUnits ? Math.round((readyUnits / totalUnits) * 100) : 100;

  return (
    <>
      <section className="panel admin-hero">
        <div className="panel-head admin-hero-head">
          <h2>{tr('admin_dash_title')}</h2>
          <button className="btn-admin-logout" onClick={onLogout} title={tr('admin_logout_btn')}>
            {tr('admin_logout_btn')}
          </button>
        </div>
        <p className="admin-welcome">{tr('admin_dash_intro')}</p>
        <div className="admin-overview-grid">
          <article className="admin-overview-card">
            <strong>{announcements.length}</strong>
            <span>{tr('admin_kpi_ann')}</span>
          </article>
          <article className="admin-overview-card">
            <strong>{plannedCount}</strong>
            <span>{tr('admin_kpi_plan')}</span>
          </article>
          <article className="admin-overview-card">
            <strong>{dueCount}</strong>
            <span>{tr('admin_kpi_due')}</span>
          </article>
          <article className="admin-overview-card">
            <strong>{readyRatio}%</strong>
            <span>{tr('admin_kpi_inventory')}</span>
          </article>
        </div>
        <div className="admin-tabs">
          <button className={`admin-tab ${section === 'match' ? 'active' : ''}`} onClick={() => setSection('match')}>{tr('admin_tab_match')}</button>
          <button className={`admin-tab ${section === 'ann' ? 'active' : ''}`} onClick={() => setSection('ann')}>{tr('admin_tab_ann')}</button>
          <button className={`admin-tab ${section === 'plan' ? 'active' : ''}`} onClick={() => setSection('plan')}>{tr('admin_tab_plan')}</button>
          <button className={`admin-tab ${section === 'cash' ? 'active' : ''}`} onClick={() => setSection('cash')}>{tr('admin_tab_cash')}</button>
          <button className={`admin-tab ${section === 'gear' ? 'active' : ''}`} onClick={() => setSection('gear')}>{tr('admin_tab_inventory')}</button>
        </div>
      </section>

      {section === 'match' && (
        <section className="panel">
          <div className="panel-head"><h2>⚽ Gestion du Match</h2></div>
          {/* AJOUT DU FORMULAIRE COMPACT */}
          <AdminMatchSettings tr={tr} match={match} onUpdateMatch={onUpdateMatch} />
          <AdminMatchPanel
            tr={tr} lang={lang}
            match={match} teams={teams} matchGoals={matchGoals}
            motmResults={motmResults} players={players}
            onSaveScore={onSaveScore}
            onAddGoal={onAddGoal}
            onSetMatchPhoto={onSetMatchPhoto}
          />
        </section>
      )}

      {section === 'ann' && (
        <AdminAnnouncementsPanel
          tr={tr} lang={lang}
          announcements={announcements}
          onAdd={onAddAnnouncement}
          onDelete={onDeleteAnnouncement}
          onTogglePin={onTogglePin}
        />
      )}

      {section === 'plan' && (
        <AdminPlanningPanel
          tr={tr} lang={lang}
          calendar={calendar}
          onSchedule={onScheduleMatch}
          onDelete={onDeleteMatch}
        />
      )}

      {section === 'cash' && (
        <CaissePage
          tr={tr}
          fines={fines} caisse={caisse} players={players}
          onPay={onPay} onAddExpense={onAddExpense} onAddFine={onAddFine}
        />
      )}

      {section === 'gear' && (
        <AdminInventoryPanel
          tr={tr}
          inventory={inventory}
          onAdd={onAddInventoryItem}
          onUpdate={onUpdateInventoryItem}
          onDelete={onDeleteInventoryItem}
        />
      )}
    </>
  );
}

/* ========================================================
   ADMIN — MATCH PANEL : score + buteurs + photo + MotM
   ======================================================== */
function AdminMatchPanel({ tr, lang, match, teams, matchGoals, motmResults, players, onSaveScore, onAddGoal, onSetMatchPhoto }) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [goalPlayer, setGoalPlayer] = useState('');
  const [goalCount, setGoalCount] = useState(1);
  const [photoUrl, setPhotoUrl] = useState('');
  const [winnerTeam, setWinnerTeam] = useState('A');

  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      if (match?.team_a_score != null && String(match.team_a_score) !== scoreA) setScoreA(String(match.team_a_score));
      if (match?.team_b_score != null && String(match.team_b_score) !== scoreB) setScoreB(String(match.team_b_score));
      if (match?.photo_url && !photoUrl) setPhotoUrl(match.photo_url);
      if (match?.winner_team && match.winner_team !== winnerTeam) setWinnerTeam(match.winner_team);
    });
  }, [match, scoreA, scoreB, photoUrl, winnerTeam]);

  if (!match) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>{tr('admin_tab_match')}</h2></div>
        <p className="empty-row">{tr('admin_no_current')}</p>
      </section>
    );
  }

  const goalsByPlayer = Object.fromEntries((matchGoals || []).map(g => [g.player_id, g]));
  // Liste des joueurs sélectionnables pour les buteurs : titulaires des deux équipes si disponibles, sinon tous les joueurs
  const allCandidates = teams && teams.teams && teams.teams.length === 2
    ? [
        ...teams.teams[0].starters.map(p => ({ ...p, team: 'A' })),
        ...teams.teams[1].starters.map(p => ({ ...p, team: 'B' })),
      ]
    : (players || []).map(p => ({ ...p, team: '' }));

  const submitScore = (e) => {
    e.preventDefault();
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    onSaveScore(match.id, a, b);
  };

  const submitGoal = (e) => {
    e.preventDefault();
    if (!goalPlayer) return;
    const pid = parseInt(goalPlayer, 10);
    const existing = goalsByPlayer[pid]?.goals || 0;
    onAddGoal(match.id, pid, existing + parseInt(goalCount, 10), goalsByPlayer[pid]?.assists || 0);
    setGoalPlayer(''); setGoalCount(1);
  };

  const submitPhoto = (e) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;
    onSetMatchPhoto(match.id, photoUrl.trim(), winnerTeam);
  };

  // NOUVEAU : La magie qui compresse la photo
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // compresse pour le mobile
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoUrl(compressedBase64); // Stocke l'image compressée dans le state
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('admin_tab_match')} · {fmtShortDate(match.match_date, lang)}</h2></div>
        <p className="pp-intro">{tr('admin_match_intro')}</p>

        <h3 className="admin-subtitle">{tr('admin_match_score_title')}</h3>
        <form className="score-form" onSubmit={submitScore}>
          <div className="score-input">
            <label>{tr('team_a')}</label>
            <input type="number" min="0" max="99" value={scoreA} onChange={e => setScoreA(e.target.value)} placeholder="0" />
          </div>
          <div className="score-dash">—</div>
          <div className="score-input">
            <label>{tr('team_b')}</label>
            <input type="number" min="0" max="99" value={scoreB} onChange={e => setScoreB(e.target.value)} placeholder="0" />
          </div>
          <button type="submit" className="btn-primary">{tr('save_score')}</button>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h3>{tr('admin_match_goals_title')}</h3></div>
        <form className="inline-form" onSubmit={submitGoal}>
          <select value={goalPlayer} onChange={e => setGoalPlayer(e.target.value)}>
            <option value="">{tr('pick_player')}</option>
            {allCandidates.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.team ? ` (${p.team})` : ''}</option>
            ))}
          </select>
          <input type="number" min="1" max="10" value={goalCount} onChange={e => setGoalCount(e.target.value)} />
          <button className="btn-primary" type="submit">{tr('add_goal')}</button>
        </form>
        {(matchGoals || []).length === 0 ? (
          <p className="empty-row">{tr('no_goals_yet')}</p>
        ) : (
          <ul className="goals-list">
            {matchGoals.map(g => (
              <li key={g.id}>
                <span className="goal-icon">⚽</span>
                <span className="goal-name">{g.name}</span>
                <span className="goal-count">×{g.goals}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h3>{tr('admin_match_photo')}</h3></div>
        <form className="new-form" onSubmit={submitPhoto}>
          <label>{tr('admin_match_winner')}</label>
          <div className="winner-radio">
            <label className={`winner-pill ${winnerTeam === 'A' ? 'sel' : ''}`}>
              <input type="radio" name="winner" value="A" checked={winnerTeam === 'A'} onChange={() => setWinnerTeam('A')} />
              <span>🟢 {tr('winner_a')}</span>
            </label>
            <label className={`winner-pill ${winnerTeam === 'B' ? 'sel' : ''}`}>
              <input type="radio" name="winner" value="B" checked={winnerTeam === 'B'} onChange={() => setWinnerTeam('B')} />
              <span>🔴 {tr('winner_b')}</span>
            </label>
            <label className={`winner-pill ${winnerTeam === 'draw' ? 'sel' : ''}`}>
              <input type="radio" name="winner" value="draw" checked={winnerTeam === 'draw'} onChange={() => setWinnerTeam('draw')} />
              <span>🤝 {tr('winner_draw')}</span>
            </label>
          </div>
          
          {/* LE NOUVEAU BOUTON D'UPLOAD */}
          <label style={{ marginTop: 12 }}>Sélectionner une photo depuis la galerie</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            style={{ marginBottom: '10px', display: 'block' }}
          />
          <p className="hint-text">L'image sera automatiquement compressée pour ne pas saturer le serveur.</p>
          
          {photoUrl && (
            <div className="photo-preview" style={{ textAlign: 'center', marginBottom: '15px' }}>
              <img src={photoUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={!photoUrl.trim()}>{tr('admin_match_photo_save')}</button>
          </div>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h3>{tr('admin_match_motm_title')}</h3></div>
        {(!motmResults || motmResults.length === 0) ? (
          <p className="empty-row">{tr('admin_match_no_motm')}</p>
        ) : (
          <ol className="rank-list">
            {motmResults.slice(0, 5).map((r, i) => (
              <li key={r.id} className={`rank-${i + 1}`}>
                <span className="rank-n">{i + 1}</span>
                <div className="tile-avatar small">{r.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{r.name}</span>
                <span className="rank-stat">🏆 {r.votes}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

/* ========================================================
   ADMIN — ANNOUNCEMENTS PANEL
   ======================================================== */
function AdminAnnouncementsPanel({ tr, lang, announcements, onAdd, onDelete, onTogglePin }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await onAdd(body.trim(), title.trim() || null, pinned);
    setTitle(''); setBody(''); setPinned(false);
  };

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('publish_announcement')}</h2></div>
        <form className="new-form" onSubmit={submit}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr('ann_title_ph')} />
          <textarea
            className="ann-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={tr('ann_body_ph')}
            rows={4}
          />
          <label className="check-row">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            <span>📌 {tr('pin_label')}</span>
          </label>
          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={!body.trim()}>{tr('publish_btn')}</button>
          </div>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('manage_announcements')}</h2></div>
        {(!announcements || announcements.length === 0) ? (
          <p className="empty-row">{tr('ann_empty_admin')}</p>
        ) : (
          <ul className="ann-list">
            {announcements.map(a => (
              <li key={a.id} className={`ann-row ${a.pinned ? 'pinned' : ''}`}>
                <div className="ann-row-body">
                  {a.title && <strong className="ann-row-title">{a.title}</strong>}
                  <p className="ann-row-text">{a.body}</p>
                  <span className="ann-row-date">{fmtShortDate(a.created_at, lang)}</span>
                </div>
                <div className="ann-row-actions">
                  <button className="btn-ghost" onClick={() => onTogglePin(a)} title={tr('ann_pin_toggle')}>
                    {a.pinned ? '📌' : '📍'}
                  </button>
                  <button className="row-x" onClick={() => onDelete(a.id)}>🗑</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ========================================================
   ADMIN — PLANNING PANEL : programmer & supprimer matchs
   ======================================================== */
function AdminPlanningPanel({ tr, lang, calendar, onSchedule, onDelete }) {
  const [date, setDate] = useState('');
  const [kickoff, setKickoff] = useState('10:00');
  const [notes, setNotes] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!date) return;
    try {
      await onSchedule(date, kickoff || '10:00', notes.trim() || null);
      setDate(''); setKickoff('10:00'); setNotes('');
    } catch { /* géré par toast */ }
  };

  const statusLabel = (s) =>
    s === 'open'   ? tr('admin_plan_status_open')   :
    s === 'closed' ? tr('admin_plan_status_closed') :
    s === 'done'   ? tr('admin_plan_status_done')   : s;

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('admin_plan_create')}</h2></div>
        <p className="pp-intro">{tr('admin_plan_intro')}</p>
        <form className="new-form" onSubmit={submit}>
          <label>{tr('admin_plan_date')}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>{tr('admin_plan_kickoff')}</label>
          <input type="time" value={kickoff} onChange={e => setKickoff(e.target.value)} required />
          <label>{tr('admin_plan_notes')}</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('admin_plan_notes_ph')} />
          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={!date}>{tr('admin_plan_save')}</button>
          </div>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('admin_plan_list_title')}</h2></div>
        {(!calendar || calendar.length === 0) ? (
          <p className="empty-row">{tr('admin_plan_no_match')}</p>
        ) : (
          <table className="presences-table">
            <thead>
              <tr>
                <th>{tr('admin_plan_date')}</th>
                <th>{tr('admin_plan_kickoff')}</th>
                <th>{tr('admin_plan_status_lbl')}</th>
                <th>{tr('admin_plan_notes')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {calendar.map(m => (
                <tr key={m.id}>
                  <td>{fmtShortDate(m.match_date, lang)}</td>
                  <td>{(m.kickoff_local || '10:00').slice(0,5)}</td>
                  <td>
                    <span className={`badge ${m.status === 'done' ? 'badge-muted' : m.status === 'closed' ? 'badge-yellow' : 'badge-green'}`}>
                      {statusLabel(m.status)}
                    </span>
                  </td>
                  <td className="muted-txt">{m.notes || '—'}</td>
                  <td>
                    {m.status !== 'done' && (
                      <button className="row-x" onClick={() => onDelete(m.id)} title={tr('admin_plan_delete')}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function InventoryEditorModal({ tr, item, onClose, onSubmit }) {
  const [category, setCategory] = useState(item.category || '');
  const [name, setName] = useState(item.name || '');
  const [quantityTotal, setQuantityTotal] = useState(item.quantity_total || 0);
  const [quantityReady, setQuantityReady] = useState(item.quantity_ready || 0);
  const [storageLocation, setStorageLocation] = useState(item.storage_location || '');
  const [notes, setNotes] = useState(item.notes || '');

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small inventory-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{item.name}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <form className="new-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSubmit(item.id, {
              category,
              name,
              quantityTotal: Number(quantityTotal),
              quantityReady: Number(quantityReady),
              storageLocation,
              notes,
            });
            onClose();
          } catch {
            // The parent already surfaced the error through flash.
          }
        }}>
          <label>{tr('inventory_category')}</label>
          <input value={category} onChange={e => setCategory(e.target.value)} required />
          <label>{tr('inventory_name')}</label>
          <input value={name} onChange={e => setName(e.target.value)} required />
          <div className="inventory-form-grid compact">
            <div>
              <label>{tr('inventory_total')}</label>
              <input type="number" min="0" value={quantityTotal} onChange={e => setQuantityTotal(e.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_ready')}</label>
              <input type="number" min="0" max={quantityTotal} value={quantityReady} onChange={e => setQuantityReady(e.target.value)} required />
            </div>
          </div>
          <label>{tr('inventory_location')}</label>
          <input value={storageLocation} onChange={e => setStorageLocation(e.target.value)} />
          <label>{tr('inventory_notes')}</label>
          <textarea className="ann-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
            <button type="submit" className="btn-primary">{tr('inventory_save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminInventoryPanel({ tr, inventory, onAdd, onUpdate, onDelete }) {
  const [category, setCategory] = useState('Ballons');
  const [name, setName] = useState('');
  const [quantityTotal, setQuantityTotal] = useState(1);
  const [quantityReady, setQuantityReady] = useState(1);
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  const totalItems = inventory.length;
  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_total || 0), 0);
  const readyUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_ready || 0), 0);
  const alertCount = inventory.filter(item => Number(item.quantity_ready || 0) < Number(item.quantity_total || 0)).length;
  const readyRatio = totalUnits ? Math.round((readyUnits / totalUnits) * 100) : 100;

  const itemStatus = (item) => {
    const total = Number(item.quantity_total || 0);
    const ready = Number(item.quantity_ready || 0);
    if (ready <= 0) return { label: tr('inventory_status_missing'), className: 'badge badge-red' };
    if (ready < total) return { label: tr('inventory_status_warn'), className: 'badge badge-yellow' };
    return { label: tr('inventory_status_ok'), className: 'badge badge-green' };
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await onAdd({
        category,
        name,
        quantityTotal: Number(quantityTotal),
        quantityReady: Number(quantityReady),
        storageLocation,
        notes,
      });
      setName('');
      setQuantityTotal(1);
      setQuantityReady(1);
      setStorageLocation('');
      setNotes('');
    } catch {
      // The parent already surfaced the error through flash.
    }
  };

  return (
    <>
      <section className="panel admin-card inventory-hero">
        <div className="panel-head"><h2>{tr('inventory_title')}</h2></div>
        <p className="pp-intro">{tr('inventory_intro')}</p>
        <div className="inventory-stats">
          <div className="overview-chip"><strong>{totalItems}</strong><span>{tr('inventory_items_count')}</span></div>
          <div className="overview-chip"><strong>{totalUnits}</strong><span>{tr('inventory_units_count')}</span></div>
          <div className="overview-chip"><strong>{readyRatio}%</strong><span>{tr('inventory_ready_ratio')}</span></div>
          <div className="overview-chip"><strong>{alertCount}</strong><span>{tr('inventory_alert_count')}</span></div>
        </div>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('inventory_add')}</h2></div>
        <form className="inventory-form" onSubmit={submit}>
          <div className="inventory-form-grid">
            <div>
              <label>{tr('inventory_category')}</label>
              <input value={category} onChange={e => setCategory(e.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_name')}</label>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_total')}</label>
              <input type="number" min="0" value={quantityTotal} onChange={e => setQuantityTotal(e.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_ready')}</label>
              <input type="number" min="0" max={quantityTotal} value={quantityReady} onChange={e => setQuantityReady(e.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_location')}</label>
              <input value={storageLocation} onChange={e => setStorageLocation(e.target.value)} />
            </div>
            <div>
              <label>{tr('inventory_notes')}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="row-actions inventory-form-actions">
            <button type="submit" className="btn-primary" disabled={!category.trim() || !name.trim()}>{tr('inventory_add')}</button>
          </div>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('inventory_items_count')} · {totalItems}</h2></div>
        {inventory.length === 0 ? (
          <p className="empty-row">{tr('inventory_empty')}</p>
        ) : (
          <div className="inventory-grid">
            {inventory.map(item => {
              const status = itemStatus(item);
              return (
                <article key={item.id} className="inventory-card">
                  <div className="inventory-card-head">
                    <span className="inventory-category">{item.category}</span>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <div className="inventory-counts">
                    <div><strong>{item.quantity_ready}</strong><span>{tr('inventory_ready')}</span></div>
                    <div><strong>{item.quantity_total}</strong><span>{tr('inventory_total')}</span></div>
                  </div>
                  {item.storage_location && <p className="inventory-meta"><strong>{tr('inventory_location')}:</strong> {item.storage_location}</p>}
                  {item.notes && <p className="inventory-meta"><strong>{tr('inventory_notes')}:</strong> {item.notes}</p>}
                  <div className="inventory-actions">
                    <button className="btn-ghost" onClick={() => setEditingItem(item)} aria-label={tr('inventory_save')}>✎</button>
                    <button className="row-x" onClick={() => onDelete(item.id)} aria-label={tr('inventory_delete')}>🗑</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingItem && (
        <InventoryEditorModal
          tr={tr}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={onUpdate}
        />
      )}
    </>
  );
}

/* ========================================================
   CAISSE PAGE — solde + dépenses + amendes (+ amende manuelle)
   ======================================================== */
function CaissePage({ tr, fines, caisse, players, onPay, onAddExpense, onAddFine }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [showFineModal, setShowFineModal] = useState(false);

  const submitExpense = (e) => {
    e.preventDefault();
    if (!reason.trim() || !amount) return;
    onAddExpense(reason.trim(), Number(amount));
    setReason(''); setAmount('');
  };

  return (
    <>
      <section className="panel caisse-hero">
        <div className="panel-head"><h2>{tr('cash_balance')}</h2></div>
        <div className="caisse-balance">{Number(caisse?.balance || 0).toFixed(2)} €</div>
        <div className="caisse-grid">
          <div className="caisse-stat caisse-paid">
            <span className="cs-lbl">{tr('paid')}</span>
            <span className="cs-val">{Number(caisse?.paid_fines || 0).toFixed(2)} €</span>
          </div>
          <div className="caisse-stat caisse-due">
            <span className="cs-lbl">{tr('due')}</span>
            <span className="cs-val">{Number(caisse?.due_fines || 0).toFixed(2)} €</span>
          </div>
          <div className="caisse-stat caisse-exp">
            <span className="cs-lbl">{tr('expenses')}</span>
            <span className="cs-val">{Number(caisse?.expenses || 0).toFixed(2)} €</span>
          </div>
        </div>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('add_expense')}</h2></div>
        <form className="inline-form" onSubmit={submitExpense}>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('reason_ph')} />
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={tr('amount_ph')} />
          <button className="btn-primary" type="submit" disabled={!reason.trim() || !amount}>{tr('expense_btn')}</button>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head">
          <h2>{tr('fines')}</h2>
          <button className="btn-primary" onClick={() => setShowFineModal(true)}>{tr('manual_fine')}</button>
        </div>
        {(!fines || fines.length === 0) ? (
          <p className="empty-row">{tr('no_fines')}</p>
        ) : (
          <table className="presences-table">
            <thead>
              <tr>
                <th>{tr('th_player')}</th>
                <th>{tr('th_reason')}</th>
                <th>{tr('th_amount')}</th>
                <th>{tr('th_status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fines.map(f => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.reason}</td>
                  <td>{Number(f.amount).toFixed(2)} €</td>
                  <td>
                    {f.paid
                      ? <span className="badge badge-green">{tr('paid_badge')}</span>
                      : <span className="badge badge-red">{tr('due')}</span>}
                  </td>
                  <td>
                    {!f.paid && <button className="btn-ghost" onClick={() => onPay(f.id)}>{tr('mark_paid')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showFineModal && (
        <ManualFineModal
          tr={tr}
          players={players}
          onClose={() => setShowFineModal(false)}
          onSubmit={async (playerId, reason, amount) => {
            await onAddFine(playerId, reason, amount);
            setShowFineModal(false);
          }}
        />
      )}
    </>
  );
}

/* ========================================================
   MANUAL FINE MODAL — amende ajoutée à la main par l'admin
   ======================================================== */
function ManualFineModal({ tr, players, onClose, onSubmit }) {
  const [pid, setPid] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!pid || !reason.trim() || !amount) return;
    setBusy(true);
    try { await onSubmit(parseInt(pid, 10), reason.trim(), Number(amount)); }
    finally { setBusy(false); }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{tr('new_fine')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <form className="new-form" onSubmit={submit}>
          <label>{tr('th_player')}</label>
          <select value={pid} onChange={e => setPid(e.target.value)} required>
            <option value="">{tr('pick_one')}</option>
            {(players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label>{tr('th_reason')}</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('fine_reason_ph')} />
          <label>{tr('amount_eur')}</label>
          <input type="number" min="0" step="0.5" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2.00" />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy || !pid || !reason.trim() || !amount}>
              {busy ? '…' : tr('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================
   PUBLIC SECTIONS — annonces + galerie vainqueurs (avant footer)
   ======================================================== */
function PublicAnnouncementsSection({ tr, lang, announcements }) {
  return (
    <section className="panel public-ann">
      <div className="panel-head"><h2>{tr('public_ann_title')}</h2></div>
      {(!announcements || announcements.length === 0) ? (
        <p className="empty-row">{tr('public_ann_empty')}</p>
      ) : (
        <ul className="public-ann-list">
          {announcements.slice(0, 5).map(a => (
            <li key={a.id} className={`public-ann-row ${a.pinned ? 'pinned' : ''}`}>
              {a.pinned && <span className="pin-flag">📌</span>}
              {a.title && <strong className="public-ann-title">{a.title}</strong>}
              <p className="public-ann-body">{a.body}</p>
              <span className="public-ann-date">{fmtShortDate(a.created_at, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WinningGallerySection({ tr, lang, gallery }) {
  return (
    <section className="panel gallery-section">
      <div className="panel-head"><h2>{tr('gallery_title')}</h2></div>
      {(!gallery || gallery.length === 0) ? (
        <p className="empty-row">{tr('gallery_empty')}</p>
      ) : (
        <div className="gallery-grid">
          {gallery.map(g => {
            const winnerLabel =
              g.winner_team === 'A' ? tr('winner_a') :
              g.winner_team === 'B' ? tr('winner_b') :
              tr('winner_draw');
            return (
              <article key={g.id} className="gallery-card">
                <div className="gallery-photo">
                  <img src={g.photo_url} alt={`${tr('gallery_winner')} ${fmtShortDate(g.match_date, lang)}`} loading="lazy" />
                </div>
                <div className="gallery-meta">
                  <span className="gallery-date">{fmtShortDate(g.match_date, lang)}</span>
                  <span className="gallery-score">
                    {g.team_a_score ?? '–'} : {g.team_b_score ?? '–'}
                  </span>
                  <span className={`gallery-winner gallery-winner-${g.winner_team || 'draw'}`}>
                    🏆 {winnerLabel}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ========================================================
   MOTM SECTION — vote du joueur du jour (visible joueurs)
   ======================================================== */
function MotMSection({ tr, lang, match, attendees, players, results, lastWinner, currentUser, onRequireAuth, onVote }) {
  const [votedId, setVotedId] = useState('');
  const [busy, setBusy] = useState(false);
  const currentUserId = currentUser?.id || null;

  // Liste des votants potentiels = joueurs présents (non maybe/absent)
  const voters = (attendees || [])
    .filter(a => a.status !== 'maybe' && a.status !== 'absent')
    .map(a => {
      const p = (players || []).find(pp => pp.id === a.player_id);
      return { id: a.player_id, name: p?.name || a.name };
    });
  const currentVoter = currentUserId ? voters.find(v => v.id === currentUserId) : null;
  const candidates = voters.filter(v => v.id !== currentUserId);
  const totalVotes = (results || []).reduce((sum, row) => sum + Number(row.votes || 0), 0);
  const leader = results && results.length > 0 ? results[0] : null;

  useEffect(() => {
    if (!match?.id || !currentUserId) return;

    let cancelled = false;

    api.motmMyVote(match.id)
      .then((row) => {
        if (!cancelled) setVotedId(row?.voted_id ? String(row.voted_id) : '');
      })
      .catch(() => {
        if (!cancelled) setVotedId('');
      });

    return () => {
      cancelled = true;
    };
  }, [match?.id, currentUserId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!votedId) return;
    if (currentUser && parseInt(currentUser.id, 10) === parseInt(votedId, 10)) {
      alert(tr('motm_self_vote_err'));
      return;
    }
    setBusy(true);
    try { await onVote(parseInt(votedId, 10)); }
    finally { setBusy(false); }
  };

  if (!match) {
    return (
      <section className="panel motm-section">
        <div className="panel-head"><h2>{tr('motm_title')}</h2></div>
        <p className="empty-row">{tr('motm_locked_no_match')}</p>
        {lastWinner && lastWinner.player && (
          <div className="motm-last">
            <span>{tr('motm_last_winner')}</span>
            <strong> · {lastWinner.player.name}</strong>
            <span className="muted-txt"> · {fmtShortDate(lastWinner.match_date, lang)}</span>
          </div>
        )}
      </section>
    );
  }

  if (!voters.length) {
    return (
      <section className="panel motm-section">
        <div className="panel-head"><h2>{tr('motm_title')}</h2></div>
        <p className="empty-row">{tr('motm_locked_no_atts')}</p>
      </section>
    );
  }

  if (!currentUser) {
    return (
      <section className="panel motm-section">
        <div className="panel-head"><h2>{tr('motm_title')}</h2></div>
        <p className="pp-intro motm-copy">{tr('motm_intro')}</p>
        <div className="account-presence-banner motm-login-banner">
          <div>
            <strong>{tr('motm_login_hint')}</strong>
            <p className="muted-txt">{tr('auth_home_sub')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => onRequireAuth(null)}>{tr('auth_login_short')}</button>
        </div>
      </section>
    );
  }

  if (!currentVoter) {
    return (
      <section className="panel motm-section">
        <div className="panel-head"><h2>{tr('motm_title')}</h2></div>
        <p className="empty-row">{tr('motm_presence_required')}</p>
      </section>
    );
  }

  return (
    <section className="panel motm-section">
      <div className="panel-head"><h2>{tr('motm_title')}</h2></div>
      <div className="motm-hero">
        <div>
          <p className="pp-intro motm-copy">{tr('motm_intro')}</p>
          {totalVotes > 0 && <p className="motm-total-copy">{tr('motm_votes_total', { n: totalVotes })}</p>}
        </div>
        {leader && (
          <div className="motm-leader-card">
            <span>{tr('motm_live_leader')}</span>
            <strong>{leader.name}</strong>
            <em>🏆 {leader.votes} {leader.votes > 1 ? tr('motm_votes') : tr('motm_one_vote')}</em>
          </div>
        )}
      </div>
      <form className="motm-form" onSubmit={submit}>
        <div className="motm-field">
          <label>{tr('motm_vote_as')}</label>
          <div className="motm-current-user">{currentVoter.name}</div>
        </div>
        <div className="motm-field">
          <label>{tr('motm_pick_player')}</label>
          <select value={votedId} onChange={e => setVotedId(e.target.value)} required>
            <option value="">{tr('pick_one')}</option>
            {candidates.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary motm-submit" disabled={busy || !votedId}>{busy ? '…' : tr('motm_submit')}</button>
      </form>

      {results && results.length > 0 && (
        <div className="motm-results">
          <h3>{tr('motm_results')}</h3>
          <ol className="rank-list motm-rank-list">
            {results.slice(0, 3).map((r, i) => (
              <li key={r.id} className={`rank-${i + 1} motm-rank-card`}>
                <span className="rank-n">{i + 1}</span>
                <div className="tile-avatar small">{r.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{r.name}</span>
                <span className="rank-stat">🏆 {r.votes} {r.votes > 1 ? tr('motm_votes') : tr('motm_one_vote')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ========================================================
   LEGAL MODAL — Impressum / Datenschutz (DSGVO)
   ======================================================== */
function LegalModal({ tr, kind, onClose }) {
  const isPrivacy = kind === 'privacy';
  return (
    <div className="sheet-overlay legal-overlay" onClick={onClose}>
      <div className="sheet legal-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{isPrivacy ? tr('privacy_title') : tr('impressum_title')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <div className="legal-body">
          {!isPrivacy && (
            <>
              <p className="legal-intro">Conformément au § 5 TMG (Telemediengesetz) :</p>
              <h4>CamAS e.V. (Cameroonian Association of Stuttgart and Environs e.V.)</h4>
              <p><strong>Adresse :</strong> c/o IZ. Pfaffenwaldring 60, 70569 Stuttgart</p>
              
              <h4>Représentants légaux (Vorstand)</h4>
              <p>
                <strong>Président :</strong> Christian Siani<br />
                <strong>Secrétaire général :</strong> Serge Kenfack<br />
                <strong>Trésorier :</strong> Aurelien Ndjomo
              </p>
              
              <h4>Contact</h4>
              <p><strong>Email :</strong> <a href="mailto:info@camasev.com" className="footer-link">info@camasev.com</a></p>
              <p><strong>Email (Finances/Paypal) :</strong> <a href="mailto:finances@camasev.com" className="footer-link">finances@camasev.com</a></p>
              
              <h4>Enregistrement</h4>
              <p><strong>Registre des associations :</strong> Amtsgericht Stuttgart<br />
              <strong>Numéro d'enregistrement :</strong> VR 720697</p>
              
              <p><strong>Numéro fiscal :</strong> Finanzamt Stuttgart - Steuer-Nr. 99015/30302</p>

              <div className="legal-disclaimer">
                <strong>Responsabilité pour les contenus (Disclaimer) :</strong><br/>
                En tant que prestataire de services, nous sommes responsables de nos propres contenus sur ces pages selon les lois générales, conformément au § 7 al. 1 du TMG. Les informations fournies sur cette application sont destinées à l'organisation interne de la section sportive de la CamAS e.V.
              </div>
            </>
          )}
          {isPrivacy && (
            <>
              <p className="legal-intro">Déclaration de confidentialité (Datenschutzerklärung)</p>
              
              <h4>1. Responsable du traitement des données</h4>
              <p>L'organisme responsable du traitement des données sur cette plateforme est :<br/>
              <strong>SK Digital / CamAS e.V.</strong><br/>
              Email : <a href="mailto:info@camasev.com" className="footer-link">info@camasev.com</a></p>
              
              <h4>2. Collecte et finalité des données</h4>
              <p>L'application "CamAS Sport" est un outil interne. Les données collectées (noms, présences aux matchs, statistiques de jeu, suivi des amendes de retard) sont utilisées exclusivement pour l'organisation des activités sportives, la constitution des équipes et la gestion de la caisse de solidarité.</p>

              <h4>3. Transmission des données</h4>
              <p>Vos données personnelles ne sont ni vendues, ni transmises à des tiers à des fins commerciales. Elles sont accessibles uniquement aux membres de la section sportive et aux administrateurs de l'application.</p>

              <h4>4. Cookies et stockage local (Local Storage)</h4>
              <p>Pour des raisons techniques, cette application utilise le stockage local de votre appareil (ex: pour mémoriser votre choix de langue ou l'acceptation du bandeau d'information). Ce sont des données techniques strictement nécessaires au fonctionnement de l'application, aucune donnée de suivi publicitaire n'est utilisée.</p>

              <h4>5. Hébergement</h4>
              <p>L'application est hébergée sur des infrastructures cloud sécurisées. Les communications avec le serveur sont chiffrées (HTTPS).</p>

              <h4>6. Vos droits (RGPD / DSGVO)</h4>
              <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et de limitation du traitement de vos données. Pour toute demande concernant votre profil joueur, veuillez contacter le responsable de l'application ou envoyer un email à <a href="mailto:info@camasev.com" className="footer-link">info@camasev.com</a>.</p>
            </>
          )}
        </div>
        <div className="row-actions" style={{ padding: '12px 18px 4px' }}>
          <button className="btn-primary" onClick={onClose}>{tr('legal_close')}</button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   COOKIE BANNER (RGPD/DSGVO)
   ======================================================== */
function CookieBanner({ tr, onAccept, onMore }) {
  return (
    <div className="cookie-banner" role="dialog" aria-live="polite">
      <div className="cookie-content">
        <strong>{tr('cookie_title')}</strong>
        <p>{tr('cookie_text')}</p>
      </div>
      <div className="cookie-actions">
        <button className="btn-ghost" onClick={onMore}>{tr('cookie_more')}</button>
        <button className="btn-primary" onClick={onAccept}>{tr('cookie_accept')}</button>
      </div>
    </div>
  );
}

// ========================================================
// FORMULAIRE COMPACT — AdminMatchSettings
// ========================================================
function AdminMatchSettings({ tr, match, onUpdateMatch }) {

  const [date, setDate] = useState(match?.match_date ? match.match_date.slice(0, 10) : '');
  const [kickoff, setKickoff] = useState(match?.kickoff_local ? match.kickoff_local.slice(0, 5) : '10:00');
  const [notes, setNotes] = useState(match?.notes || '');
  const [busy, setBusy] = useState(false);
  const formKey = [
    match?.id || 'match',
    match?.match_date || '',
    match?.kickoff_local || DEFAULT_KICKOFF,
    match?.notes || '',
  ].join(':');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdateMatch({ match_date: date, kickoff_local: kickoff, notes });
    } finally {
      setBusy(false);
    }
  };

  if (!match) return null;

  return (
    <form key={formKey} className="compact-admin-form" onSubmit={handleSubmit}>
      <input className="compact-admin-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      <input className="compact-admin-time" type="time" value={kickoff} onChange={e => setKickoff(e.target.value)} required />
      <input className="compact-admin-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('admin_plan_notes_ph')} />
      <button type="submit" className="btn-primary" disabled={busy || !date || !kickoff}>{busy ? '…' : '💾'}</button>
    </form>
  );
}

// (fin du fichier)
