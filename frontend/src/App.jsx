import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
import { t, LANGS } from './i18n';
import { buildProfileAvatar } from './appShared';
import { PublicAnnouncementsSection, WinningGallerySection } from './PublicSections';
import './App.css';

const StadiumPage = lazy(() => import('./StadiumPage'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const HomePage = lazy(() => import('./HomePage'));
const PlayersPage = lazy(() => import('./PlayersPage'));
const StatsPage = lazy(() => import('./StatsPage'));

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

function MobileProfileMenu({ tr, currentUser, isAdmin, currentTab, tabs, onClose, onSelectTab, onOpenAdminLogin, onPlayerLogout, onAdminLogout }) {
  const menuTabs = [
    { id: 'account', icon: '👤', key: currentUser ? 'auth_profile' : 'auth_login_short', locked: false },
    ...tabs.map((tab) => ({ ...tab, locked: tab.adminOnly && !isAdmin })),
  ];

  return (
    <div className="sheet-overlay mobile-profile-menu-overlay" onClick={onClose}>
      <div className="sheet small mobile-profile-menu-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head mobile-profile-menu-head">
          <div className="mobile-profile-menu-title-wrap">
            <h3>{tr('auth_profile')}</h3>
            <p>{currentUser ? currentUser.name : tr('auth_account_cta')}</p>
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label={tr('cancel')}>✕</button>
        </div>

        <div className="mobile-profile-menu-body">
          <div className="mobile-profile-menu-identity">
            <img className="mobile-profile-menu-avatar" src={currentUser?.avatarUrl || buildProfileAvatar(currentUser?.name || 'CAMAS')} alt={tr('auth_profile')} />
            <div>
              <strong>{currentUser ? currentUser.name : tr('auth_account_cta')}</strong>
              <span>{currentUser ? tr('auth_connected_sub') : tr('auth_account_intro')}</span>
            </div>
          </div>

          <div className="mobile-profile-menu-list">
            {menuTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mobile-profile-menu-link ${currentTab === item.id ? 'active' : ''} ${item.locked ? 'locked' : ''}`}
                onClick={() => {
                  if (item.id === 'admin' && item.locked) {
                    onOpenAdminLogin();
                    return;
                  }
                  onSelectTab(item.id);
                }}
                title={item.locked ? tr('admin_locked') : ''}
              >
                <span className="mobile-profile-menu-icon">{item.icon}{item.locked ? ' 🔒' : ''}</span>
                <span>{tr(item.key)}</span>
              </button>
            ))}
          </div>

          <div className="mobile-profile-menu-actions">
            {currentUser ? (
              <button type="button" className="btn-ghost mobile-profile-menu-logout" onClick={onPlayerLogout}>{tr('auth_logout')}</button>
            ) : null}
            {isAdmin ? (
              <button type="button" className="btn-ghost mobile-profile-menu-logout" onClick={onAdminLogout}>{tr('admin_logout_btn')}</button>
            ) : null}
          </div>
        </div>
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

const LANG_KEY = 'camas_lang';

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

function computeAgeFromBirthDate(value = '') {
  const normalized = /^\d{2}\.\d{2}\.\d{4}$/.test(value)
    ? value.split('.').reverse().join('-')
    : value;
  const match = String(normalized).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const today = new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let age = today.getUTCFullYear() - year;

  if ((today.getUTCMonth() + 1) < month || ((today.getUTCMonth() + 1) === month && today.getUTCDate() < day)) {
    age -= 1;
  }

  return age;
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
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext('2d');
    context.drawImage(image, offsetX, offsetY, side, side, 0, 0, 256, 256);
    return canvas.toDataURL('image/jpeg', 0.78);
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
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const [isMobileProfileMenu, setIsMobileProfileMenu] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
  ));

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
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [registrations, setRegistrations] = useState([]);
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
    setMobileProfileMenuOpen(false);
    if (tab === 'admin') setTab('home');
    flash(tr('admin_logout'), 'ok');
  };

  const openAdminLogin = () => {
    setTab('admin');
    setMobileProfileMenuOpen(false);
    setAdminModalOpen(true);
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
    setMobileProfileMenuOpen(false);
    if (tab === 'account') setTab('home');
    flash(tr('auth_logout'), 'ok');
  };

  const goToTab = (nextTab) => {
    setMobileProfileMenuOpen(false);
    setTab(nextTab);
  };

  const handleAccountChipClick = () => {
    setMobileProfileMenuOpen((open) => !open);
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
      const [f, c, a, cal, inv, birthdays, regs] = await Promise.all([
        api.fines(), api.caisse(),
        api.listAnnouncements().catch(() => []),
        api.matchCalendar().catch(() => []),
        api.inventory().catch(() => []),
        api.birthdaysUpcoming().catch(() => []),
        api.adminRegistrations().catch(() => []),
      ]);
      setFines(f); setCaisse(c); setAnnouncements(a); setCalendar(cal); setInventory(inv); setUpcomingBirthdays(Array.isArray(birthdays) ? birthdays : []); setRegistrations(Array.isArray(regs) ? regs : []);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 720px)');
    const syncViewport = (event) => {
      setIsMobileProfileMenu(event.matches);
      if (!event.matches) setMobileProfileMenuOpen(false);
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncViewport);
      return () => media.removeEventListener('change', syncViewport);
    }

    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!mobileProfileMenuOpen) return;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileProfileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileProfileMenuOpen]);

  const visibleTabs = TABS_BASE; // on les affiche toutes — caisse devient verrouillée si non-admin

  return (
    <div className="app">
      <div className="tablet">
        {/* HEADER */}
        <header className="header">
          <div className="logo-circle">
            <img src={logoCamas} alt="CAMAS e.V." width="64" height="64" decoding="async" fetchPriority="high" />
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
                  onClick={() => {
                    if (tt.id === 'admin' && !isAdmin) {
                      openAdminLogin();
                      return;
                    }
                    setTab(tt.id);
                  }}
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

            <button className={`account-chip ${tab === 'account' || mobileProfileMenuOpen ? 'active' : ''} mobile-menu-trigger ${isMobileProfileMenu && !currentUser ? 'guest-menu-trigger' : ''}`} onClick={handleAccountChipClick}>
              <span className="account-chip-avatar-shell">
                <img className="account-chip-avatar" src={profileAvatarSrc} alt={tr('auth_profile')} />
              </span>
              <span className="account-chip-copy">
                <span className="account-chip-label">{tr('auth_profile')}</span>
                {(!isMobileProfileMenu || currentUser) ? <strong>{currentUser ? currentUser.name.split(' ')[0] : tr('auth_account_cta')}</strong> : null}
              </span>
              <span className="account-chip-burger" aria-hidden="true">{mobileProfileMenuOpen ? '✕' : '☰'}</span>
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
            <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
              <HomePage
                tr={tr} lang={lang}
                currentUser={currentUser}
                birthdaysToday={birthdaysToday}
                match={match} attendees={attendees} players={players} scorers={scorers} attStats={attStats} setSelectedPlayerCard={setSelectedPlayerCard} lastMatch={lastMatch}
                motmResults={motmResults} motmLast={motmLast}
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
            </Suspense>
          )}

          {tab === 'players' && (
            <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
              <PlayersPage
                tr={tr}
                isAdmin={isAdmin}
                currentUser={currentUser}
                players={players}
                attendees={attendees}
                onReload={loadHome}
                flash={flash}
                onRequireAuth={openAccountPage}
              />
            </Suspense>
          )}

          {tab === 'account' && (
            <AccountPage
              key={currentUser?.id || 'guest'}
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
                await Promise.all([loadHome(), loadStats()]);
                flash(tr('auth_profile_saved'), 'ok');
                return user;
              }}
              onLogout={onPlayerLogout}
              onGoHome={() => goToTab('home')}
            />
          )}

          {tab === 'teams' && (
            <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
              <StadiumPage
                tr={tr} lang={lang} isAdmin={isAdmin}
                teams={teams} match={match} goals={matchGoals} attendees={attendees}
                onReload={loadTeams}
                onSetPosition={async (playerId, position) => {
                  try { await api.updatePosition(playerId, match.id, position); loadTeams(); loadHome(); }
                  catch (e) { flash(e.message, 'err'); }
                }}
              />
            </Suspense>
          )}

          {tab === 'stats' && (
            <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
              <StatsPage
                tr={tr}
                scorers={scorers}
                attendance={attStats}
                isAdmin={isAdmin}
                matchId={match?.id}
                onRevokeAttendance={async (playerId) => {
                  if (!match?.id) {
                    flash(tr('admin_no_current'), 'warn');
                    return;
                  }
                  if (!confirm(tr('admin_stats_revoke_confirm'))) return;
                  try {
                    await api.adminRevokeAttendance(playerId, match.id);
                    await Promise.all([loadHome(), loadStats()]);
                    flash(tr('admin_stats_revoke_ok'), 'ok');
                  } catch (e) {
                    flash(e.message, 'err');
                  }
                }}
              />
            </Suspense>
          )}

          {tab === 'admin' && (
            isAdmin ? (
              <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
                <AdminDashboard
                tr={tr} lang={lang}
                announcements={announcements} fines={fines} caisse={caisse}
                players={players} match={match} motmResults={motmResults}
                teams={teams} matchGoals={matchGoals} calendar={calendar} inventory={inventory} upcomingBirthdays={upcomingBirthdays}
                registrations={registrations}
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
                onRevokeRegistration={async (playerId) => {
                  if (!confirm(tr('admin_revoke_confirm'))) return;
                  try {
                    await api.adminRevokeRegistration(playerId);
                    await Promise.all([loadAdmin(), loadHome(), loadStats()]);
                    flash(tr('admin_revoke_ok'), 'ok');
                  } catch (e) {
                    flash(e.message, 'err');
                  }
                }}
                onUpdateMatch={onUpdateMatch}
                />
              </Suspense>
            ) : (
              <LockedSection tr={tr} onUnlock={openAdminLogin} />
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

      {mobileProfileMenuOpen && (
        <MobileProfileMenu
          tr={tr}
          currentUser={currentUser}
          isAdmin={isAdmin}
          currentTab={tab}
          tabs={visibleTabs}
          onClose={() => setMobileProfileMenuOpen(false)}
          onSelectTab={goToTab}
          onOpenAdminLogin={openAdminLogin}
          onPlayerLogout={onPlayerLogout}
          onAdminLogout={onAdminLogout}
        />
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
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileName, setProfileName] = useState(() => currentUser?.name || '');
  const [profilePronoun, setProfilePronoun] = useState(() => currentUser?.pronoun || '');
  const [profileBirthDate, setProfileBirthDate] = useState(() => formatBirthDateDisplay(currentUser?.birthDate || ''));
  const [profileEmail, setProfileEmail] = useState(() => currentUser?.email || '');
  const [profilePhone, setProfilePhone] = useState(() => currentUser?.phone || '');
  const [profileStats, setProfileStats] = useState(null);
  const [profileStatsBusy, setProfileStatsBusy] = useState(() => !!currentUser);
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

  useEffect(() => {
    let cancelled = false;

    if (!currentUser) {
      return undefined;
    }

    api.playerProfile(currentUser.id)
      .then((data) => {
        if (!cancelled) setProfileStats(data);
      })
      .catch(() => {
        if (!cancelled) setProfileStats(null);
      })
      .finally(() => {
        if (!cancelled) setProfileStatsBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

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

  const submitConnectedProfile = async (event) => {
    event.preventDefault();
    if (!isBirthDateComplete(profileBirthDate)) {
      setFeedback(tr('auth_birth_date_invalid'));
      return;
    }

    setProfileBusy(true);
    setFeedback('');
    try {
      const user = await onUpdateProfile({
        name: profileName,
        pronoun: profilePronoun,
        birthDate: profileBirthDate,
        email: profileEmail,
        phone: profilePhone,
      });
      setProfileName(user.name || '');
      setProfilePronoun(user.pronoun || '');
      setProfileBirthDate(formatBirthDateDisplay(user.birthDate || ''));
      setProfileEmail(user.email || '');
      setProfilePhone(user.phone || '');
      setProfileStats((current) => (current ? { ...current, name: user.name } : current));
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setProfileBusy(false);
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
    const connectedAge = computeAgeFromBirthDate(currentUser.birthDate || '');

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
              <div className="overview-chip"><strong>{connectedAge ?? '—'}</strong><span>{tr('auth_age')}</span></div>
              <div className="overview-chip"><strong>{currentUser.email || '—'}</strong><span>{tr('auth_email')}</span></div>
              <div className="overview-chip"><strong>{currentUser.phone || '—'}</strong><span>{tr('auth_phone')}</span></div>
            </div>
            <div className="account-profile-stack">
              <form className="account-card account-card-profile" onSubmit={submitConnectedProfile}>
                <div className="account-card-head">
                  <h3>{tr('auth_profile_edit_title')}</h3>
                  <p>{tr('auth_profile_edit_intro')}</p>
                </div>
                <div className="account-form-grid">
                  <div>
                    <label>{tr('auth_name')}</label>
                    <input value={profileName} onChange={e => setProfileName(e.target.value)} required />
                  </div>
                  <div>
                    <label>{tr('auth_pronoun')}</label>
                    <input value={profilePronoun} onChange={e => setProfilePronoun(e.target.value)} required />
                  </div>
                  <div>
                    <label>{tr('auth_birth_date')}</label>
                    <input type="text" inputMode="numeric" value={profileBirthDate} placeholder={tr('auth_birth_date_ph')} onChange={e => setProfileBirthDate(formatBirthDateInput(e.target.value))} required />
                  </div>
                  <div>
                    <label>{tr('auth_phone')}</label>
                    <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} required />
                  </div>
                  <div className="account-form-span-2">
                    <label>{tr('auth_email')}</label>
                    <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} required />
                  </div>
                </div>
                <button type="submit" className="btn-primary account-submit" disabled={profileBusy}>{profileBusy ? '…' : tr('auth_profile_save')}</button>
              </form>

              <section className="account-actions-card account-tracking-card">
                <div className="account-card-head">
                  <h3>{tr('auth_profile_tracking_title')}</h3>
                  <p>{tr('auth_profile_tracking_intro')}</p>
                </div>
                {profileStatsBusy ? (
                  <p>{tr('auth_profile_tracking_loading')}</p>
                ) : profileStats ? (
                  <div className="account-tracking-grid">
                    <div className="overview-chip"><strong>{profileStats.goals}</strong><span>{tr('auth_profile_stat_goals')}</span></div>
                    <div className="overview-chip"><strong>{profileStats.assists}</strong><span>{tr('auth_profile_stat_assists')}</span></div>
                    <div className="overview-chip"><strong>{profileStats.shows}</strong><span>{tr('auth_profile_stat_presence')}</span></div>
                    <div className="overview-chip"><strong>{profileStats.punctuality}%</strong><span>{tr('auth_profile_stat_punctuality')}</span></div>
                    <div className="overview-chip"><strong>{profileStats.motm_wins}</strong><span>{tr('auth_profile_stat_motm')}</span></div>
                    <div className="overview-chip"><strong>{Number(profileStats.due_amount || 0).toFixed(2)}€</strong><span>{tr('auth_profile_stat_due')}</span></div>
                  </div>
                ) : (
                  <p>{tr('auth_profile_tracking_loading')}</p>
                )}
              </section>
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

// (fin du fichier)
