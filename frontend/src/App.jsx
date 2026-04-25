import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import logoCamas from './assets/logo-camas.jpeg';
import { api, getAdminCode, setAdminCode, clearAdminCode } from './api';
import { t, LANGS, localeFor } from './i18n';
import './App.css';

/* ========================================================
   PLAYER CARD MODAL — Carte joueur premium (style FUT)
   Charge le profil agrégé depuis /api/players/:id/profile
   ======================================================== */

/* ========================================================
   PLAYER CARD MODAL (FUT) + CHANGEMENT DE PIN
   ======================================================== */
function PlayerCardModal({ player, onClose }) {
  const [editPin, setEditPin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);

  const punct = player.shows ? Math.round(((player.shows - player.lates) / player.shows) * 100) : 0;

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (oldPin.length !== 4 || newPin.length !== 4) return alert("Les codes doivent faire 4 chiffres.");
    setBusy(true);
    try {
      // Appel à l'API pour changer le PIN
      await api.updatePin(player.id, oldPin, newPin);
      alert("✅ Code PIN modifié avec succès !");
      setEditPin(false);
      setOldPin('');
      setNewPin('');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

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

          {/* VUE 2 : LE FORMULAIRE DE CHANGEMENT DE PIN */}
          {editPin ? (
            <form className="pin-fut-form" onSubmit={handleUpdatePin}>
              <p className="pin-fut-title">Modifier mon code secret</p>
              <input type="password" placeholder="Ancien (ex: 1234)" maxLength="4" inputMode="numeric" value={oldPin} onChange={e => setOldPin(e.target.value)} />
              <input type="password" placeholder="Nouveau PIN" maxLength="4" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)} />
              <div className="row-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditPin(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={busy || oldPin.length < 4 || newPin.length < 4}>Valider</button>
              </div>
            </form>
          ) : (
            <>
              <div className="fut-stats-grid">
                <div className="fut-stat"><span>{player.goals || 0}</span> BUT</div>
                <div className="fut-stat"><span>{player.assists || 0}</span> PAS</div>
                <div className="fut-stat"><span>{player.shows || 0}</span> PRS</div>
                <div className="fut-stat"><span>{punct}%</span> PCT</div>
              </div>
              <button className="fut-pin-toggle" onClick={() => setEditPin(true)}>
                🔒 Modifier mon code PIN
              </button>
            </>
          )}

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

