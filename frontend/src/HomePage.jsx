import { Suspense, lazy, useState } from 'react';
import { localeFor } from './i18n';
import {
  POSITIONS,
  buildProfileAvatar,
  fmtShortDate,
  fmtDate,
  fmtTime,
  normalizeClockTime,
  shiftClockTime,
  replaceTimeToken,
} from './appShared';

const MotMSection = lazy(() => import('./MotMSection'));

/* ========================================================
   LAST MATCH CARD — résumé du match précédent
   ======================================================== */
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
          {scorers.map((scorer) => (
            <span key={scorer.id} className="scorer-pill">
              ⚽ {scorer.name} {scorer.goals > 1 && `×${scorer.goals}`}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ========================================================
   PRESENCE CHOICE MODAL — choisir son poste avant confirmation
   ======================================================== */
function PresenceChoiceModal({ tr, currentUser, onClose, onSubmit }) {
  const [position, setPosition] = useState(null);
  const introCopy = currentUser
    ? tr('auth_presence_intro', { name: currentUser.name || '' })
    : tr('auth_presence_intro_guest');

  return (
    <div className="sheet-overlay quick-choice-overlay" onClick={onClose}>
      <div className="sheet small choice-sheet quick-choice-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{tr('confirm_presence')}</h3>
          <button className="ghost-btn" onClick={onClose}>✕</button>
        </div>
        <p className="pp-intro">{introCopy}</p>
        <div className="position-picker compact">
          <div className="position-grid">
            {POSITIONS.map((option) => (
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
   HOME PAGE — tableau de bord principal
   ======================================================== */
export default function HomePage({
  tr, lang,
  currentUser, birthdaysToday,
  match, attendees, players, scorers, attStats,
  setSelectedPlayerCard, lastMatch,
  motmResults, motmLast,
  onRequireAuth, onConfirm, onUnvote, onMotmVote,
}) {
  const [presenceOpen, setPresenceOpen] = useState(false);
  const topScorer = scorers.find((s) => Number(s.goals) > 0);
  const birthdayLead = birthdaysToday[0] || null;
  const isCurrentUserBirthday = !!currentUser && birthdaysToday.some((player) => player.id === currentUser.id);

  const fmt = { type: tr('stadium'), format: '11 vs 11' };

  const confirmedAttendees = attendees.filter((a) => a.status !== 'maybe' && a.status !== 'absent');
  const yesCount = confirmedAttendees.length;
  const maybeCount = attendees.filter((a) => a.status === 'maybe').length;
  const kickoffTime = normalizeClockTime(match?.kickoff_local);
  const meetingTime = shiftClockTime(kickoffTime, -15);
  const lateFineHint = replaceTimeToken(tr('late_fine_sub'), kickoffTime);
  const matchNote = match?.notes?.trim();
  const birthdayList = birthdaysToday.length
    ? new Intl.ListFormat(localeFor(lang), { style: 'long', type: 'conjunction' }).format(birthdaysToday.map((player) => player.name))
    : '';
  const birthdayHeroTitle = isCurrentUserBirthday
    ? tr('birthday_today_title_self', { name: currentUser.name.split(' ')[0] || currentUser.name })
    : tr('birthday_today_title');
  const birthdayHeroCopy = isCurrentUserBirthday
    ? tr('birthday_today_copy_self')
    : tr('birthday_today_copy', { names: birthdayList });

  const handleIntent = async (intent) => {
    if (intent === 'yes') {
      setPresenceOpen(true);
      return;
    }
    if (!currentUser) {
      onRequireAuth();
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
            <div className="birthday-banner-main">
              <span className="birthday-kicker">{tr('birthday_today_label')}</span>
              <div className="birthday-banner-hero">
                {(isCurrentUserBirthday ? currentUser : birthdayLead) && (
                  <span className="birthday-avatar-shell">
                    <img
                      className="birthday-avatar"
                      src={isCurrentUserBirthday ? (currentUser.avatarUrl || buildProfileAvatar(currentUser.name)) : buildProfileAvatar(birthdayLead.name)}
                      alt={isCurrentUserBirthday ? currentUser.name : birthdayLead.name}
                    />
                  </span>
                )}
                <div>
                  <h2>{birthdayHeroTitle}</h2>
                  <p className="birthday-copy">{birthdayHeroCopy}</p>
                  {isCurrentUserBirthday ? <p className="birthday-signature">{tr('birthday_today_signature')}</p> : null}
                </div>
              </div>
            </div>
            <div className="birthday-spotlight">
              <span className="birthday-emoji">🎂</span>
              <strong>{birthdaysToday.length}</strong>
              <span>{tr('birthday_today_spotlight')}</span>
            </div>
          </div>
          <div className="birthday-players">
            {birthdaysToday.map((player) => (
              <div key={player.id} className={`birthday-player-pill ${player.id === currentUser?.id ? 'is-current-user' : ''}`}>
                <span className="birthday-player-avatar-shell">
                  <img className="birthday-player-avatar" src={player.id === currentUser?.id ? (currentUser.avatarUrl || buildProfileAvatar(player.name)) : buildProfileAvatar(player.name)} alt={player.name} />
                </span>
                <div className="birthday-player-copy">
                  <strong>{player.name}</strong>
                  <span>{tr('birthday_today_age', { age: player.age })}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Suspense fallback={<section className="panel"><p className="empty-row">{tr('loading')}</p></section>}>
        <MotMSection
          key={`${match?.id || 'no-match'}-${currentUser?.id || 'guest'}`}
          tr={tr} lang={lang}
          currentUser={currentUser}
          match={match} attendees={attendees} players={players}
          results={motmResults} lastWinner={motmLast}
          onRequireAuth={onRequireAuth}
          onVote={onMotmVote}
        />
      </Suspense>

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
              {confirmedAttendees.map((a) => (
                <tr key={a.id}>
                  <td onClick={() => {
                    const stats = scorers.find((s) => s.id === a.player_id || s.id === a.id) || {};
                    const att = attStats.find((at) => at.id === a.player_id || at.id === a.id) || {};
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

      {presenceOpen && (
        <PresenceChoiceModal
          tr={tr}
          currentUser={currentUser}
          onSubmit={async (position) => {
            if (!currentUser) {
              setPresenceOpen(false);
              onRequireAuth();
              return;
            }
            await onConfirm('yes', position);
            setPresenceOpen(false);
          }}
          onClose={() => setPresenceOpen(false)}
        />
      )}
    </>
  );
}
