// Search bar: what fans type, and what should come back.
import { searchEvents, suggestEvents } from '../../src/lib/search.js';

const ev = (id, name, startsAt, venue, city, extra = {}) => ({ id, name, posterTitle: name.toUpperCase(), subtitle: '', startsAt, venue, city, artists: [], ticketTypes: [], ...extra });
const events = [
  ev('clutch', 'Clutch Fridays', '2026-12-04T15:00:00Z', 'Clutch', 'Bangkok', { subtitle: 'House & disco', artists: ['Resident DJs'], ticketTypes: [{ name: { en: 'Entry + 1 drink', th: 'บัตรเข้างาน + เครื่องดื่ม 1 แก้ว' } }] }),
  ev('edc', 'EDC Thailand', '2026-12-18T08:00:00Z', 'Rhythm Park', 'Phuket', { subtitle: '3-day festival' }),
  ev('wp', 'White Party Bangkok', '2026-12-30T13:00:00Z', 'Paragon Hall, Siam Paragon', 'Bangkok', { subtitle: 'Main Event · NYE', artists: ['Joe Gauthreaux', 'Enrico Meloni'] }),
  ev('s2o', 'S2O Songkran', '2027-04-13T09:00:00Z', 'TBA', 'Bangkok', { subtitle: 'Water music festival' }),
];
let pass = 0, fail = 0;
const ids = (q, fn = searchEvents) => fn(events, q).map(e => e.id).join(',');
const expect = (q, want, fn) => { const got = ids(q, fn); const ok = got === want; ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  "${q}" -> ${got || '(none)'}${ok ? '' : `  (wanted ${want || '(none)'})`}`); };

expect('', 'clutch,edc,wp,s2o');
expect('white party', 'wp');
expect('WHITE   Party', 'wp');
expect('whiteparty', 'wp');
expect('party white', 'wp');
expect('gauthreaux', 'wp');
expect('enrico', 'wp');
expect('paragon', 'wp');
expect('phuket', 'edc');
expect('ภูเก็ต', 'edc');
expect('bkk', 'clutch,wp,s2o');
expect('กรุงเทพ', 'clutch,wp,s2o');
expect('december', 'clutch,edc,wp');
expect('dec', 'clutch,edc,wp');
expect('april', 's2o');
expect('ธันวาคม', 'clutch,edc,wp');
expect('friday', 'clutch,edc');
expect('nye', 'wp');
expect('disco', 'clutch');
expect('drink', 'clutch');
expect('festival', 'edc,s2o');
expect('2027', 's2o');
expect('edc', 'edc');
expect('techno berlin', '');
expect('s2o songkran', 's2o');
expect('p', 'wp,edc', (e, q) => suggestEvents(e, q).filter(x => ['wp', 'edc'].includes(x.id)));
expect('cl', 'clutch', suggestEvents);
expect('bangkok', 'wp,clutch,s2o', suggestEvents);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
