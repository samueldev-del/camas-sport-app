import { fmtShortDate } from './appShared';

export function PublicAnnouncementsSection({ tr, lang, announcements }) {
  return (
    <section className="panel public-ann">
      <div className="panel-head"><h2>{tr('public_ann_title')}</h2></div>
      {(!announcements || announcements.length === 0) ? (
        <p className="empty-row">{tr('public_ann_empty')}</p>
      ) : (
        <ul className="public-ann-list">
          {announcements.slice(0, 5).map(a => (
            <li key={a.id} className={`public-ann-row ${a.pinned ? 'pinned' : ''}`}>
              {a.pinned && <span className="pin-flag">📌</span>}
              {a.title && <strong className="public-ann-title">{a.title}</strong>}
              <p className="public-ann-body">{a.body}</p>
              <span className="public-ann-date">{fmtShortDate(a.created_at, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WinningGallerySection({ tr, lang, gallery }) {
  return (
    <section className="panel gallery-section">
      <div className="panel-head"><h2>{tr('gallery_title')}</h2></div>
      {(!gallery || gallery.length === 0) ? (
        <p className="empty-row">{tr('gallery_empty')}</p>
      ) : (
        <div className="gallery-grid">
          {gallery.map(g => {
            const winnerLabel =
              g.winner_team === 'A' ? tr('winner_a') :
              g.winner_team === 'B' ? tr('winner_b') :
              tr('winner_draw');
            return (
              <article key={g.id} className="gallery-card">
                <div className="gallery-photo">
                  <img src={g.photo_url} alt={`${tr('gallery_winner')} ${fmtShortDate(g.match_date, lang)}`} loading="lazy" decoding="async" />
                </div>
                <div className="gallery-meta">
                  <span className="gallery-date">{fmtShortDate(g.match_date, lang)}</span>
                  <span className="gallery-score">
                    {g.team_a_score ?? '–'} : {g.team_b_score ?? '–'}
                  </span>
                  <span className={`gallery-winner gallery-winner-${g.winner_team || 'draw'}`}>
                    🏆 {winnerLabel}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
