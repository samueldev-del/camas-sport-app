import { useState } from 'react';
import {
  POSITIONS,
  formatShareTime,
  normalizeClockTime,
  replaceTimeToken,
  shiftClockTime,
} from './appShared';

export default function StadiumPage({ tr, lang, isAdmin, teams, match, goals, onReload, onSetPosition }) {
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
  const goalsByPlayer = Object.fromEntries(goals.map((goal) => [goal.player_id, goal]));
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

  const shareToWhatsApp = () => {
    if (!teamA || !teamB) return;
    const format = teams?.format?.format || '';
    const shareMeetingTime = formatShareTime(meetingTime, lang);
    const shareKickoffTime = formatShareTime(kickoffTime, lang);

    let msg = `${tr('wa_title')}\n\n`;
    msg += `${replaceTimeToken(tr('wa_meet'), shareMeetingTime)}\n`;
    if (format) msg += `${tr('wa_format')} ${format}\n`;
    msg += '\n';

    msg += `${tr('wa_team_a')} (${teamA.total.toFixed(1)} pts)\n`;
    teamA.starters.forEach((player) => { msg += `• ${player.name}${player.position ? ` (${player.position})` : ''}\n`; });
    if (teamA.subs.length > 0) msg += `${tr('wa_subs')} ${teamA.subs.map((sub) => sub.name).join(', ')}\n`;
    msg += '\n';

    msg += `${tr('wa_team_b')} (${teamB.total.toFixed(1)} pts)\n`;
    teamB.starters.forEach((player) => { msg += `• ${player.name}${player.position ? ` (${player.position})` : ''}\n`; });
    if (teamB.subs.length > 0) msg += `${tr('wa_subs')} ${teamB.subs.map((sub) => sub.name).join(', ')}\n`;
    msg += '\n';

    msg += replaceTimeToken(tr('wa_warn_late'), shareKickoffTime);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
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
            {teamSummaries.map((summary) => (
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
                  {summary.preview.map((player) => (
                    <span key={player.id} className="team-showcase-pill">{player.name.split(' ')[0]}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <Pitch tr={tr} isAdmin={isAdmin} teamA={teamA.starters} teamB={teamB.starters} goalsByPlayer={goalsByPlayer} onSetPosition={onSetPosition} />
      </section>

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
              {goals.map((goal) => {
                const teamLetter = teamA.starters.some((player) => player.id === goal.player_id)
                  ? 'A'
                  : teamB.starters.some((player) => player.id === goal.player_id)
                    ? 'B'
                    : null;
                return (
                  <li key={goal.id}>
                    <span className="goal-icon">⚽</span>
                    <span className="goal-name">{goal.name}</span>
                    {teamLetter && <span className={`pos-tag pos-team-${teamLetter}`}>{teamLetter === 'A' ? tr('team_a') : tr('team_b')}</span>}
                    <span className="goal-count">×{goal.goals}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{tr('subs_title')}</h2></div>
        <div className="subs-grid">
          <div className="sub-team sub-team-a">
            <h4>{tr('team_a')} · {teamA.subs.length} {tr('subs_count')}</h4>
            {teamA.subs.length === 0 ? <p className="empty-row small">{tr('none')}</p> : (
              <ul className="subs-list">
                {teamA.subs.map((player) => (
                  <li key={player.id}>
                    <div className="tile-avatar small">{player.name.slice(0, 1).toUpperCase()}</div>
                    <span>{player.name}</span>
                    <span className="rating-pill">{player.rating.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sub-team sub-team-b">
            <h4>{tr('team_b')} · {teamB.subs.length} {tr('subs_count')}</h4>
            {teamB.subs.length === 0 ? <p className="empty-row small">{tr('none')}</p> : (
              <ul className="subs-list">
                {teamB.subs.map((player) => (
                  <li key={player.id}>
                    <div className="tile-avatar small">{player.name.slice(0, 1).toUpperCase()}</div>
                    <span>{player.name}</span>
                    <span className="rating-pill">{player.rating.toFixed(1)}</span>
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
    const grouped = { G: [], DEF: [], MIL: [], ATT: [] };
    team.forEach((player) => { grouped[player.position || 'MIL'].push(player); });
    return grouped;
  };

  const groupedA = groupByPos(teamA);
  const groupedB = groupByPos(teamB);

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
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedA.G} label="G" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedA.DEF} label="DEF" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedA.MIL} label="MIL" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedA.ATT} label="ATT" team="A" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
      </div>

      <div className="pitch-half pitch-half-b">
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedB.ATT} label="ATT" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedB.MIL} label="MIL" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedB.DEF} label="DEF" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
        <PositionRow tr={tr} isAdmin={isAdmin} players={groupedB.G} label="G" team="B" goalsByPlayer={goalsByPlayer} onSet={onSetPosition} />
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
        ) : players.map((player) => (
          <PlayerDot key={player.id} tr={tr} isAdmin={isAdmin} player={player} team={team} goals={goalsByPlayer[player.id]?.goals || 0} onSet={onSet} currentPos={label} />
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
        onClick={() => isAdmin && setMenuOpen((open) => !open)}
        title={isAdmin ? tr('click_change_pos') : ''}
      >
        <span className="dot-name">{player.name.split(' ')[0]}</span>
        {goals > 0 && <span className="dot-goals">⚽{goals}</span>}
      </button>
      {menuOpen && isAdmin && (
        <div className="dot-menu" onMouseLeave={() => setMenuOpen(false)}>
          {POSITIONS.map((position) => (
            <button
              key={position.code}
              className={currentPos === position.code ? 'active' : ''}
              onClick={() => {
                onSet(player.id, position.code);
                setMenuOpen(false);
              }}
            >
              {position.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}