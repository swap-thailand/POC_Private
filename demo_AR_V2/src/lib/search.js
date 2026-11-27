// Event search used by the home page search bar and its suggestions.
// Matches every word the fan types, in any order, against the event name, poster title, subtitle,
// artists, venue, city (with Thai and short names), ticket types and the date (weekday, month,
// day, year in English and Thai). Case, accents and spacing don't matter ("whiteparty" finds
// White Party). Pure functions, no network: works the same on sample data and Supabase.

const CITY_ALIASES = {
  bangkok: 'bkk กรุงเทพ กรุงเทพฯ กทม',
  phuket: 'ภูเก็ต',
  'chiang mai': 'chiangmai เชียงใหม่ cnx',
  pattaya: 'พัทยา',
  'koh phangan': 'phangan เกาะพะงัน',
};

export const normalize = s => String(s ?? '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ').trim();

function dateWords(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = 'Asia/Bangkok';
  const parts = [];
  for (const locale of ['en-GB', 'th-TH']) {
    for (const opt of [{ weekday: 'long' }, { weekday: 'short' }, { month: 'long' }, { month: 'short' }]) {
      parts.push(new Intl.DateTimeFormat(locale, { ...opt, timeZone: tz }).format(d));
    }
  }
  parts.push(new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: tz }).format(d));
  parts.push(new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: tz }).format(d));
  return parts.join(' ');
}

function haystack(ev) {
  const city = normalize(ev.city);
  const types = (ev.ticketTypes || []).flatMap(tt => [tt.name?.en, tt.name?.th]);
  return normalize([
    ev.name, ev.posterTitle, ev.subtitle, ev.venue, ev.city, CITY_ALIASES[city] || '',
    ...(ev.artists || []), ...types, dateWords(ev.startsAt),
  ].join(' '));
}

// Events that match every word of the query, in their original (date) order.
export function searchEvents(events, query) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return events;
  return events.filter(ev => {
    const hay = haystack(ev), tight = hay.replace(/ /g, '');
    return words.every(w => hay.includes(w) || tight.includes(w));
  });
}

// Best matches first, for the suggestion list: name starts with the query, then name contains it,
// then anything else (artist, venue, date). Ties keep date order.
export function suggestEvents(events, query, limit = 5) {
  const q = normalize(query);
  if (!q) return [];
  const rank = ev => {
    const name = normalize(ev.name), title = normalize(ev.posterTitle);
    if (name.startsWith(q) || title.startsWith(q)) return 0;
    if (name.includes(q) || name.replace(/ /g, '').includes(q.replace(/ /g, ''))) return 1;
    return 2;
  };
  return searchEvents(events, query)
    .map((ev, i) => ({ ev, r: rank(ev), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map(x => x.ev);
}
