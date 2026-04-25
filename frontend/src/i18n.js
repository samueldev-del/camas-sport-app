// Dictionnaire FR/DE pour CAMAS Sport
// Usage : import { t } from './i18n'; t(lang, 'key') ou t(lang, 'key', { vars })

const FR = {
  // Header / navigation
  app_title:        'CAMAS · Dimanche Foot',
  tab_home:         'Accueil',
  tab_players:      'Joueurs',
  tab_teams:        'Équipes',
  tab_stats:        'Statistiques',
  tab_caisse:       'Caisse',
  install_btn:      '📲 Installer',
  admin_login:      'Admin',
  admin_logout:     'Sortir',
  lang_label:       'Langue',

  // Home / dashboard
  attendance_board: 'Tableau de présences',
  next_match:       'Prochain match · Dimanche',
  kickoff:          'Coup d\'envoi',
  meeting_at:       'Rendez-vous',
  meeting_sub:      '(Installation & Échauffement)',
  vote_yes:         'Je viens jouer',
  vote_maybe:       'Je ne suis pas sûr',
  vote_no:          'Je ne serai pas là',
  poll_closed:      'Sondage clôturé',
  late_fine:        'Amende retard',
  late_fine_sub:    '(après 10:00 précises)',
  rules_title:      'Règles d\'or',
  rule_1:           'Respect des délais d\'inscription',
  rule_2:           'Ponctualité stricte exigée',
  rule_3:           'Coopération pour le matériel',
  top_scorer:       'Meilleur buteur',
  no_goals_yet:     'Pas encore de but enregistré.',
  formation:        'Formation équipes',
  auto_split:       'Répartition automatisée',
  registered:       'Inscrits',
  teams_count:      'Équipes',
  format:           'Format',

  // Last match card
  last_match:       'Dernier match',
  vs:               'VS',
  scorers:          'Buteurs',

  // Table headers
  th_name:          'Nom',
  th_position:      'Poste',
  th_status:        'Statut',
  th_arrival:       'Arrivée',
  th_level:         'Niveau',
  th_sunday:        'Dimanche',

  // Status pills
  status_confirmed: 'Confirmé',
  status_late:      'Retard',
  status_maybe:     'Peut-être',
  status_absent:    'Absent',
  status_dash:      '—',

  // Player picker
  who_confirms:     'Qui s\'inscrit ?',
  new_player:       'Nouveau joueur',
  pick_intent:      'Quelle est ton intention ?',
  pick_position:    'Ton poste, {name} ?',
  position_intro:   'À quel poste tu joues dimanche ?',
  pos_G:            'Gardien',
  pos_DEF:          'Défenseur',
  pos_MIL:          'Milieu',
  pos_ATT:          'Attaquant',
  search_placeholder:'🔍 Rechercher…',
  full_name:        'Nom et prénom',
  level:            'Niveau',
  back:             '← Retour',
  next:             'Suivant →',
  cancel:           'Annuler',
  confirm_presence: '✅ Confirmer ma présence',
  confirm_maybe:    '🤔 Confirmer « peut-être »',
  confirm_absent:   '❌ Confirmer mon absence',

  // Stadium / teams
  stadium:          'Le stade',
  redraw_teams:     '↻ Re-tirer les équipes',
  team_a:           'Équipe A',
  team_b:           'Équipe B',
  gap:              'écart',
  pt:               'pt',
  not_enough:       'Il faut au moins 2 joueurs inscrits pour composer les équipes.',
  loading:          'Chargement…',
  click_change_pos: 'Cliquer pour changer de poste',

  // Score / goals
  match_result:     '📊 Résultat du match',
  save_score:       '💾 Enregistrer le score',
  buteurs:          '⚽ Buteurs',
  pick_player:      '— choisir un joueur —',
  add_goal:         '+ Ajouter but(s)',
  subs_title:       '🔁 Remplaçants',
  subs_count:       'remplaçant(s)',
  none:             'Aucun',

  // Players page
  manage_players:   'Gestion des joueurs',
  add_btn:          '+ Ajouter',
  full_name_ph:     'Nom complet',
  save:             'Enregistrer',
  no_players:       'Aucun joueur pour l\'instant.',
  delete_confirm:   'Supprimer {name} ?',
  no_attendance:    'Aucune inscription pour le moment.',

  // Stats
  top_scorers_season:'🥇 Top buteurs de la saison',
  no_goals_season:  'Aucun but enregistré pour l\'instant.',
  attendance_punct: '📅 Assiduité & ponctualité',
  no_history:       'Pas encore d\'historique.',
  th_player:        'Joueur',
  th_present:       'Présences',
  th_lates:         'Retards',
  th_absences:      'Absences',
  th_punctuality:   'Ponctualité',

  // Caisse
  cash_balance:     'Solde de la caisse CAMAS',
  paid:             '✅ Payé',
  due:              '⏳ Dû',
  expenses:         '💸 Dépenses',
  add_expense:      '📥 Ajouter une dépense',
  reason_ph:        'Motif (ex: ballons)',
  amount_ph:        '€',
  expense_btn:      '+ Dépense',
  fines:            '🧾 Amendes',
  manual_fine:      '+ Manuelle',
  no_fines:         'Aucune amende — RAS 🎉',
  th_reason:        'Motif',
  th_amount:        'Montant',
  mark_paid:        'Marquer payé',
  paid_badge:       'Payé',
  new_fine:         'Nouvelle amende',
  pick_one:         '— choisir —',
  fine_reason_ph:   'ex: oubli maillot',
  amount_eur:       'Montant (€)',

  // Admin
  admin_modal_title:'Mode administrateur',
  admin_intro:      'Saisis le code admin que t\'a fourni le responsable.',
  admin_code:       'Code admin',
  admin_unlock:     '🔓 Déverrouiller',
  admin_ok:         'Mode admin activé',
  admin_locked:     'Réservé aux admins',
  admin_locked_hint:'Connecte-toi en mode admin pour accéder à cette section.',

  // Toasts
  presence_ok:      'Présence confirmée ⚽',
  presence_late:    'Présence confirmée — retard noté (2€)',
  maybe_ok:         '« Peut-être » enregistré',
  absent_ok:        'Absence enregistrée',
  presence_cancel:  'Présence annulée',
  player_added:     '{name} ajouté',
  player_removed:   'Joueur supprimé',
  score_saved:      'Score enregistré ⚽',
  goal_saved:       'Buteur enregistré',
  fine_paid:        'Amende marquée payée',
  fine_added:       'Amende ajoutée',
  expense_added:    'Dépense enregistrée',
  network_err:      'Réseau indisponible — réessaie dans un instant',
  invalid_admin:    'Code admin invalide',
  pin_required:     'Saisis le code',

  // Footer
  footer_stadium:   '📍 Stade',
  footer_resp:      '⚽ Responsable',
  footer_paypal:    '💳 PayPal / Finances',
  footer_resp_sub:  'CAMAS e.V. — 3ème mi-temps',
};

