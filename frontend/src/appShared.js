import { localeFor } from './i18n';

export const POSITIONS = [
  { code: 'G', key: 'pos_G' },
  { code: 'DEF', key: 'pos_DEF' },
  { code: 'MIL', key: 'pos_MIL' },
  { code: 'ATT', key: 'pos_ATT' },
];

export const DEFAULT_KICKOFF = '10:00';

export function normalizeClockTime(value, fallback = DEFAULT_KICKOFF) {
  if (typeof value !== 'string') return fallback;
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

export function shiftClockTime(value, offsetMinutes) {
  const [hours, minutes] = normalizeClockTime(value).split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes + offsetMinutes;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const nextMinutes = String(wrapped % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

export function replaceTimeToken(text, nextTime) {
  return typeof text === 'string' ? text.replace(/\b\d{2}(?:h|:)\d{2}\b/, nextTime) : text;
}

export function formatShareTime(value, lang) {
  const normalized = normalizeClockTime(value);
  return lang === 'fr' ? normalized.replace(':', 'h') : normalized;
}

export function fmtShortDate(iso, lang) {
  return iso
    ? new Date(iso).toLocaleDateString(localeFor(lang), { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short' })
    : '';
}

export function fmtTime(iso, lang) {
  return iso
    ? new Date(iso).toLocaleTimeString(localeFor(lang), { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
    : '—';
}

export function fmtDate(iso, lang) {
  return iso
    ? new Date(iso).toLocaleDateString(localeFor(lang), { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: 'long' })
    : '';
}

function initialsFromName(value = '') {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'CM';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

export function buildProfileAvatar(name = '') {
  const initials = initialsFromName(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${initials}">
      <defs>
        <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#126746" />
          <stop offset="100%" stop-color="#e7ba3a" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="28" fill="url(#avatarGradient)" />
      <circle cx="48" cy="48" r="30" fill="rgba(255,255,255,0.14)" />
      <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}