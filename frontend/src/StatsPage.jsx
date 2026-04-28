export default function StatsPage({ tr, scorers, attendance, isAdmin = false, onRevokeAttendance }) {
  const totalGoals = scorers.reduce((sum, scorer) => sum + Number(scorer.goals || 0), 0);
  const activePlayers = attendance.filter((player) => player.total > 0).length;
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
        {scorers.filter((scorer) => scorer.goals > 0).length === 0 ? (
          <p className="empty-row">{tr('no_goals_season')}</p>
        ) : (
          <ol className="rank-list">
            {scorers.filter((scorer) => scorer.goals > 0).slice(0, 10).map((scorer, index) => (
              <li key={scorer.id} className={`rank-${index + 1}`}>
                <span className="rank-n">{index + 1}</span>
                <div className="tile-avatar small">{scorer.name.slice(0, 1).toUpperCase()}</div>
                <span className="rank-name">{scorer.name}</span>
                <span className="rank-stat">⚽ {scorer.goals}</span>
                <span className="rank-stat">🅰 {scorer.assists}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{tr('attendance_punct')}</h2></div>
        {attendance.filter((player) => player.total > 0).length === 0 ? (
          <p className="empty-row">{tr('no_history')}</p>
        ) : (
          <div className="stats-table-wrap">
            <table className="presences-table stats-attendance-table">
              <thead>
                <tr>
                  <th>{tr('th_player')}</th>
                  <th>{tr('th_present')}</th>
                  <th>{tr('th_lates')}</th>
                  <th>{tr('th_absences')}</th>
                  <th>{tr('th_punctuality')}</th>
                  {isAdmin ? <th>{tr('th_action')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {attendance.filter((player) => player.total > 0).slice(0, 30).map((player) => {
                  const punctuality = player.shows ? Math.round(((player.shows - player.lates) / player.shows) * 100) : 0;
                  return (
                    <tr key={player.id}>
                      <td data-label={tr('th_player')}>{player.name}</td>
                      <td data-label={tr('th_present')}>{player.shows}</td>
                      <td data-label={tr('th_lates')}>{player.lates}</td>
                      <td data-label={tr('th_absences')}>{player.absences}</td>
                      <td data-label={tr('th_punctuality')}><span className={`badge ${punctuality >= 80 ? 'badge-green' : punctuality >= 50 ? 'badge-yellow' : 'badge-red'}`}>{punctuality}%</span></td>
                      {isAdmin ? (
                        <td data-label={tr('th_action')}>
                          <button className="btn-ghost btn-choice-edit" onClick={() => onRevokeAttendance?.(player.id)}>{tr('admin_stats_revoke')}</button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