const DE = {
  // Header / navigation
  app_title:        'CAMAS · Sonntagsfußball',
  tab_home:         'Übersicht',
  tab_players:      'Spieler',
  tab_teams:        'Mannschaften',
  tab_stats:        'Statistik',
  tab_caisse:       'Kasse',
  install_btn:      '📲 Installieren',
  admin_login:      'Admin',
  admin_logout:     'Logout',
  lang_label:       'Sprache',

  // Home / dashboard
  attendance_board: 'Anwesenheitsliste',
  next_match:       'Nächstes Spiel · Sonntag',
  kickoff:          'Anstoß',
  meeting_at:       'Treffpunkt',
  meeting_sub:      '(Aufbau & Aufwärmen)',
  vote_yes:         'Ich werde spielen',
  vote_maybe:       'Ich bin nicht sicher',
  vote_no:          'Ich kann nicht',
  poll_closed:      'Umfrage geschlossen',
  late_fine:        'Verspätungsstrafe',
  late_fine_sub:    '(nach 10:00 Uhr)',
  rules_title:      'Goldene Regeln',
  rule_1:           'Anmeldefristen einhalten',
  rule_2:           'Strikte Pünktlichkeit',
  rule_3:           'Hilfe beim Material',
  top_scorer:       'Top-Torschütze',
  no_goals_yet:     'Noch keine Tore registriert.',
  formation:        'Mannschaftsaufstellung',
  auto_split:       'Automatische Aufteilung',
  registered:       'Angemeldet',
  teams_count:      'Mannschaften',
  format:           'Format',

  // Last match card
  last_match:       'Letztes Spiel',
  vs:               'VS',
  scorers:          'Torschützen',

  // Table headers
  th_name:          'Name',
  th_position:      'Position',
  th_status:        'Status',
  th_arrival:       'Ankunft',
  th_level:         'Niveau',
  th_sunday:        'Sonntag',

  // Status pills
  status_confirmed: 'Bestätigt',
  status_late:      'Verspätet',
  status_maybe:     'Vielleicht',
  status_absent:    'Abwesend',
  status_dash:      '—',

  // Player picker
  who_confirms:     'Wer meldet sich an?',
  new_player:       'Neuer Spieler',
  pick_intent:      'Was ist deine Absicht?',
  pick_position:    'Deine Position, {name}?',
  position_intro:   'Auf welcher Position spielst du am Sonntag?',
  pos_G:            'Torwart',
  pos_DEF:          'Verteidiger',
  pos_MIL:          'Mittelfeld',
  pos_ATT:          'Stürmer',
  search_placeholder:'🔍 Suchen…',
  full_name:        'Vor- und Nachname',
  level:            'Niveau',
  back:             '← Zurück',
  next:             'Weiter →',
  cancel:           'Abbrechen',
  confirm_presence: '✅ Anwesenheit bestätigen',
  confirm_maybe:    '🤔 « Vielleicht » bestätigen',
  confirm_absent:   '❌ Abwesenheit bestätigen',

  // Stadium
  stadium:          'Das Stadion',
  redraw_teams:     '↻ Mannschaften neu losen',
  team_a:           'Team A',
  team_b:           'Team B',
  gap:              'Differenz',
  pt:               'Pkt',
  not_enough:       'Mindestens 2 angemeldete Spieler für die Aufstellung erforderlich.',
  loading:          'Lädt…',
  click_change_pos: 'Klicken, um Position zu ändern',

  // Score / goals
  match_result:     '📊 Spielergebnis',
  save_score:       '💾 Ergebnis speichern',
  buteurs:          '⚽ Torschützen',
  pick_player:      '— Spieler auswählen —',
  add_goal:         '+ Tor(e) hinzufügen',
  subs_title:       '🔁 Ersatzspieler',
  subs_count:       'Ersatzspieler',
  none:             'Keine',

  // Players page
  manage_players:   'Spielerverwaltung',
  add_btn:          '+ Hinzufügen',
  full_name_ph:     'Vollständiger Name',
  save:             'Speichern',
  no_players:       'Noch keine Spieler.',
  delete_confirm:   '{name} löschen?',
  no_attendance:    'Noch keine Anmeldungen.',

  // Stats
  top_scorers_season:'🥇 Top-Torschützen der Saison',
  no_goals_season:  'Noch keine Tore in dieser Saison.',
  attendance_punct: '📅 Anwesenheit & Pünktlichkeit',
  no_history:       'Noch keine Historie.',
  th_player:        'Spieler',
  th_present:       'Anwesenheiten',
  th_lates:         'Verspätungen',
  th_absences:      'Abwesenheiten',
  th_punctuality:   'Pünktlichkeit',

  // Caisse
  cash_balance:     'Kassenstand CAMAS',
  paid:             '✅ Bezahlt',
  due:              '⏳ Offen',
  expenses:         '💸 Ausgaben',
  add_expense:      '📥 Ausgabe hinzufügen',
  reason_ph:        'Grund (z. B. Bälle)',
  amount_ph:        '€',
  expense_btn:      '+ Ausgabe',
  fines:            '🧾 Strafen',
  manual_fine:      '+ Manuell',
  no_fines:         'Keine Strafen — alles ok 🎉',
  th_reason:        'Grund',
  th_amount:        'Betrag',
  mark_paid:        'Als bezahlt markieren',
  paid_badge:       'Bezahlt',
  new_fine:         'Neue Strafe',
  pick_one:         '— auswählen —',
  fine_reason_ph:   'z. B. Trikot vergessen',
  amount_eur:       'Betrag (€)',

  // Admin
  admin_modal_title:'Administrator-Modus',
  admin_intro:      'Gib den Admin-Code ein, den dir der Verantwortliche gegeben hat.',
  admin_code:       'Admin-Code',
  admin_unlock:     '🔓 Entsperren',
  admin_ok:         'Admin-Modus aktiviert',
  admin_locked:     'Nur für Admins',
  admin_locked_hint:'Melde dich im Admin-Modus an, um auf diesen Bereich zuzugreifen.',

  // Toasts
  presence_ok:      'Anwesenheit bestätigt ⚽',
  presence_late:    'Anwesenheit bestätigt — Verspätung notiert (2€)',
  maybe_ok:         '« Vielleicht » gespeichert',
  absent_ok:        'Abwesenheit gespeichert',
  presence_cancel:  'Anmeldung storniert',
  player_added:     '{name} hinzugefügt',
  player_removed:   'Spieler gelöscht',
  score_saved:      'Ergebnis gespeichert ⚽',
  goal_saved:       'Torschütze gespeichert',
  fine_paid:        'Strafe als bezahlt markiert',
  fine_added:       'Strafe hinzugefügt',
  expense_added:    'Ausgabe gespeichert',
  network_err:      'Netzwerk nicht erreichbar — bitte erneut versuchen',
  invalid_admin:    'Ungültiger Admin-Code',
  pin_required:     'Bitte Code eingeben',

  // Footer
  footer_stadium:   '📍 Stadion',
  footer_resp:      '⚽ Verantwortlicher',
  footer_paypal:    '💳 PayPal / Finanzen',
  footer_resp_sub:  'CAMAS e.V. — 3. Halbzeit',
};

export const DICTS = { fr: FR, de: DE };
export const LANGS = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

export function t(lang, key, vars = {}) {
  const dict = DICTS[lang] || FR;
  let str = dict[key] ?? FR[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// Locale Intl pour formatage date/heure
export const localeFor = (lang) => (lang === 'de' ? 'de-DE' : 'fr-FR');