export default function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'fr'; } catch { return 'fr'; }
  });
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminCode());
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [tab, setTab] = useState('home');
  const [players, setPlayers] = useState([]);
  const [match, setMatch] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [lastMatch, setLastMatch] = useState(null);
  const [teams, setTeams] = useState(null);
  const [scorers, setScorers] = useState([]);
  const [attStats, setAttStats] = useState([]);
  const [matchGoals, setMatchGoals] = useState([]);
  const [fines, setFines] = useState([]);
  const [caisse, setCaisse] = useState({ paid_fines: 0, due_fines: 0, expenses: 0, balance: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const [motmResults, setMotmResults] = useState([]);
  const [motmLast, setMotmLast] = useState(null);
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

  const acceptCookies = () => {
    try { localStorage.setItem('camas_cookie_ack', '1'); } catch { /* ignore */ }
    setCookieAck(true);
    api.recordConsent('cookies', true).catch(() => { /* best effort */ });
  };

  const loadHome = useCallback(async () => {
    try {
      const [m, ps, last, anns, ml] = await Promise.all([
        api.currentMatch(), api.listPlayers(), api.lastMatch(),
        api.listAnnouncements().catch(() => []),
        api.motmLast().catch(() => null),
      ]);
      setMatch(m.match); setAttendees(m.attendees); setPlayers(ps); setLastMatch(last);
      setAnnouncements(anns); setMotmLast(ml);
      // Load MotM results for current match
      if (m.match?.id) {
        try { const r = await api.motmResults(m.match.id); setMotmResults(r); } catch { /* ignore */ }
      }
    } catch (e) { console.warn(e); }
  }, []);

  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [f, c, a] = await Promise.all([
        api.fines(), api.caisse(),
        api.listAnnouncements().catch(() => []),
      ]);
      setFines(f); setCaisse(c); setAnnouncements(a);
    } catch (e) { console.warn(e); }
  }, [isAdmin]);

  const loadTeams = useCallback(async () => {
    if (!match) return;
    try {
      const [t, g] = await Promise.all([api.teams(match.id), api.matchGoals(match.id)]);
      setTeams(t); setMatchGoals(g);
    } catch (e) { console.warn(e); }
  }, [match]);

  const loadStats = useCallback(async () => {
    const [s, a] = await Promise.all([api.scorers(), api.attendanceStats()]);
    setScorers(s); setAttStats(a);
  }, []);

  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      loadHome();
      loadStats();
    });
  }, [loadHome, loadStats]);

  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      if (tab === 'teams') loadTeams();
      else if (tab === 'stats') loadStats();
      else if (tab === 'admin' && isAdmin) loadAdmin();
    });
  }, [tab, loadTeams, loadStats, loadAdmin, isAdmin]);

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
              match={match} attendees={attendees} players={players} scorers={scorers} attStats={attStats} setSelectedPlayerCard={setSelectedPlayerCard} lastMatch={lastMatch}
              announcements={announcements} motmResults={motmResults} motmLast={motmLast}
              onConfirm={async (pid, intent, position, pin) => {
                try {
                  // On passe le PIN à l'API
                  const r = await api.vote(pid, intent, position, pin);
                  if (intent === 'yes') flash(r.late ? tr('presence_late') : tr('presence_ok'), r.late ? 'warn' : 'ok');
                  else if (intent === 'maybe') flash(tr('maybe_ok'), 'warn');
                  else flash(tr('absent_ok'), 'err');
                  loadHome();
                } catch (e) { flash(e.message, 'err'); }
              }}
              onUnvote={async (pid) => {
                try { await api.unvote(pid, match.id); flash(tr('presence_cancel')); loadHome(); }
                catch (e) { flash(e.message, 'err'); }
              }}
              onCreatePlayer={async (name, rating) => {
                try { const p = await api.createPlayer({ name, rating }); await loadHome(); flash(tr('player_added', { name: p.name })); return p; }
                catch (e) { flash(e.message, 'err'); throw e; }
              }}
              onMotmVote={async (voterId, votedId) => {
                try { await api.motmVote(match.id, voterId, votedId); flash(tr('motm_recorded'), 'ok'); const r = await api.motmResults(match.id); setMotmResults(r); }
                catch (e) { flash(e.message, 'err'); }
              }}
            />
          )}

          {tab === 'players' && <PlayersPage tr={tr} isAdmin={isAdmin} players={players} attendees={attendees} onReload={loadHome} flash={flash} />}

          {tab === 'teams' && (
            <StadiumPage
              tr={tr} isAdmin={isAdmin}
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
                tr={tr}
                announcements={announcements} fines={fines} caisse={caisse}
                players={players} match={match} motmResults={motmResults}
                onAddAnnouncement={async (body, title, pinned) => {
                  try { await api.addAnnouncement({ body, title, pinned }); loadAdmin(); loadHome(); flash('✅', 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
                onDeleteAnnouncement={async (id) => {
                  if (!confirm('Supprimer cette annonce ?')) return;
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
                onLogout={onAdminLogout}
                // Ajout de la prop onUpdateMatch
                onUpdateMatch={async (id, data) => {
                  try { await api.updateMatch(id, data); loadHome(); flash('Match mis à jour !', 'ok'); }
                  catch (e) { flash(e.message, 'err'); }
                }}
              />
            ) : (
              <LockedSection tr={tr} onUnlock={() => setAdminModalOpen(true)} />
            )
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

/* ========================================================
   HOME / DASHBOARD
   ======================================================== */
function HomePage({ tr, lang, match, attendees, players, scorers, attStats, setSelectedPlayerCard, lastMatch, onConfirm, onUnvote, onCreatePlayer }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const topScorer = scorers.find(s => s.goals > 0) || scorers[0];

  // Toujours 11 vs 11 — la logique de format auto a été retirée à la demande.
  const fmt = { type: tr('stadium'), format: '11 vs 11' };

  const yesCount = attendees.filter(a => a.status !== 'maybe' && a.status !== 'absent').length;
  const maybeCount = attendees.filter(a => a.status === 'maybe').length;

  const statusPill = (a) => {
    if (a.status === 'maybe') return <span className="badge badge-yellow">{tr('status_maybe')}</span>;
    if (a.status === 'absent') return <span className="badge badge-red">{tr('status_absent')}</span>;
    if (a.is_late) return <span className="badge badge-red">{tr('status_late')}</span>;
    return <span className="badge badge-green">{tr('status_confirmed')}</span>;
  };

  return (
    <>
      {lastMatch && <LastMatchCard tr={tr} lang={lang} lastMatch={lastMatch} />}

      {/* Annonces du responsable (lecture publique) */}
      {/* <AnnouncementsFeed tr={tr} lang={lang} announcements={announcements} /> */}
      {/* Vote « Joueur du jour » */}
      {/* <MotMSection
        tr={tr} lang={lang}
        match={match} attendees={attendees} players={players}
        results={motmResults} lastWinner={motmLast}
        onVote={onMotmVote}
      /> */}
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
              {attendees.length === 0 && (
                <tr><td colSpan="5" className="empty-row">{tr('no_attendance')}</td></tr>
              )}
              {attendees.map(a => (
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
                  <td><button className="row-x" onClick={() => onUnvote(a.player_id)} title={tr('cancel')}>✕</button></td>
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
          <p className="kickoff">{tr('kickoff')} <strong>10:00</strong> · {match ? fmtDate(match.match_date, lang) : '…'}</p>

          <div className="info-box info-yellow">
            <p>{tr('meeting_at')} : <strong>09:45</strong></p>
            <p className="sub">{tr('meeting_sub')}</p>
          </div>

          <div className="intent-grid">
            <button className="intent-btn intent-yes" onClick={() => setPickerOpen('yes')}>
              <span className="intent-emoji">⚽</span>
              <span className="intent-lbl">{tr('vote_yes')}</span>
            </button>
            <button className="intent-btn intent-maybe" onClick={() => setPickerOpen('maybe')}>
              <span className="intent-emoji">🤔</span>
              <span className="intent-lbl">{tr('vote_maybe')}</span>
            </button>
            <button className="intent-btn intent-no" onClick={() => setPickerOpen('no')}>
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
            <p className="sub">{tr('late_fine_sub')}</p>
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

      {pickerOpen && (
        <PlayerPicker
          tr={tr}
          intent={pickerOpen}
          players={players}
          attendees={attendees}
          onConfirm={async (pid, intent, position, pin) => { await onConfirm(pid, intent, position, pin); setPickerOpen(false); }}
          onCreate={async (name, rating) => await onCreatePlayer(name, rating)}
          onClose={() => setPickerOpen(false)}
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

/* ========================================================
   PLAYER PICKER (intent-aware)
   ======================================================== */

/* ========================================================
   PLAYER PICKER (SÉCURISÉ AVEC CODE PIN)
   ======================================================== */
function PlayerPicker({ tr, intent, players, attendees, onConfirm, onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const needsPosition = intent === 'yes';
  const [mode, setMode] = useState('pick'); // pick | new | position | pin
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');
  const [position, setPosition] = useState(null);
  const [pin, setPin] = useState(''); // Le code secret saisi pour valider la présence

  const submit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const p = await onCreate(newName.trim(), 5);
      setSelected(p);
      setMode('pin');
    } catch { /* silent */ }
  };

  const voted = new Set(attendees.map(a => a.player_id));
  const filtered = useMemo(() => players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [players, search]);

  const choosePlayer = (p) => {
    setSelected(p);
    setMode('pin');
  };

  const headTitle =
    mode === 'pick'      ? tr('who_confirms') :
    mode === 'new'       ? tr('new_player')   :
    mode === 'position'  ? tr('pick_position', { name: selected?.name || '' }) :
    mode === 'pin'       ? tr('pin_title') :
    '';

  const intentBadgeClass = intent === 'yes' ? 'intent-badge-yes' : intent === 'maybe' ? 'intent-badge-maybe' : intent === 'changepin' ? 'intent-badge-pin' : 'intent-badge-no';
  const intentBadgeLbl = intent === 'yes' ? `⚽ ${tr('vote_yes')}` : intent === 'maybe' ? `🤔 ${tr('vote_maybe')}` : `❌ ${tr('vote_no')}`;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{headTitle}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <div className={`intent-badge ${intentBadgeClass}`}>{intentBadgeLbl}</div>

        {mode === 'pick' && (
          <>
            <input className="search" placeholder={tr('search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div className="player-grid">
              {filtered.map(p => {
                // En flux changepin, on N'EXCLUT PAS les joueurs déjà inscrits (un joueur peut toujours modifier son PIN).
                const blocked = !needsPosition && voted.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`player-tile ${blocked ? 'disabled' : ''}`}
                    disabled={blocked}
                    onClick={() => choosePlayer(p)}
                  >
                    <div className="tile-avatar">{p.name.slice(0, 1).toUpperCase()}</div>
                    <span>{p.name}</span>
                    {!needsPosition && voted.has(p.id) && <span className="mini-tag">✓</span>}
                  </button>
                );
              })}
              {!needsPosition && (
                <button className="player-tile add" onClick={() => setMode('new')}>
                  <div className="tile-avatar plus">+</div>
                  <span>{tr('new_player')}</span>
                </button>
              )}
            </div>
          </>
        )}

        {mode === 'new' && (
          <form className="new-form" onSubmit={submit}>
            <label>{tr('full_name')}</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Ex: Samuel Djommou" />
            <div className="row-actions">
              <button type="button" className="btn-ghost" onClick={() => setMode('pick')}>{tr('back')}</button>
              <button type="submit" className="btn-primary">{tr('next')}</button>
            </div>
          </form>
        )}

        {mode === 'position' && selected && (
          <div className="position-picker">
            <p className="pp-intro">{tr('position_intro')}</p>
            <div className="position-grid">
              {POSITIONS.map(p => (
                <button key={p.code} type="button" className={`pos-card pos-card-${p.code} ${position === p.code ? 'selected' : ''}`} onClick={() => setPosition(p.code)}>
                  <span className="pos-code">{p.code}</span><span className="pos-name">{tr(p.key)}</span>
                </button>
              ))}
            </div>
            <div className="row-actions">
              <button className="btn-ghost" onClick={() => setMode('pick')}>{tr('back')}</button>
              <button className="btn-primary" disabled={!position} onClick={() => setMode('pin')}>{tr('next')}</button>
            </div>
          </div>
        )}

        {/* ÉTAPE : LE CODE PIN — validation de présence */}
        {mode === 'pin' && selected && (
          <form className="new-form" onSubmit={(e) => { e.preventDefault(); onConfirm(selected.id, intent, position, pin); }}>
            <p className="pp-intro">{tr('pin_intro')}</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="pin-input"
            />
            <div className="row-actions">
              <button type="button" className="btn-ghost" onClick={() => needsPosition ? setMode('position') : setMode('pick')}>{tr('back')}</button>
              <button type="submit" className="btn-primary" disabled={pin.length < 4}>{tr('pin_validate')}</button>
            </div>
          </form>
        )}

        {/* ÉTAPE : CHANGEMENT DE CODE PIN — accessible depuis flux dédié OU étape pin */}
        {/* Bloc supprimé : mode === 'changepin' && selected && ... */}
      </div>
    </div>
  );
}

/* ========================================================
   PLAYERS PAGE
   ======================================================== */
function PlayersPage({ tr, isAdmin, players, attendees, onReload, flash }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const presentIds = new Set(attendees.filter(a => a.status !== 'maybe' && a.status !== 'absent').map(a => a.player_id));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.createPlayer({ name: name.trim(), rating: Number(rating) }); setName(''); setRating(5); setAdding(false); onReload(); flash(tr('player_added', { name: name.trim() })); }
    catch (e) { flash(e.message, 'err'); }
  };
  const updateRating = async (p, v) => { try { await api.updatePlayer(p.id, { rating: Number(v) }); onReload(); } catch (e) { flash(e.message, 'err'); } };
  const remove = async (p) => { if (!confirm(tr('delete_confirm', { name: p.name }))) return; try { await api.deletePlayer(p.id); onReload(); flash(tr('player_removed')); } catch (e) { flash(e.message, 'err'); } };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{tr('manage_players')}</h2>
        <button className="btn-primary" onClick={() => setAdding(a => !a)}>{adding ? tr('cancel') : tr('add_btn')}</button>
      </div>
      {adding && (
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
        <table className="presences-table">
          <thead><tr><th>{tr('th_name')}</th><th>{tr('th_level')}</th><th>{tr('th_sunday')}</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
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
                <td>{presentIds.has(p.id) ? <span className="badge badge-green">{tr('status_confirmed')}</span> : <span className="badge badge-muted">—</span>}</td>
                {isAdmin && (
                  <td><button className="row-x" onClick={() => remove(p)}>🗑</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ========================================================
   STADIUM PAGE
   ======================================================== */
function StadiumPage({ tr, isAdmin, teams, match, goals, onReload, onSaveScore, onAddGoal, onSetPosition }) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [goalPlayer, setGoalPlayer] = useState('');
  const [goalCount, setGoalCount] = useState(1);

  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      if (match?.team_a_score != null && String(match.team_a_score) !== scoreA) setScoreA(String(match.team_a_score));
      if (match?.team_b_score != null && String(match.team_b_score) !== scoreB) setScoreB(String(match.team_b_score));
    });
  }, [match, scoreA, scoreB]);

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

  const saveScore = (e) => {
    e.preventDefault();
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    onSaveScore(a, b);
  };

  const addGoal = (e) => {
    e.preventDefault();
    if (!goalPlayer) return;
    const pid = parseInt(goalPlayer, 10);
    const existing = goalsByPlayer[pid]?.goals || 0;
    onAddGoal(pid, existing + parseInt(goalCount, 10), goalsByPlayer[pid]?.assists || 0);
    setGoalPlayer(''); setGoalCount(1);
  };


  // Génération du message WhatsApp — i18n FR/DE
  const shareToWhatsApp = () => {
    if (!teamA || !teamB) return;
    const fmt = teams?.format?.format || '';

    let msg = `${tr('wa_title')}\n\n`;
    msg += `${tr('wa_meet')}\n`;
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

    msg += tr('wa_warn_late');

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  const allStarters = [...teamA.starters.map(p => ({ ...p, team: 'A' })), ...teamB.starters.map(p => ({ ...p, team: 'B' }))];

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

        <Pitch tr={tr} isAdmin={isAdmin} teamA={teamA.starters} teamB={teamB.starters} goalsByPlayer={goalsByPlayer} onSetPosition={onSetPosition} />
      </section>

      {/* SCORE + BUTEURS — admin only */}
      {isAdmin ? (
        <section className="panel">
          <div className="panel-head"><h2>{tr('match_result')}</h2></div>

          <form className="score-form" onSubmit={saveScore}>
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

          <div className="goals-block">
            <h3>{tr('buteurs')}</h3>
            <form className="inline-form" onSubmit={addGoal}>
              <select value={goalPlayer} onChange={e => setGoalPlayer(e.target.value)}>
                <option value="">{tr('pick_player')}</option>
                {allStarters.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.team})</option>
                ))}
              </select>
              <input type="number" min="1" max="10" value={goalCount} onChange={e => setGoalCount(e.target.value)} />
              <button className="btn-primary" type="submit">{tr('add_goal')}</button>
            </form>
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
      ) : (
        <section className="panel locked-inline">
          <div className="locked-icon-sm">🔒</div>
          <p>{tr('admin_locked_hint')}</p>
        </section>
      )}

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
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>{tr('top_scorers_season')}</h2></div>
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
   ADMIN DASHBOARD — sous-sections Annonces / MotM / Caisse
   ======================================================== */
function AdminDashboard({ onLogout, onUpdateMatch, match }) {
  const [section, setSection] = useState('match');

  return (
    <>
      <section className="panel admin-hero">
        <div className="panel-head admin-hero-head">
          <h2>🛠️ Admin Dashboard</h2>
          <button className="btn-admin-logout" onClick={onLogout} title="Déconnexion admin">
            🔓 <span>Déconnexion</span>
          </button>
        </div>
        <p className="admin-welcome">Bienvenue dans l'espace admin.</p>
        <div className="admin-tabs">
          <button className={`admin-tab ${section === 'match' ? 'active' : ''}`} onClick={() => setSection('match')}>📅 Match</button>
          <button className={`admin-tab ${section === 'ann' ? 'active' : ''}`} onClick={() => setSection('ann')}>Annonces</button>
          <button className={`admin-tab ${section === 'motm' ? 'active' : ''}`} onClick={() => setSection('motm')}>MotM</button>
          <button className={`admin-tab ${section === 'cash' ? 'active' : ''}`} onClick={() => setSection('cash')}>Caisse</button>
        </div>
      </section>
      {section === 'match' && (
        <AdminMatchSettings match={match} onUpdateMatch={onUpdateMatch} />
      )}
      {section === 'ann' && (
        <section className="panel">
          <p>Section annonces (à compléter).</p>
        </section>
      )}
      {section === 'motm' && (
        <section className="panel">
          <p>Section MotM (à compléter).</p>
        </section>
      )}
      {section === 'cash' && (
        <section className="panel">
          <p>Section caisse (à compléter).</p>
        </section>
      )}
    </>
  );
}

// ===============================
// ADMIN MATCH SETTINGS COMPONENT
// ===============================
function AdminMatchSettings({ match, onUpdateMatch }) {
  const [date, setDate] = useState(match?.match_date ? new Date(match.match_date).toISOString().split('T')[0] : '');
  const [kickoff, setKickoff] = useState(match?.kickoff_local || '10:00');

  const submit = async (e) => {
    e.preventDefault();
    if (!match) return;
    await onUpdateMatch(match.id, { match_date: date, kickoff_local: kickoff });
  };

  if (!match) return <p className="empty-row">Aucun match en cours.</p>;

  return (
    <section className="panel">
      <div className="panel-head"><h2>⚙️ Paramètres du Match</h2></div>
      <form className="new-form" onSubmit={submit}>
        <p className="pp-intro">Si nous ne jouons pas ce dimanche, modifiez la date pour la repousser à la semaine prochaine. Les joueurs inscrits seront conservés.</p>
        <label>Date prévue</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }}
        />
        <label>Heure du coup d'envoi</label>
        <input
          type="time"
          value={kickoff}
          onChange={e => setKickoff(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc' }}
        />
        <button type="submit" className="btn-primary" style={{ width: '100%' }}>Sauvegarder les modifications</button>
      </form>
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
