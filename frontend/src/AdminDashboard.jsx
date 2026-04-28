import { useLayoutEffect, useState } from 'react';
import { buildProfileAvatar, DEFAULT_KICKOFF, fmtShortDate } from './appShared';

export default function AdminDashboard({
  tr, lang,
  announcements, fines, caisse, players,
  match, motmResults, teams, matchGoals, calendar, inventory, upcomingBirthdays,
  onLogout,
  onAddAnnouncement, onDeleteAnnouncement, onTogglePin,
  onPay, onAddExpense, onAddFine,
  onSaveScore, onAddGoal, onSetMatchPhoto,
  onScheduleMatch, onDeleteMatch,
  onAddInventoryItem, onUpdateInventoryItem, onDeleteInventoryItem,
  onUpdateMatch,
}) {
  const [section, setSection] = useState('match');
  const dueCount = fines.filter((fine) => !fine.paid).length;
  const plannedCount = calendar.filter((item) => item.status !== 'done').length;
  const readyUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_ready || 0), 0);
  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_total || 0), 0);
  const readyRatio = totalUnits ? Math.round((readyUnits / totalUnits) * 100) : 100;

  const describeUpcomingBirthday = (item) => {
    if (item.daysUntil === 0) return tr('admin_birthdays_today');
    if (item.daysUntil === 1) return tr('admin_birthdays_tomorrow');
    return tr('admin_birthdays_in_days', { days: item.daysUntil });
  };

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
        <div className="admin-birthday-card">
          <div className="admin-birthday-card-head">
            <div>
              <span className="admin-birthday-kicker">{tr('admin_birthdays_label')}</span>
              <h3>{tr('admin_birthdays_title')}</h3>
              <p>{tr('admin_birthdays_intro')}</p>
            </div>
            <strong className="admin-birthday-count">{upcomingBirthdays.length}</strong>
          </div>
          {upcomingBirthdays.length > 0 ? (
            <div className="admin-birthday-list">
              {upcomingBirthdays.slice(0, 6).map((item) => (
                <article key={item.id} className="admin-birthday-item">
                  <span className="admin-birthday-avatar-shell">
                    <img className="admin-birthday-avatar" src={buildProfileAvatar(item.name)} alt={item.name} />
                  </span>
                  <div className="admin-birthday-copy">
                    <strong>{item.name}</strong>
                    <span>{fmtShortDate(item.nextOccurrence, lang)} · {tr('admin_birthdays_turns', { age: item.turnsAge })}</span>
                  </div>
                  <em>{describeUpcomingBirthday(item)}</em>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-birthday-empty">{tr('admin_birthdays_empty')}</p>
          )}
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
          <AdminMatchSettings tr={tr} match={match} onUpdateMatch={onUpdateMatch} />
          <AdminMatchPanel
            tr={tr}
            lang={lang}
            match={match}
            teams={teams}
            matchGoals={matchGoals}
            motmResults={motmResults}
            players={players}
            onSaveScore={onSaveScore}
            onAddGoal={onAddGoal}
            onSetMatchPhoto={onSetMatchPhoto}
          />
        </section>
      )}

      {section === 'ann' && (
        <AdminAnnouncementsPanel
          tr={tr}
          lang={lang}
          announcements={announcements}
          onAdd={onAddAnnouncement}
          onDelete={onDeleteAnnouncement}
          onTogglePin={onTogglePin}
        />
      )}

      {section === 'plan' && (
        <AdminPlanningPanel
          tr={tr}
          lang={lang}
          calendar={calendar}
          onSchedule={onScheduleMatch}
          onDelete={onDeleteMatch}
        />
      )}

      {section === 'cash' && (
        <CaissePage tr={tr} fines={fines} caisse={caisse} players={players} onPay={onPay} onAddExpense={onAddExpense} onAddFine={onAddFine} />
      )}

      {section === 'gear' && (
        <AdminInventoryPanel tr={tr} inventory={inventory} onAdd={onAddInventoryItem} onUpdate={onUpdateInventoryItem} onDelete={onDeleteInventoryItem} />
      )}
    </>
  );
}

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
  }, [match, photoUrl, scoreA, scoreB, winnerTeam]);

  if (!match) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>{tr('admin_tab_match')}</h2></div>
        <p className="empty-row">{tr('admin_no_current')}</p>
      </section>
    );
  }

  const goalsByPlayer = Object.fromEntries((matchGoals || []).map((goal) => [goal.player_id, goal]));
  const allCandidates = teams && teams.teams && teams.teams.length === 2
    ? [
        ...teams.teams[0].starters.map((player) => ({ ...player, team: 'A' })),
        ...teams.teams[1].starters.map((player) => ({ ...player, team: 'B' })),
      ]
    : (players || []).map((player) => ({ ...player, team: '' }));

  const submitScore = (event) => {
    event.preventDefault();
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    onSaveScore(match.id, a, b);
  };

  const submitGoal = (event) => {
    event.preventDefault();
    if (!goalPlayer) return;
    const playerId = parseInt(goalPlayer, 10);
    const existing = goalsByPlayer[playerId]?.goals || 0;
    onAddGoal(match.id, playerId, existing + parseInt(goalCount, 10), goalsByPlayer[playerId]?.assists || 0);
    setGoalPlayer('');
    setGoalCount(1);
  };

  const submitPhoto = (event) => {
    event.preventDefault();
    if (!photoUrl.trim()) return;
    onSetMatchPhoto(match.id, photoUrl.trim(), winnerTeam);
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = loadEvent.target.result;
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
            <input type="number" min="0" max="99" value={scoreA} onChange={(event) => setScoreA(event.target.value)} placeholder="0" />
          </div>
          <div className="score-dash">—</div>
          <div className="score-input">
            <label>{tr('team_b')}</label>
            <input type="number" min="0" max="99" value={scoreB} onChange={(event) => setScoreB(event.target.value)} placeholder="0" />
          </div>
          <button type="submit" className="btn-primary">{tr('save_score')}</button>
        </form>
      </section>

      <section className="panel admin-card">
        <div className="panel-head"><h3>{tr('admin_match_goals_title')}</h3></div>
        <form className="inline-form" onSubmit={submitGoal}>
          <select value={goalPlayer} onChange={(event) => setGoalPlayer(event.target.value)}>
            <option value="">{tr('pick_player')}</option>
            {allCandidates.map((player) => (
              <option key={player.id} value={player.id}>{player.name}{player.team ? ` (${player.team})` : ''}</option>
            ))}
          </select>
          <input type="number" min="1" max="10" value={goalCount} onChange={(event) => setGoalCount(event.target.value)} />
          <button className="btn-primary" type="submit">{tr('add_goal')}</button>
        </form>
        {(matchGoals || []).length === 0 ? (
          <p className="empty-row">{tr('no_goals_yet')}</p>
        ) : (
          <ul className="goals-list">
            {matchGoals.map((goal) => (
              <li key={goal.id}>
                <span className="goal-icon">⚽</span>
                <span className="goal-name">{goal.name}</span>
                <span className="goal-count">×{goal.goals}</span>
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

          <label style={{ marginTop: 12 }}>Sélectionner une photo depuis la galerie</label>
          <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ marginBottom: '10px', display: 'block' }} />
          <p className="hint-text">L'image sera automatiquement compressée pour ne pas saturer le serveur.</p>

          {photoUrl && (
            <div className="photo-preview" style={{ textAlign: 'center', marginBottom: '15px' }}>
              <img src={photoUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'cover' }} onError={(event) => { event.target.style.display = 'none'; }} />
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
            {motmResults.slice(0, 5).map((result, index) => (
              <li key={result.id} className={`rank-${index + 1}`}>
                <span className="rank-n">{index + 1}</span>
                <div className="tile-avatar small">{result.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{result.name}</span>
                <span className="rank-stat">🏆 {result.votes}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function AdminAnnouncementsPanel({ tr, lang, announcements, onAdd, onDelete, onTogglePin }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    await onAdd(body.trim(), title.trim() || null, pinned);
    setTitle('');
    setBody('');
    setPinned(false);
  };

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('publish_announcement')}</h2></div>
        <form className="new-form" onSubmit={submit}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr('ann_title_ph')} />
          <textarea className="ann-textarea" value={body} onChange={(event) => setBody(event.target.value)} placeholder={tr('ann_body_ph')} rows={4} />
          <label className="check-row">
            <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
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
            {announcements.map((announcement) => (
              <li key={announcement.id} className={`ann-row ${announcement.pinned ? 'pinned' : ''}`}>
                <div className="ann-row-body">
                  {announcement.title && <strong className="ann-row-title">{announcement.title}</strong>}
                  <p className="ann-row-text">{announcement.body}</p>
                  <span className="ann-row-date">{fmtShortDate(announcement.created_at, lang)}</span>
                </div>
                <div className="ann-row-actions">
                  <button className="btn-ghost" onClick={() => onTogglePin(announcement)} title={tr('ann_pin_toggle')}>
                    {announcement.pinned ? '📌' : '📍'}
                  </button>
                  <button className="row-x" onClick={() => onDelete(announcement.id)}>🗑</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AdminPlanningPanel({ tr, lang, calendar, onSchedule, onDelete }) {
  const [date, setDate] = useState('');
  const [kickoff, setKickoff] = useState('10:00');
  const [notes, setNotes] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!date) return;
    try {
      await onSchedule(date, kickoff || '10:00', notes.trim() || null);
      setDate('');
      setKickoff('10:00');
      setNotes('');
    } catch {
      // géré par toast
    }
  };

  const statusLabel = (status) => (
    status === 'open' ? tr('admin_plan_status_open')
      : status === 'closed' ? tr('admin_plan_status_closed')
        : status === 'done' ? tr('admin_plan_status_done')
          : status
  );

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{tr('admin_plan_create')}</h2></div>
        <p className="pp-intro">{tr('admin_plan_intro')}</p>
        <form className="new-form" onSubmit={submit}>
          <label>{tr('admin_plan_date')}</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <label>{tr('admin_plan_kickoff')}</label>
          <input type="time" value={kickoff} onChange={(event) => setKickoff(event.target.value)} required />
          <label>{tr('admin_plan_notes')}</label>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={tr('admin_plan_notes_ph')} />
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
              {calendar.map((entry) => (
                <tr key={entry.id}>
                  <td>{fmtShortDate(entry.match_date, lang)}</td>
                  <td>{(entry.kickoff_local || '10:00').slice(0, 5)}</td>
                  <td>
                    <span className={`badge ${entry.status === 'done' ? 'badge-muted' : entry.status === 'closed' ? 'badge-yellow' : 'badge-green'}`}>
                      {statusLabel(entry.status)}
                    </span>
                  </td>
                  <td className="muted-txt">{entry.notes || '—'}</td>
                  <td>
                    {entry.status !== 'done' && (
                      <button className="row-x" onClick={() => onDelete(entry.id)} title={tr('admin_plan_delete')}>🗑</button>
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
      <div className="sheet small inventory-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{item.name}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <form
          className="new-form"
          onSubmit={async (event) => {
            event.preventDefault();
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
          }}
        >
          <label>{tr('inventory_category')}</label>
          <input value={category} onChange={(event) => setCategory(event.target.value)} required />
          <label>{tr('inventory_name')}</label>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
          <div className="inventory-form-grid compact">
            <div>
              <label>{tr('inventory_total')}</label>
              <input type="number" min="0" value={quantityTotal} onChange={(event) => setQuantityTotal(event.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_ready')}</label>
              <input type="number" min="0" max={quantityTotal} value={quantityReady} onChange={(event) => setQuantityReady(event.target.value)} required />
            </div>
          </div>
          <label>{tr('inventory_location')}</label>
          <input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} />
          <label>{tr('inventory_notes')}</label>
          <textarea className="ann-textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
  const alertCount = inventory.filter((item) => Number(item.quantity_ready || 0) < Number(item.quantity_total || 0)).length;
  const readyRatio = totalUnits ? Math.round((readyUnits / totalUnits) * 100) : 100;

  const itemStatus = (item) => {
    const total = Number(item.quantity_total || 0);
    const ready = Number(item.quantity_ready || 0);
    if (ready <= 0) return { label: tr('inventory_status_missing'), className: 'badge badge-red' };
    if (ready < total) return { label: tr('inventory_status_warn'), className: 'badge badge-yellow' };
    return { label: tr('inventory_status_ok'), className: 'badge badge-green' };
  };

  const submit = async (event) => {
    event.preventDefault();
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
              <input value={category} onChange={(event) => setCategory(event.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_name')}</label>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_total')}</label>
              <input type="number" min="0" value={quantityTotal} onChange={(event) => setQuantityTotal(event.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_ready')}</label>
              <input type="number" min="0" max={quantityTotal} value={quantityReady} onChange={(event) => setQuantityReady(event.target.value)} required />
            </div>
            <div>
              <label>{tr('inventory_location')}</label>
              <input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} />
            </div>
            <div>
              <label>{tr('inventory_notes')}</label>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
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
            {inventory.map((item) => {
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

      {editingItem && <InventoryEditorModal tr={tr} item={editingItem} onClose={() => setEditingItem(null)} onSubmit={onUpdate} />}
    </>
  );
}

function CaissePage({ tr, fines, caisse, players, onPay, onAddExpense, onAddFine }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [showFineModal, setShowFineModal] = useState(false);

  const submitExpense = (event) => {
    event.preventDefault();
    if (!reason.trim() || !amount) return;
    onAddExpense(reason.trim(), Number(amount));
    setReason('');
    setAmount('');
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
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr('reason_ph')} />
          <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={tr('amount_ph')} />
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
              {fines.map((fine) => (
                <tr key={fine.id}>
                  <td>{fine.name}</td>
                  <td>{fine.reason}</td>
                  <td>{Number(fine.amount).toFixed(2)} €</td>
                  <td>
                    {fine.paid
                      ? <span className="badge badge-green">{tr('paid_badge')}</span>
                      : <span className="badge badge-red">{tr('due')}</span>}
                  </td>
                  <td>
                    {!fine.paid && <button className="btn-ghost" onClick={() => onPay(fine.id)}>{tr('mark_paid')}</button>}
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
          onSubmit={async (playerId, reasonValue, amountValue) => {
            await onAddFine(playerId, reasonValue, amountValue);
            setShowFineModal(false);
          }}
        />
      )}
    </>
  );
}

function ManualFineModal({ tr, players, onClose, onSubmit }) {
  const [pid, setPid] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!pid || !reason.trim() || !amount) return;
    setBusy(true);
    try {
      await onSubmit(parseInt(pid, 10), reason.trim(), Number(amount));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{tr('new_fine')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <form className="new-form" onSubmit={submit}>
          <label>{tr('th_player')}</label>
          <select value={pid} onChange={(event) => setPid(event.target.value)} required>
            <option value="">{tr('pick_one')}</option>
            {(players || []).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <label>{tr('th_reason')}</label>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr('fine_reason_ph')} />
          <label>{tr('amount_eur')}</label>
          <input type="number" min="0" step="0.5" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="2.00" />
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{tr('cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy || !pid || !reason.trim() || !amount}>{busy ? '…' : tr('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onUpdateMatch({ match_date: date, kickoff_local: kickoff, notes });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form key={formKey} className="compact-admin-form" onSubmit={handleSubmit}>
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <input type="time" value={kickoff} onChange={(event) => setKickoff(event.target.value)} />
      <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={tr('admin_plan_notes_ph')} />
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? '…' : '💾'}</button>
    </form>
  );
}