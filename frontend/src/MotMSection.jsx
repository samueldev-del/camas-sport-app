import { useEffect, useState } from 'react';
import { api } from './api';
import { fmtShortDate } from './appShared';

export default function MotMSection({ tr, lang, match, attendees, players, results, lastWinner, currentUser, onRequireAuth, onVote }) {
  const [votedId, setVotedId] = useState('');
  const [busy, setBusy] = useState(false);
  const currentUserId = currentUser?.id || null;

  const voters = (attendees || [])
    .filter((attendance) => attendance.status !== 'maybe' && attendance.status !== 'absent')
    .map((attendance) => {
      const player = (players || []).find((candidate) => candidate.id === attendance.player_id);
      return { id: attendance.player_id, name: player?.name || attendance.name };
    });
  const currentVoter = currentUserId ? voters.find((voter) => voter.id === currentUserId) : null;
  const candidates = voters.filter((voter) => voter.id !== currentUserId);
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

  const submit = async (event) => {
    event.preventDefault();
    if (!votedId) return;
    if (currentUser && parseInt(currentUser.id, 10) === parseInt(votedId, 10)) {
      alert(tr('motm_self_vote_err'));
      return;
    }
    setBusy(true);
    try {
      await onVote(parseInt(votedId, 10));
    } finally {
      setBusy(false);
    }
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
          <select value={votedId} onChange={(event) => setVotedId(event.target.value)} required>
            <option value="">{tr('pick_one')}</option>
            {candidates.map((voter) => <option key={voter.id} value={voter.id}>{voter.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary motm-submit" disabled={busy || !votedId}>{busy ? '…' : tr('motm_submit')}</button>
      </form>

      {results && results.length > 0 && (
        <div className="motm-results">
          <h3>{tr('motm_results')}</h3>
          <ol className="rank-list motm-rank-list">
            {results.slice(0, 3).map((result, index) => (
              <li key={result.id} className={`rank-${index + 1} motm-rank-card`}>
                <span className="rank-n">{index + 1}</span>
                <div className="tile-avatar small">{result.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{result.name}</span>
                <span className="rank-stat">🏆 {result.votes} {result.votes > 1 ? tr('motm_votes') : tr('motm_one_vote')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}