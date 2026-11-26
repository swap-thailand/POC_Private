-- Starter events: the same four events the site shows as "Example" events (src/services/seed.js),
-- written for the existing events table (migration 20261122000000_marketplace.sql). Not a migration:
-- run it by hand in the SQL editor of the project you choose (a dev/staging project first).
--
-- They go in UNPUBLISHED. The site keeps showing its labelled example events until at least one
-- upcoming event is published. Check each date, venue, face value and transfer rule with the
-- organiser, then publish (bottom of this file). Publishing one real event makes every example
-- disappear from the site automatically (settings.showcase.mode = 'auto').
--
-- Re-running is safe: rows are matched on poster_title + starts_at and skipped if present.
-- Poster art: the site matches poster_title (WHITE PARTY, CLUTCH, EDC, S2O) to the same artwork.
-- face_value_thb: the v1 schema has one face value per event, so this is the main GA ticket.

insert into public.events (name, poster_title, subtitle, starts_at, venue, city, artists, transfer_en, transfer_th, face_value_thb, published)
select v.* from (values
  ('White Party Bangkok', 'WHITE PARTY', 'Main Event · NYE', timestamptz '2026-12-30 20:00+07', 'Paragon Hall, Siam Paragon', 'Bangkok',
   array['Joe Gauthreaux', 'Enrico Meloni'],
   'Name change in pre-registration (allowed once). Collect the wristband with matching ID.',
   'เปลี่ยนชื่อตอนลงทะเบียนล่วงหน้า (ได้ครั้งเดียว) รับริสต์แบนด์ด้วยบัตรประชาชนที่ชื่อตรงกัน', 3200, false),
  ('Clutch Fridays', 'CLUTCH', 'House & disco', timestamptz '2026-12-04 22:00+07', 'Clutch', 'Bangkok',
   array['Resident DJs'],
   'QR e-ticket reissued to the buyer by the seller.',
   'ผู้ขายออกอีทิกเก็ต QR ใหม่ในชื่อผู้ซื้อ', 250, false),
  ('EDC Thailand', 'EDC', '3-day festival', timestamptz '2026-12-18 15:00+07', 'Rhythm Park', 'Phuket',
   array['Under the Electric Sky'],
   'Unworn delivered wristband, handed over in person.',
   'ริสต์แบนด์ที่ยังไม่ได้ใส่ ส่งมอบตัวต่อตัว', 9590, false),
  ('S2O Songkran', 'S2O', 'Water music festival', timestamptz '2027-04-13 16:00+07', 'TBA', 'Bangkok',
   array['Lineup TBA'],
   'To be announced.',
   'ยังไม่ประกาศ', 3000, false)
) as v(name, poster_title, subtitle, starts_at, venue, city, artists, transfer_en, transfer_th, face_value_thb, published)
where not exists (
  select 1 from public.events e where e.poster_title = v.poster_title and e.starts_at = v.starts_at
);

-- Clutch Fridays is weekly: add one row per Friday you want listed (copy the Clutch line above
-- and change starts_at), or move it forward each week.

-- S2O is a face-value-only event. After migration 20261126000000 is applied:
-- update public.events set strict_face_value = true where poster_title = 'S2O';

-- Publish when checked (this switches the site from example events to real ones):
-- update public.events set published = true where poster_title in ('WHITE PARTY', 'CLUTCH', 'EDC');
