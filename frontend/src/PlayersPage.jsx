import { useMemo, useState } from 'react';
import { api } from './api';
import { buildProfileAvatar, POSITIONS } from './appShared';

function AttendanceChangeModal({ tr, attendance, onClose, onSubmit }) {
  const [intent, setIntent] = useState(attendance.status === 'absent' ? 'no' : attendance.status === 'maybe' ? 'maybe' : 'yes');
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

export default function PlayersPage({
  tr,
  isAdmin,
  currentUser,
  players,
  attendees,
  onReload,
  flash,
  onRequireAuth,
}) {
  const [adding, setAdding] = useState(false);
  const [attendanceEditor, setAttendanceEditor] = useState(null);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const presentIds = new Set(attendees.filter((attendance) => attendance.status !== 'maybe' && attendance.status !== 'absent').map((attendance) => attendance.player_id));
  const attendanceByPlayerId = useMemo(() => new Map(attendees.map((attendance) => [attendance.player_id, attendance])), [attendees]);
  const positionCount = attendees.filter((attendance) => !!attendance.position).length;

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createPlayer({ name: name.trim(), rating: Number(rating) });
      setName('');
      setRating(5);
      setAdding(false);
      onReload();
      flash(tr('player_added', { name: name.trim() }));
    } catch (error) {
      flash(error.message, 'err');
    }
  };

  const remove = async (player) => {
    if (!confirm(tr('delete_confirm', { name: player.name }))) return;
    try {
      await api.deletePlayer(player.id);
      onReload();
      flash(tr('player_removed'));
    } catch (error) {
      flash(error.message, 'err');
    }
  };

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
          {isAdmin ? (
            <button className="btn-primary" onClick={() => setAdding((value) => !value)}>{adding ? tr('cancel') : tr('add_btn')}</button>
          ) : (
            <button className="btn-ghost btn-choice-edit" onClick={() => onRequireAuth(null)}>{currentUser ? tr('auth_account') : tr('auth_login_short')}</button>
          )}
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
            <strong>{positionCount}</strong>
            <span>{tr('players_positions_ready')}</span>
          </div>
        </div>
        {isAdmin && adding && (
          <form className="inline-form" onSubmit={submit}>
            <input placeholder={tr('full_name_ph')} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            <label className="rating-input">{tr('player_internal_rating')}: <strong>{rating}</strong>
              <input type="range" min="1" max="10" step="0.5" value={rating} onChange={(event) => setRating(event.target.value)} />
            </label>
            <button className="btn-primary" type="submit">{tr('save')}</button>
          </form>
        )}
        {players.length === 0 ? (
          <p className="empty-row">{tr('no_players')}</p>
        ) : (
          <table className="presences-table player-status-table">
            <thead><tr><th>{tr('th_name')}</th><th>{tr('th_position')}</th><th>{tr('th_sunday')}</th><th>{tr('th_action')}</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {players.map((player) => {
                const attendance = attendanceByPlayerId.get(player.id);
                const isCurrentUser = currentUser?.id === player.id;
                const canEditChoice = isCurrentUser && !!attendance;
                const avatarSrc = player.avatarUrl || (isCurrentUser && currentUser?.avatarUrl ? currentUser.avatarUrl : buildProfileAvatar(player.name));
                return (
                  <tr key={player.id}>
                    <td data-label={tr('th_name')}>
                      <div className="player-identity">
                        <img className="player-avatar" src={avatarSrc} alt={player.name} loading="lazy" decoding="async" />
                        <div className="player-meta">
                          <span>{player.name}</span>
                          {isCurrentUser ? <span className="mini-tag self-tag">{tr('auth_me_badge')}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td data-label={tr('th_position')}>{attendance?.position ? <span className={`pos-tag pos-${attendance.position}`}>{attendance.position}</span> : <span className="muted-txt">—</span>}</td>
                    <td data-label={tr('th_sunday')}>{sundayStatus(attendance)}</td>
                    <td className="player-status-action-cell" data-label={tr('th_action')}>
                      {canEditChoice ? (
                        <button className="btn-ghost btn-choice-edit" onClick={() => setAttendanceEditor(attendance)}>{tr('player_change_choice')}</button>
                      ) : isCurrentUser && !attendance ? (
                        <button className="btn-ghost btn-choice-edit" onClick={() => onRequireAuth('auth_go_home_prompt')}>{tr('auth_go_home')}</button>
                      ) : (
                        <span className="muted-txt">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td><button className="row-x" onClick={() => remove(player)}>🗑</button></td>
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
