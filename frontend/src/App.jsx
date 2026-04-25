import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import logoCamas from './assets/logo-camas.jpeg';
import { api } from './api';
import './App.css';

const TABS = [
  { id: 'home',     icon: '🏠', label: 'Dashboard'    },
  { id: 'players',  icon: '👥', label: 'Présences'    },
  { id: 'teams',    icon: '👕', label: 'Équipes'      },
  { id: 'stats',    icon: '📈', label: 'Statistiques' },
  { id: 'caisse',   icon: '🧾', label: 'Sanctions'    },
];

const POSITIONS = [
  { code: 'G',   label: 'Gardien',     short: 'G'   },
  { code: 'DEF', label: 'Défenseur',   short: 'DEF' },
  { code: 'MIL', label: 'Milieu',      short: 'MIL' },
  { code: 'ATT', label: 'Attaquant',   short: 'ATT' },
];

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: 'long' }) : '';
const fmtShortDate = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short' }) : '';

export default function App() {
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
  const [toast, setToast] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);

  const flash = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3200);
  }, []);

  const loadHome = useCallback(async () => {
    try {
      const [m, ps, last] = await Promise.all([api.currentMatch(), api.listPlayers(), api.lastMatch()]);
      setMatch(m.match); setAttendees(m.attendees); setPlayers(ps); setLastMatch(last);
    } catch (e) { console.warn(e); }
  }, []);

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

  const loadCaisse = useCallback(async () => {
    const [f, c] = await Promise.all([api.fines(), api.caisse()]);
    setFines(f); setCaisse(c);
  }, []);

  // Chargement initial uniquement
  // Utilisation de useLayoutEffect pour éviter les rendus en cascade lors du setState initial
  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      loadHome();
      loadStats();
    });
  }, [loadHome, loadStats]);

  // Chargement conditionnel selon l'onglet
  useLayoutEffect(() => {
    Promise.resolve().then(() => {
      if (tab === 'teams') loadTeams();
      else if (tab === 'stats') loadStats();
      else if (tab === 'caisse') loadCaisse();
    });
  }, [tab, loadTeams, loadStats, loadCaisse]);

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <div className="app">
      <div className="tablet">
        {/* HEADER */}
        <header className="header">
          <div className="logo-circle">
            <img src={logoCamas} alt="CAMAS e.V." />
          </div>
          <nav className="top-nav mobile-bottom">
            {TABS.map(t => (
              <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <span className="nav-ic">{t.icon}</span>
                <span className="nav-lbl">{t.label}</span>
              </button>
            ))}
          </nav>
          {installEvt && (
            <button className="btn-install" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>
              📲 Installer
            </button>
          )}
        </header>
        <div className="flag-stripe" />

        {/* CONTENT */}
        <main className="content">
          {tab === 'home' && (
            <HomePage
              match={match} attendees={attendees} players={players} scorers={scorers} lastMatch={lastMatch}
              onConfirm={async (pid, position) => {
                try { const r = await api.vote(pid, position); flash(r.late ? 'Présence confirmée — retard noté (2€)' : 'Présence confirmée ⚽', r.late ? 'warn' : 'ok'); loadHome(); }
                catch (e) { flash(e.message, 'err'); }
              }}
              onUnvote={async (pid) => {
                try { await api.unvote(pid, match.id); flash('Présence annulée'); loadHome(); }
                catch (e) { flash(e.message, 'err'); }
              }}
              onCreatePlayer={async (name, rating) => {
                try { const p = await api.createPlayer({ name, rating }); await loadHome(); flash(`${p.name} ajouté`); return p; }
                catch (e) { flash(e.message, 'err'); throw e; }
              }}
            />
          )}

          {tab === 'players' && <PlayersPage players={players} attendees={attendees} onReload={loadHome} flash={flash} />}

          {tab === 'teams' && (
            <StadiumPage
              teams={teams} match={match} goals={matchGoals} attendees={attendees}
              onReload={loadTeams}
              onSaveScore={async (a, b) => { await api.setResult(match.id, a, b); loadTeams(); loadHome(); flash('Score enregistré ⚽'); }}
              onAddGoal={async (playerId, goals, assists) => { await api.recordGoals({ matchId: match.id, playerId, goals, assists }); loadTeams(); flash('Buteur enregistré'); }}
              onSetPosition={async (playerId, position) => { await api.updatePosition(playerId, match.id, position); loadTeams(); loadHome(); }}
            />
          )}

          {tab === 'stats' && <StatsPage scorers={scorers} attendance={attStats} />}
          {tab === 'caisse' && (
            <CaissePage
              fines={fines} caisse={caisse} players={players}
              onPay={async (id) => { await api.payFine(id); loadCaisse(); flash('Amende marquée payée'); }}
              onAddExpense={async (reason, amount) => { await api.addExpense({ reason, amount }); loadCaisse(); flash('Dépense enregistrée'); }}
              onAddFine={async (playerId, reason, amount) => { await api.addFine({ playerId, reason, amount }); loadCaisse(); flash('Amende ajoutée'); }}
            />
          )}
        </main>

        {/* FOOTER */}
        <div className="flag-stripe" />
        <footer className="footer">
          <div className="footer-block">
            <strong>📍 Stade</strong>
            <p>Hofener Straße 171<br/>70374 Stuttgart</p>
          </div>
          <div className="footer-block center">
            <strong>⚽ Responsable</strong>
            <p>Olivier Saly<br/><span className="muted-txt">CAMAS e.V. — 3ème mi-temps</span></p>
          </div>
          <div className="footer-block right">
            <strong>💳 PayPal / Finances</strong>
            <p>finances@camasev.com</p>
          </div>
        </footer>
      </div>

      {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

/* ========================================================
   HOME / DASHBOARD
   ======================================================== */
function HomePage({ match, attendees, players, scorers, lastMatch, onConfirm, onUnvote, onCreatePlayer }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const topScorer = scorers.find(s => s.goals > 0) || scorers[0];

  const fmt =
    attendees.length >= 22 ? { type: 'Grand Terrain', format: '11 vs 11' } :
    attendees.length >= 14 ? { type: 'Terrain Réduit', format: '7 vs 7' } :
                             { type: 'Petit Goal', format: '5 vs 5' };

  return (
    <>
      {/* LAST MATCH STRIP */}
      {lastMatch && <LastMatchCard lastMatch={lastMatch} />}

      {/* TOP ROW: presences + next match */}
      <div className="grid-top">
        <section className="panel presences-panel">
          <div className="panel-head">
            <h2>TABLEAU DE PRÉSENCES</h2>
            <span className="panel-ic">⚽</span>
          </div>
          <table className="presences-table">
            <thead>
              <tr><th>Nom</th><th>Poste</th><th>Statut</th><th>Arrivée</th><th></th></tr>
            </thead>
            <tbody>
              {attendees.length === 0 && (
                <tr><td colSpan="5" className="empty-row">Aucune inscription pour le moment.</td></tr>
              )}
              {attendees.map(a => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.position ? <span className={`pos-tag pos-${a.position}`}>{a.position}</span> : <span className="muted-txt">—</span>}</td>
                  <td>{a.is_late ? <span className="badge badge-red">Retard</span> : <span className="badge badge-green">Confirmé</span>}</td>
                  <td className="time-cell">{fmtTime(a.vote_time)}</td>
                  <td><button className="row-x" onClick={() => onUnvote(a.player_id)} title="Annuler">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel match-panel">
          <div className="panel-head">
            <h2>PROCHAIN MATCH · DIMANCHE</h2>
            <span className="panel-ic">⏱️</span>
          </div>
          <p className="kickoff">Kickoff <strong>10:00</strong> · {match ? fmtDate(match.match_date) : '…'}</p>

          <div className="info-box info-yellow">
            <p>Rendez-vous : <strong>09:45</strong></p>
            <p className="sub">(Installation & Échauffement)</p>
          </div>

          <button className="btn-vote" onClick={() => setPickerOpen(true)}>
            JE VIENDRAIS JOUER
            <span className="btn-ball">⚽</span>
          </button>

          <div className="info-box info-border">
            <p>Sondage clôturé</p>
            <p><strong>samedi 20:00</strong></p>
          </div>

          <div className="info-box info-red">
            <p>Amende retard : <strong>2€</strong></p>
            <p className="sub">(après 10:00 précises)</p>
            <span className="fine-ic">🧾</span>
          </div>
        </section>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid-bottom">
        <section className="panel small-panel">
          <div className="panel-head">
            <h3>RÈGLES D'OR</h3>
            <span className="panel-ic">⏱️</span>
          </div>
          <ul className="rules">
            <li><span className="check">✓</span> Respect des délais d'inscription</li>
            <li><span className="check">✓</span> Ponctualité stricte exigée</li>
            <li><span className="check">✓</span> Coopération pour le matériel</li>
          </ul>
        </section>

        <section className="panel small-panel scorer-panel">
          <div className="panel-head">
            <h3>MEILLEUR BUTEUR</h3>
            <span className="flag-badge">🇨🇲</span>
          </div>
          {topScorer ? (
            <div className="scorer-body">
              <div className="scorer-avatar">{topScorer.name.slice(0, 1).toUpperCase()}</div>
              <div className="scorer-stats">
                <p className="scorer-name">{topScorer.name}</p>
                <p><span>🏆</span> <strong>{(topScorer.goals || 0) * 10 + (topScorer.assists || 0) * 3}</strong> pts</p>
                <p><span>⚽</span> <strong>{topScorer.goals || 0}</strong> buts</p>
                <p><span>🅰</span> <strong>{topScorer.assists || 0}</strong> passes</p>
              </div>
            </div>
          ) : (
            <p className="empty-row">Pas encore de but enregistré.</p>
          )}
        </section>

        <section className="panel small-panel teams-panel">
          <div className="panel-head">
            <h3>FORMATION ÉQUIPES</h3>
            <span className="flag-badge">🇨🇲</span>
          </div>
          <div className="teams-info">
            <p className="teams-headline">Répartition automatisée</p>
            <div className="teams-stats">
              <div><strong>{attendees.length}</strong><span>Inscrits</span></div>
              <div><strong>2</strong><span>Équipes</span></div>
              <div><strong>{fmt.format}</strong><span>{fmt.type}</span></div>
            </div>
          </div>
        </section>
      </div>

      {pickerOpen && (
        <PlayerPicker
          players={players}
          attendees={attendees}
          onConfirm={async (pid, position) => { await onConfirm(pid, position); setPickerOpen(false); }}
          onCreate={async (name, rating) => await onCreatePlayer(name, rating)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function LastMatchCard({ lastMatch }) {
  const { match, scorers } = lastMatch;
  return (
    <section className="last-match">
      <div className="last-match-tag">DERNIER MATCH · {fmtShortDate(match.match_date)}</div>
      <div className="last-match-score">
        <div className="lm-team lm-team-a">
          <span>Équipe A</span>
          <strong>{match.team_a_score}</strong>
        </div>
        <span className="lm-vs">VS</span>
        <div className="lm-team lm-team-b">
          <strong>{match.team_b_score}</strong>
          <span>Équipe B</span>
        </div>
      </div>
      {scorers && scorers.length > 0 && (
        <div className="last-match-scorers">
          <span className="muted-txt">Buteurs :</span>
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
   PLAYER PICKER (with position)
   ======================================================== */
function PlayerPicker({ players, attendees, onConfirm, onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('pick'); // pick | new | position
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');
  const [rating, setRating] = useState(5);
  const [position, setPosition] = useState(null);
  const voted = new Set(attendees.map(a => a.player_id));
  const filtered = useMemo(() => players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [players, search]);

  const choosePlayer = (p) => { setSelected(p); setMode('position'); };
  const submitNew = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const p = await onCreate(newName.trim(), Number(rating));
      setSelected(p);
      setMode('position');
    } catch {
      // Erreur silencieuse
    }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>
            {mode === 'pick'     && "Qui confirme sa présence ?"}
            {mode === 'new'      && "Nouveau joueur"}
            {mode === 'position' && `Ton poste, ${selected?.name} ?`}
          </h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>

        {mode === 'pick' && (
          <>
            <input className="search" placeholder="🔍 Rechercher…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div className="player-grid">
              {filtered.map(p => (
                <button key={p.id} className={`player-tile ${voted.has(p.id) ? 'disabled' : ''}`} disabled={voted.has(p.id)} onClick={() => choosePlayer(p)}>
                  <div className="tile-avatar">{p.name.slice(0, 1).toUpperCase()}</div>
                  <span>{p.name}</span>
                  {voted.has(p.id) && <span className="mini-tag">confirmé</span>}
                </button>
              ))}
              <button className="player-tile add" onClick={() => setMode('new')}>
                <div className="tile-avatar plus">+</div>
                <span>Nouveau joueur</span>
              </button>
            </div>
          </>
        )}

        {mode === 'new' && (
          <form className="new-form" onSubmit={submitNew}>
            <label>Nom et prénom</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Ex: Samuel Djommou" />
            <label>Niveau : <strong>{rating}</strong>/10</label>
            <input type="range" min="1" max="10" step="0.5" value={rating} onChange={e => setRating(e.target.value)} />
            <div className="row-actions">
              <button type="button" className="btn-ghost" onClick={() => setMode('pick')}>← Retour</button>
              <button type="submit" className="btn-primary">Suivant →</button>
            </div>
          </form>
        )}

        {mode === 'position' && selected && (
          <div className="position-picker">
            <p className="pp-intro">À quel poste tu joues dimanche ?</p>
            <div className="position-grid">
              {POSITIONS.map(p => (
                <button
                  key={p.code}
                  className={`pos-card pos-card-${p.code} ${position === p.code ? 'selected' : ''}`}
                  onClick={() => setPosition(p.code)}
                >
                  <span className="pos-code">{p.code}</span>
                  <span className="pos-name">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="row-actions">
              <button className="btn-ghost" onClick={() => setMode('pick')}>← Retour</button>
              <button className="btn-primary" disabled={!position} onClick={() => onConfirm(selected.id, position)}>
                ✅ Confirmer ma présence
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
function PlayersPage({ players, attendees, onReload, flash }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const presentIds = new Set(attendees.map(a => a.player_id));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.createPlayer({ name: name.trim(), rating: Number(rating) }); setName(''); setRating(5); setAdding(false); onReload(); flash('Joueur ajouté'); }
    catch (e) { flash(e.message, 'err'); }
  };
  const updateRating = async (p, v) => { try { await api.updatePlayer(p.id, { rating: Number(v) }); onReload(); } catch (e) { flash(e.message, 'err'); } };
  const remove = async (p) => { if (!confirm(`Supprimer ${p.name} ?`)) return; try { await api.deletePlayer(p.id); onReload(); flash('Joueur supprimé'); } catch (e) { flash(e.message, 'err'); } };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>GESTION DES JOUEURS</h2>
        <button className="btn-primary" onClick={() => setAdding(a => !a)}>{adding ? 'Annuler' : '+ Ajouter'}</button>
      </div>
      {adding && (
        <form className="inline-form" onSubmit={submit}>
          <input placeholder="Nom complet" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <label className="rating-input">Niveau: <strong>{rating}</strong>
            <input type="range" min="1" max="10" step="0.5" value={rating} onChange={e => setRating(e.target.value)} />
          </label>
          <button className="btn-primary" type="submit">Enregistrer</button>
        </form>
      )}
      {players.length === 0 ? (
        <p className="empty-row">Aucun joueur pour l'instant.</p>
      ) : (
        <table className="presences-table">
          <thead><tr><th>Nom</th><th>Niveau</th><th>Dimanche</th><th></th></tr></thead>
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
                <td>{presentIds.has(p.id) ? <span className="badge badge-green">Confirmé</span> : <span className="badge badge-muted">—</span>}</td>
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
   STADIUM PAGE (the big one)
   ======================================================== */
function StadiumPage({ teams, match, goals, onReload, onSaveScore, onAddGoal, onSetPosition }) {
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

  if (!teams) return <section className="panel"><p className="empty-row">Chargement…</p></section>;
  if (teams.count < 2) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>LE STADE</h2></div>
        <p className="empty-row">Il faut au moins 2 joueurs inscrits pour composer les équipes.</p>
      </section>
    );
  }

  const [teamA, teamB] = teams.teams;
  const diff = Math.abs(teamA.total - teamB.total);

  // Goals: map player_id → goals count
  const goalsByPlayer = Object.fromEntries(goals.map(g => [g.player_id, g]));
  // const playerById = Object.fromEntries(attendees.map(a => [a.player_id, a])); // Non utilisé

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

  // const startersIds = new Set([...teamA.starters, ...teamB.starters].map(p => p.id)); // Non utilisé
  const allStarters = [...teamA.starters.map(p => ({ ...p, team: 'A' })), ...teamB.starters.map(p => ({ ...p, team: 'B' }))];

  return (
    <>
      <section className="panel stadium-panel">
        <div className="panel-head">
          <h2>🏟️ LE STADE · {teams.format.type}</h2>
          <button className="btn-ghost" onClick={onReload}>↻ Re-tirer les équipes</button>
        </div>

        <div className="format-banner">
          <div className="format-value">{teams.format.format}</div>
          <div className="format-sub">
            Équipe A <strong>{teamA.total.toFixed(1)}</strong> · Équipe B <strong>{teamB.total.toFixed(1)}</strong> · écart {diff.toFixed(1)} pt
          </div>
        </div>

        <Pitch teamA={teamA.starters} teamB={teamB.starters} goalsByPlayer={goalsByPlayer} onSetPosition={onSetPosition} />
      </section>

      {/* SCORE + BUTEURS */}
      <section className="panel">
        <div className="panel-head"><h2>📊 RÉSULTAT DU MATCH</h2></div>

        <form className="score-form" onSubmit={saveScore}>
          <div className="score-input">
            <label>Équipe A</label>
            <input type="number" min="0" max="99" value={scoreA} onChange={e => setScoreA(e.target.value)} placeholder="0" />
          </div>
          <div className="score-dash">—</div>
          <div className="score-input">
            <label>Équipe B</label>
            <input type="number" min="0" max="99" value={scoreB} onChange={e => setScoreB(e.target.value)} placeholder="0" />
          </div>
          <button type="submit" className="btn-primary">💾 Enregistrer le score</button>
        </form>

        <div className="goals-block">
          <h3>⚽ Buteurs</h3>
          <form className="inline-form" onSubmit={addGoal}>
            <select value={goalPlayer} onChange={e => setGoalPlayer(e.target.value)}>
              <option value="">— choisir un joueur —</option>
              {allStarters.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.team})</option>
              ))}
            </select>
            <input type="number" min="1" max="10" value={goalCount} onChange={e => setGoalCount(e.target.value)} />
            <button className="btn-primary" type="submit">+ Ajouter but(s)</button>
          </form>
          {goals.length === 0 ? (
            <p className="empty-row">Pas encore de but enregistré.</p>
          ) : (
            <ul className="goals-list">
              {goals.map(g => {
                // const player = playerById[g.player_id]; // Non utilisé
                const teamLetter = teamA.starters.some(p => p.id === g.player_id) ? 'A' : teamB.starters.some(p => p.id === g.player_id) ? 'B' : null;
                return (
                  <li key={g.id}>
                    <span className="goal-icon">⚽</span>
                    <span className="goal-name">{g.name}</span>
                    {teamLetter && <span className={`pos-tag pos-team-${teamLetter}`}>Équipe {teamLetter}</span>}
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
        <div className="panel-head"><h2>🔁 REMPLAÇANTS</h2></div>
        <div className="subs-grid">
          <div className="sub-team sub-team-a">
            <h4>Équipe A · {teamA.subs.length} remplaçant(s)</h4>
            {teamA.subs.length === 0 ? <p className="empty-row small">Aucun</p> : (
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
            <h4>Équipe B · {teamB.subs.length} remplaçant(s)</h4>
            {teamB.subs.length === 0 ? <p className="empty-row small">Aucun</p> : (
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

/* --- the virtual pitch --- */
function Pitch({ teamA, teamB, goalsByPlayer, onSetPosition }) {
  // Default position = MIL if none set
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

      {/* Team A (top half) — goalkeeper on top, attackers towards center */}
      <div className="pitch-half pitch-half-a">
        <PositionRow players={A.G}   label="G"   team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={A.DEF} label="DEF" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={A.MIL} label="MIL" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={A.ATT} label="ATT" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
      </div>

      {/* Team B (bottom half) — mirrored: ATT near center, G at bottom */}
      <div className="pitch-half pitch-half-b">
        <PositionRow players={B.ATT} label="ATT" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={B.MIL} label="MIL" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={B.DEF} label="DEF" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow players={B.G}   label="G"   team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
      </div>

      {/* Team labels */}
      <div className="pitch-label label-a">ÉQUIPE A</div>
      <div className="pitch-label label-b">ÉQUIPE B</div>
    </div>
  );
}

function PositionRow({ players, label, team, goalsByPlayer, onSet }) {
  return (
    <div className={`pos-row pos-row-${label}`}>
      <span className="pos-row-label">{label}</span>
      <div className="pos-row-players">
        {players.length === 0 ? (
          <div className="pos-empty">—</div>
        ) : players.map(p => (
          <PlayerDot key={p.id} player={p} team={team} goals={goalsByPlayer[p.id]?.goals || 0} onSet={onSet} currentPos={label} />
        ))}
      </div>
    </div>
  );
}

function PlayerDot({ player, team, goals, onSet, currentPos }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="player-dot-wrap">
      <button
        className={`player-dot player-dot-${team}`}
        onClick={() => setMenuOpen(m => !m)}
        title="Cliquer pour changer de poste"
      >
        <span className="dot-name">{player.name.split(' ')[0]}</span>
        {goals > 0 && <span className="dot-goals">⚽{goals}</span>}
      </button>
      {menuOpen && (
        <div className="dot-menu" onMouseLeave={() => setMenuOpen(false)}>
          {POSITIONS.map(p => (
            <button
              key={p.code}
              className={currentPos === p.code ? 'active' : ''}
              onClick={() => { onSet(player.id, p.code); setMenuOpen(false); }}
            >{p.short}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================
   STATS & CAISSE (unchanged)
   ======================================================== */
function StatsPage({ scorers, attendance }) {
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>🥇 TOP BUTEURS DE LA SAISON</h2></div>
        {scorers.filter(s => s.goals > 0).length === 0 ? (
          <p className="empty-row">Aucun but enregistré pour l'instant.</p>
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
        <div className="panel-head"><h2>📅 ASSIDUITÉ & PONCTUALITÉ</h2></div>
        {attendance.filter(a => a.total > 0).length === 0 ? (
          <p className="empty-row">Pas encore d'historique.</p>
        ) : (
          <table className="presences-table">
            <thead><tr><th>Joueur</th><th>Présences</th><th>Retards</th><th>Absences</th><th>Ponctualité</th></tr></thead>
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

function CaissePage({ fines, caisse, players, onPay, onAddExpense, onAddFine }) {
  const [expReason, setExpReason] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [fineOpen, setFineOpen] = useState(false);

  return (
    <>
      <section className={`panel balance-hero ${caisse.balance >= 0 ? 'positive' : 'negative'}`}>
        <div className="balance-label">SOLDE DE LA CAISSE CAMAS</div>
        <div className="balance-value">{caisse.balance.toFixed(2)} €</div>
        <div className="balance-grid">
          <div><span>✅ Payé</span><strong>{caisse.paid_fines.toFixed(2)} €</strong></div>
          <div><span>⏳ Dû</span><strong>{caisse.due_fines.toFixed(2)} €</strong></div>
          <div><span>💸 Dépenses</span><strong>{caisse.expenses.toFixed(2)} €</strong></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>📥 AJOUTER UNE DÉPENSE</h2></div>
        <form className="inline-form" onSubmit={e => {
          e.preventDefault();
          if (!expReason.trim() || !expAmount) return;
          onAddExpense(expReason.trim(), parseFloat(expAmount));
          setExpReason(''); setExpAmount('');
        }}>
          <input placeholder="Motif (ex: ballons)" value={expReason} onChange={e => setExpReason(e.target.value)} />
          <input type="number" step="0.01" placeholder="€" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
          <button className="btn-primary" type="submit">+ Dépense</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>🧾 AMENDES</h2>
          <button className="btn-ghost" onClick={() => setFineOpen(true)}>+ Manuelle</button>
        </div>
        {fines.length === 0 ? (
          <p className="empty-row">Aucune amende — RAS 🎉</p>
        ) : (
          <table className="presences-table">
            <thead><tr><th>Joueur</th><th>Motif</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>
              {fines.map(f => (
                <tr key={f.id} className={f.paid ? 'paid-row' : ''}>
                  <td>{f.name}</td><td>{f.reason}</td><td><strong>{Number(f.amount).toFixed(2)} €</strong></td>
                  <td>{f.paid ? <span className="badge badge-green">Payé</span> : <button className="btn-sm" onClick={() => onPay(f.id)}>Marquer payé</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {fineOpen && (
        <ManualFineModal players={players} onClose={() => setFineOpen(false)} onSubmit={async (pid, reason, amount) => { await onAddFine(pid, reason, amount); setFineOpen(false); }} />
      )}
    </>
  );
}

function ManualFineModal({ players, onClose, onSubmit }) {
  const [pid, setPid] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><h3>Nouvelle amende</h3><button className="ghost-btn" onClick={onClose}>✕</button></div>
        <form className="new-form" onSubmit={e => { e.preventDefault(); if (pid && reason && amount) onSubmit(Number(pid), reason, parseFloat(amount)); }}>
          <label>Joueur</label>
          <select value={pid} onChange={e => setPid(e.target.value)}>
            <option value="">— choisir —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label>Motif</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ex: oubli maillot" />
          <label>Montant (€)</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
