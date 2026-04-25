import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import logoCamas from './assets/logo-camas.jpeg';
import { api, getAdminCode, setAdminCode, clearAdminCode } from './api';
import { t, LANGS, localeFor } from './i18n';
import './App.css';

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

  const loadCaisse = loadAdmin; // alias rétro-compat (utilisé par CaissePage)

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

            <button
              className={`btn-admin ${isAdmin ? 'is-admin' : ''}`}
              onClick={() => isAdmin ? onAdminLogout() : setAdminModalOpen(true)}
              title={isAdmin ? tr('admin_logout') : tr('admin_login')}
            >
              {isAdmin ? '🔓' : '🔒'}
              <span className="btn-admin-lbl">{isAdmin ? tr('admin_logout') : tr('admin_login')}</span>
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
              match={match} attendees={attendees} players={players} scorers={scorers} lastMatch={lastMatch}
              announcements={announcements} motmResults={motmResults} motmLast={motmLast}
              onConfirm={async (pid, intent, position) => {
                try {
                  const r = await api.vote(pid, intent, position);
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

          {tab === 'players' && <PlayersPage tr={tr} players={players} attendees={attendees} onReload={loadHome} flash={flash} />}

          {tab === 'teams' && (
            <StadiumPage
              tr={tr} isAdmin={isAdmin}
              teams={teams} match={match} goals={matchGoals} attendees={attendees}
              onReload={loadTeams}
              onSaveScore={async (a, b) => {
                try { await api.setResult(match.id, a, b); loadTeams(); loadHome(); flash(tr('score_saved')); }
                catch (e) { flash(e.message, 'err'); }
              }}
              onAddGoal={async (playerId, goals, assists) => {
                try { await api.recordGoals({ matchId: match.id, playerId, goals, assists }); loadTeams(); flash(tr('goal_saved')); }
                catch (e) { flash(e.message, 'err'); }
              }}
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
function HomePage({ tr, lang, match, attendees, players, scorers, lastMatch, announcements, motmResults, motmLast, onConfirm, onUnvote, onCreatePlayer, onMotmVote }) {
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
      <AnnouncementsFeed tr={tr} lang={lang} announcements={announcements} />

      {/* Vote « Joueur du jour » */}
      <MotMSection
        tr={tr} lang={lang}
        match={match} attendees={attendees} players={players}
        results={motmResults} lastWinner={motmLast}
        onVote={onMotmVote}
      />

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
                  <td>{a.name}</td>
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
          onConfirm={async (pid, intent, position) => { await onConfirm(pid, intent, position); setPickerOpen(false); }}
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
function PlayerPicker({ tr, intent, players, attendees, onConfirm, onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const needsPosition = intent === 'yes';
  const [mode, setMode] = useState('pick'); // pick | new | position
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');
  const [position, setPosition] = useState(null);
  const voted = new Set(attendees.map(a => a.player_id));
  const filtered = useMemo(() => players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [players, search]);

  const choosePlayer = async (p) => {
    setSelected(p);
    if (needsPosition) {
      setMode('position');
    } else {
      // Pas besoin de position pour 'maybe' / 'no' — on confirme direct.
      await onConfirm(p.id, intent, null);
    }
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      // Niveau par défaut 5 — l'admin pourra l'ajuster ensuite via la page Joueurs.
      const p = await onCreate(newName.trim(), 5);
      setSelected(p);
      if (needsPosition) setMode('position');
      else await onConfirm(p.id, intent, null);
    } catch { /* silent */ }
  };

  const headTitle =
    mode === 'pick'     ? tr('who_confirms') :
    mode === 'new'      ? tr('new_player')   :
    mode === 'position' ? tr('pick_position', { name: selected?.name || '' }) : '';

  const intentBadgeClass =
    intent === 'yes' ? 'intent-badge-yes' :
    intent === 'maybe' ? 'intent-badge-maybe' :
    'intent-badge-no';
  const intentBadgeLbl =
    intent === 'yes' ? `⚽ ${tr('vote_yes')}` :
    intent === 'maybe' ? `🤔 ${tr('vote_maybe')}` :
    `❌ ${tr('vote_no')}`;

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
              {filtered.map(p => (
                <button key={p.id} className={`player-tile ${voted.has(p.id) ? 'disabled' : ''}`} disabled={voted.has(p.id)} onClick={() => choosePlayer(p)}>
                  <div className="tile-avatar">{p.name.slice(0, 1).toUpperCase()}</div>
                  <span>{p.name}</span>
                  {voted.has(p.id) && <span className="mini-tag">✓</span>}
                </button>
              ))}
              <button className="player-tile add" onClick={() => setMode('new')}>
                <div className="tile-avatar plus">+</div>
                <span>{tr('new_player')}</span>
              </button>
            </div>
          </>
        )}

        {mode === 'new' && (
          <form className="new-form" onSubmit={submitNew}>
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
                <button
                  key={p.code}
                  className={`pos-card pos-card-${p.code} ${position === p.code ? 'selected' : ''}`}
                  onClick={() => setPosition(p.code)}
                >
                  <span className="pos-code">{p.code}</span>
                  <span className="pos-name">{tr(p.key)}</span>
                </button>
              ))}
            </div>
            <div className="row-actions">
              <button className="btn-ghost" onClick={() => setMode('pick')}>{tr('back')}</button>
              <button className="btn-primary" disabled={!position} onClick={() => onConfirm(selected.id, 'yes', position)}>
                {tr('confirm_presence')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   PLAYERS PAGE
   ======================================================== */
function PlayersPage({ tr, players, attendees, onReload, flash }) {
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
          <thead><tr><th>{tr('th_name')}</th><th>{tr('th_level')}</th><th>{tr('th_sunday')}</th><th></th></tr></thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <div className="rating-inline">
                    <input type="range" min="1" max="10" step="0.5" defaultValue={Number(p.rating)} onChange={e => updateRating(p, e.target.value)} />
                    <span className="rating-pill">{Number(p.rating).toFixed(1)}</span>
                  </div>
                </td>
                <td>{presentIds.has(p.id) ? <span className="badge badge-green">{tr('status_confirmed')}</span> : <span className="badge badge-muted">—</span>}</td>
                <td><button className="row-x" onClick={() => remove(p)}>🗑</button></td>
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

  const allStarters = [...teamA.starters.map(p => ({ ...p, team: 'A' })), ...teamB.starters.map(p => ({ ...p, team: 'B' }))];

  return (
    <>
      <section className="panel stadium-panel">
        <div className="panel-head">
          <h2>🏟️ {tr('stadium')} · {teams.format.type}</h2>
          {isAdmin && <button className="btn-ghost" onClick={onReload}>{tr('redraw_teams')}</button>}
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

function CaissePage({ tr, fines, caisse, players, onPay, onAddExpense, onAddFine }) {
  const [expReason, setExpReason] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [fineOpen, setFineOpen] = useState(false);

  return (
    <>
      <section className={`panel balance-hero ${caisse.balance >= 0 ? 'positive' : 'negative'}`}>
        <div className="balance-label">{tr('cash_balance')}</div>
        <div className="balance-value">{caisse.balance.toFixed(2)} €</div>
        <div className="balance-grid">
          <div><span>{tr('paid')}</span><strong>{caisse.paid_fines.toFixed(2)} €</strong></div>
          <div><span>{tr('due')}</span><strong>{caisse.due_fines.toFixed(2)} €</strong></div>
          <div><span>{tr('expenses')}</span><strong>{caisse.expenses.toFixed(2)} €</strong></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{tr('add_expense')}</h2></div>
        <form className="inline-form" onSubmit={e => {
          e.preventDefault();
          if (!expReason.trim() || !expAmount) return;
          onAddExpense(expReason.trim(), parseFloat(expAmount));
          setExpReason(''); setExpAmount('');
        }}>
          <input placeholder={tr('reason_ph')} value={expReason} onChange={e => setExpReason(e.target.value)} />
          <input type="number" step="0.01" placeholder={tr('amount_ph')} value={expAmount} onChange={e => setExpAmount(e.target.value)} />
          <button className="btn-primary" type="submit">{tr('expense_btn')}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>{tr('fines')}</h2>
          <button className="btn-ghost" onClick={() => setFineOpen(true)}>{tr('manual_fine')}</button>
        </div>
        {fines.length === 0 ? (
          <p className="empty-row">{tr('no_fines')}</p>
        ) : (
          <table className="presences-table">
            <thead><tr><th>{tr('th_player')}</th><th>{tr('th_reason')}</th><th>{tr('th_amount')}</th><th>{tr('th_status')}</th></tr></thead>
            <tbody>
              {fines.map(f => (
                <tr key={f.id} className={f.paid ? 'paid-row' : ''}>
                  <td>{f.name}</td><td>{f.reason}</td><td><strong>{Number(f.amount).toFixed(2)} €</strong></td>
                  <td>{f.paid ? <span className="badge badge-green">{tr('paid_badge')}</span> : <button className="btn-sm" onClick={() => onPay(f.id)}>{tr('mark_paid')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {fineOpen && (
        <ManualFineModal tr={tr} players={players} onClose={() => setFineOpen(false)} onSubmit={async (pid, reason, amount) => { await onAddFine(pid, reason, amount); setFineOpen(false); }} />
      )}
    </>
  );
}

function ManualFineModal({ tr, players, onClose, onSubmit }) {
  const [pid, setPid] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><h3>{tr('new_fine')}</h3><button className="ghost-btn" onClick={onClose}>✕</button></div>
        <form className="new-form" onSubmit={e => { e.preventDefault(); if (pid && reason && amount) onSubmit(Number(pid), reason, parseFloat(amount)); }}>
          <label>{tr('th_player')}</label>
          <select value={pid} onChange={e => setPid(e.target.value)}>
            <option value="">{tr('pick_one')}</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label>{tr('th_reason')}</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('fine_reason_ph')} />
          <label>{tr('amount_eur')}</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
            <button type="submit" className="btn-primary">{tr('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================
   ANNOUNCEMENTS FEED (lecture publique sur l'accueil)
   ======================================================== */
function AnnouncementsFeed({ tr, lang, announcements }) {
  if (!announcements || announcements.length === 0) return null;
  const fmt = (iso) => new Date(iso).toLocaleDateString(localeFor(lang), { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <section className="panel ann-feed">
      <div className="panel-head">
        <h2>📣 {tr('announcements')}</h2>
      </div>
      <ul className="ann-list">
        {announcements.slice(0, 5).map(a => (
          <li key={a.id} className={`ann-item ${a.pinned ? 'is-pinned' : ''}`}>
            {a.pinned && <span className="ann-pin">{tr('pinned_badge')}</span>}
            {a.title && <h3 className="ann-title">{a.title}</h3>}
            <p className="ann-body">{a.body}</p>
            <time className="ann-date">{fmt(a.created_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ========================================================
   MAN OF THE MATCH — vote section sur l'accueil
   ======================================================== */
function MotMSection({ tr, lang, match, attendees, players, results, lastWinner, onVote }) {
  const [voterId, setVoterId] = useState('');
  const [votedId, setVotedId] = useState('');
  const [busy, setBusy] = useState(false);

  const eligibleVoters = useMemo(
    () => attendees.filter(a => a.status !== 'maybe' && a.status !== 'absent'),
    [attendees]
  );
  const eligibleCandidates = eligibleVoters; // mêmes joueurs (sauf soi-même côté backend)

  if (!match) {
    return (
      <section className="panel motm-panel">
        <div className="panel-head"><h2>🏆 {tr('motm_title')}</h2></div>
        <p className="empty-row">{tr('motm_locked_no_match')}</p>
      </section>
    );
  }

  const totalVotes = results.reduce((acc, r) => acc + r.votes, 0);
  const winner = results[0];

  const submit = async (e) => {
    e.preventDefault();
    if (!voterId || !votedId) return;
    if (Number(voterId) === Number(votedId)) return;
    setBusy(true);
    try { await onVote(Number(voterId), Number(votedId)); setVotedId(''); }
    finally { setBusy(false); }
  };

  return (
    <section className="panel motm-panel">
      <div className="panel-head">
        <h2>🏆 {tr('motm_title')}</h2>
      </div>
      <p className="motm-intro">{tr('motm_intro')}</p>

      {eligibleVoters.length < 2 ? (
        <p className="empty-row">{tr('motm_locked_no_atts')}</p>
      ) : (
        <form className="motm-form" onSubmit={submit}>
          <label className="motm-lbl">{tr('motm_who_are_you')}</label>
          <select value={voterId} onChange={e => setVoterId(e.target.value)}>
            <option value="">— {tr('pick_one')} —</option>
            {eligibleVoters.map(a => <option key={a.player_id} value={a.player_id}>{a.name}</option>)}
          </select>

          <label className="motm-lbl">{tr('motm_pick_player')}</label>
          <select value={votedId} onChange={e => setVotedId(e.target.value)} disabled={!voterId}>
            <option value="">— {tr('pick_one')} —</option>
            {eligibleCandidates
              .filter(a => String(a.player_id) !== String(voterId))
              .map(a => <option key={a.player_id} value={a.player_id}>{a.name}</option>)}
          </select>

          <button className="btn-primary" type="submit" disabled={!voterId || !votedId || busy}>
            🏆 {tr('motm_your_vote')}
          </button>
        </form>
      )}

      {results.length > 0 && (
        <div className="motm-results">
          <h3 className="motm-results-h">{tr('motm_results')} <span className="motm-total">({totalVotes})</span></h3>
          <ol className="motm-rank">
            {results.map((r, i) => {
              const pct = totalVotes ? Math.round((r.votes / totalVotes) * 100) : 0;
              return (
                <li key={r.id} className={`motm-row rank-${i + 1}`}>
                  <span className="motm-medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                  <span className="motm-name">{r.name}</span>
                  <div className="motm-bar"><div className="motm-bar-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="motm-count">{r.votes} {r.votes > 1 ? tr('motm_votes') : tr('motm_one_vote')}</span>
                </li>
              );
            })}
          </ol>
          {winner && winner.votes > 0 && (
            <div className="motm-leader-banner">
              🏆 <strong>{winner.name}</strong> — {tr('motm_winner')}
            </div>
          )}
        </div>
      )}

      {lastWinner && lastWinner.results && lastWinner.results.length > 0 && (
        <div className="motm-last">
          <h4 className="motm-last-h">{tr('motm_last_winner')}</h4>
          <p className="motm-last-name">🥇 {lastWinner.results[0].name} <span className="muted-txt">— {lastWinner.results[0].votes} {tr('motm_votes')}</span></p>
        </div>
      )}
    </section>
  );
}

/* ========================================================
   ADMIN DASHBOARD — sous-sections Annonces / MotM / Caisse
   ======================================================== */
function AdminDashboard({ tr, announcements, fines, caisse, players, match, motmResults,
                         onAddAnnouncement, onDeleteAnnouncement, onTogglePin,
                         onPay, onAddExpense, onAddFine }) {
  const [section, setSection] = useState('ann');

  return (
    <>
      <section className="panel admin-hero">
        <div className="panel-head"><h2>🛠️ {tr('admin_dashboard')}</h2></div>
        <p className="admin-welcome">{tr('admin_welcome')}</p>
        <div className="admin-tabs">
          <button className={`admin-tab ${section === 'ann' ? 'active' : ''}`} onClick={() => setSection('ann')}>{tr('admin_section_ann')}</button>
          <button className={`admin-tab ${section === 'motm' ? 'active' : ''}`} onClick={() => setSection('motm')}>{tr('admin_section_motm')}</button>
          <button className={`admin-tab ${section === 'cash' ? 'active' : ''}`} onClick={() => setSection('cash')}>{tr('admin_section_cash')}</button>
        </div>
      </section>

      {section === 'ann' && (
        <AdminAnnouncements
          tr={tr} announcements={announcements}
          onAdd={onAddAnnouncement} onDelete={onDeleteAnnouncement} onTogglePin={onTogglePin}
        />
      )}

      {section === 'motm' && (
        <section className="panel">
          <div className="panel-head"><h2>🏆 {tr('motm_results')}</h2></div>
          {!match ? (
            <p className="empty-row">{tr('motm_locked_no_match')}</p>
          ) : motmResults.length === 0 ? (
            <p className="empty-row">{tr('motm_no_votes')}</p>
          ) : (
            <ol className="motm-rank">
              {motmResults.map((r, i) => (
                <li key={r.id} className={`motm-row rank-${i + 1}`}>
                  <span className="motm-medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                  <span className="motm-name">{r.name}</span>
                  <span className="motm-count">{r.votes} {r.votes > 1 ? tr('motm_votes') : tr('motm_one_vote')}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {section === 'cash' && (
        <CaissePage
          tr={tr}
          fines={fines} caisse={caisse} players={players}
          onPay={onPay}
          onAddExpense={onAddExpense}
          onAddFine={onAddFine}
        />
      )}
    </>
  );
}

function AdminAnnouncements({ tr, announcements, onAdd, onDelete, onTogglePin }) {
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
      <section className="panel">
        <div className="panel-head"><h2>{tr('publish_announcement')}</h2></div>
        <form className="ann-form" onSubmit={submit}>
          <input className="ann-input" placeholder={tr('ann_title_ph')} value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="ann-textarea" placeholder={tr('ann_body_ph')} value={body} onChange={e => setBody(e.target.value)} rows={4} required />
          <label className="ann-pin-toggle">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            <span>{tr('pin_label')} 📌</span>
          </label>
          <button className="btn-primary" type="submit" disabled={!body.trim()}>{tr('publish_btn')}</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{tr('manage_announcements')}</h2></div>
        {announcements.length === 0 ? (
          <p className="empty-row">{tr('ann_empty_admin')}</p>
        ) : (
          <ul className="ann-admin-list">
            {announcements.map(a => (
              <li key={a.id} className={`ann-admin-item ${a.pinned ? 'is-pinned' : ''}`}>
                <div className="ann-admin-body">
                  {a.title && <strong>{a.title}</strong>}
                  <p>{a.body}</p>
                  <time>{new Date(a.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Berlin' })}</time>
                </div>
                <div className="ann-admin-actions">
                  <button className="btn-sm" onClick={() => onTogglePin(a)} title={a.pinned ? 'Désépingler' : 'Épingler'}>
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
              <p className="legal-intro">{tr('impressum_intro')}</p>
              <h4>{tr('impressum_assoc')}</h4>
              <p><strong>{tr('impressum_addr_lbl')} :</strong> {tr('impressum_addr')}</p>
              <p><strong>{tr('impressum_resp_lbl')} :</strong> {tr('impressum_resp')}</p>
              <p><strong>Email :</strong> <a href="mailto:finances@camasev.com" className="footer-link">{tr('impressum_email')}</a></p>
              <p>{tr('impressum_register')}</p>
              <p className="legal-disclaimer">{tr('impressum_disclaimer')}</p>
            </>
          )}
          {isPrivacy && (
            <>
              <p className="legal-intro">{tr('privacy_intro')}</p>
              <h4>{tr('privacy_h_who')}</h4><p>{tr('privacy_who')}</p>
              <h4>{tr('privacy_h_what')}</h4><p>{tr('privacy_what')}</p>
              <h4>{tr('privacy_h_purpose')}</h4><p>{tr('privacy_purpose')}</p>
              <h4>{tr('privacy_h_basis')}</h4><p>{tr('privacy_basis')}</p>
              <h4>{tr('privacy_h_storage')}</h4><p>{tr('privacy_storage')}</p>
              <h4>{tr('privacy_h_rights')}</h4><p>{tr('privacy_rights')}</p>
              <h4>{tr('privacy_h_cookies')}</h4><p>{tr('privacy_cookies')}</p>
              <h4>{tr('privacy_h_thirdparty')}</h4><p>{tr('privacy_thirdparty')}</p>
              <h4>{tr('privacy_h_update')}</h4><p>{tr('privacy_update')}</p>
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
