-- ============================================================
-- Helsinki Explorer — Final schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: drops and recreates all tables cleanly
-- ============================================================

-- Drop everything in dependency order
drop table if exists public.points_history cascade;
drop table if exists public.user_achievements cascade;
drop table if exists public.trip_activities cascade;
drop table if exists public.trip_days cascade;
drop table if exists public.trips cascade;
drop table if exists public.achievements cascade;
drop table if exists public.places cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user cascade;

-- ── Places ───────────────────────────────────────────────────
create table public.places (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_fi       text,
  description   text,
  description_fi text,
  category      text not null,
  lat           numeric(9,6) not null,
  lng           numeric(9,6) not null,
  address       text,
  price_level   integer default 1,
  rating        numeric(2,1),
  tags          text[] not null default '{}',
  opening_hours jsonb,
  image_url     text,
  website       text,
  created_at    timestamptz default now()
);

alter table public.places enable row level security;
create policy "Places are publicly readable" on public.places
  for select to anon, authenticated using (true);

-- ── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade unique not null,
  display_name text,
  avatar_url   text,
  total_points integer not null default 0,
  level        integer not null default 1,
  is_anonymous boolean not null default true,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles
  for all to anon, authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, is_anonymous)
  values (new.id, (new.raw_app_meta_data->>'provider' = 'anonymous'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trips ────────────────────────────────────────────────────
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  title         text not null default 'My Helsinki',
  duration_days integer,
  budget_level  integer default 1,
  interests     text[] not null default '{}',
  status        text not null default 'planning',
  start_date    date,
  created_at    timestamptz default now()
);

alter table public.trips enable row level security;
create policy "Users manage own trips" on public.trips
  for all to anon, authenticated using (user_id = auth.uid());

-- ── Trip days ────────────────────────────────────────────────
create table public.trip_days (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid references public.trips on delete cascade not null,
  day_number integer not null,
  title      text,
  date       date,
  notes      text,
  created_at timestamptz default now()
);

alter table public.trip_days enable row level security;
create policy "Users manage own trip days" on public.trip_days
  for all to anon, authenticated
  using (trip_id in (select id from public.trips where user_id = auth.uid()));

-- ── Trip activities ──────────────────────────────────────────
create table public.trip_activities (
  id               uuid primary key default gen_random_uuid(),
  trip_day_id      uuid references public.trip_days on delete cascade not null,
  place_id         uuid references public.places,
  title            text,
  description      text,
  order_index      integer not null default 0,
  duration_minutes integer,
  completed        boolean not null default false,
  custom_location  text,
  created_at       timestamptz default now()
);

alter table public.trip_activities enable row level security;
create policy "Users manage own activities" on public.trip_activities
  for all to anon, authenticated
  using (trip_day_id in (
    select id from public.trip_days where trip_id in (
      select id from public.trips where user_id = auth.uid()
    )
  ));

-- ── Achievements ─────────────────────────────────────────────
create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  title       text not null,
  description text not null,
  icon        text not null,
  points      integer not null default 0,
  category    text not null,
  created_at  timestamptz default now()
);

alter table public.achievements enable row level security;
create policy "Achievements are publicly readable" on public.achievements
  for select to anon, authenticated using (true);

-- ── User achievements ────────────────────────────────────────
create table public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade not null,
  achievement_id uuid references public.achievements on delete cascade not null,
  unlocked_at    timestamptz default now(),
  created_at     timestamptz default now(),
  unique (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;
create policy "Users manage own achievements" on public.user_achievements
  for all to anon, authenticated using (user_id = auth.uid());

-- ── Points history ───────────────────────────────────────────
create table public.points_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade not null,
  points         integer not null,
  reason         text not null,
  reference_id   uuid,
  reference_type text,
  created_at     timestamptz default now()
);

alter table public.points_history enable row level security;
create policy "Users manage own points history" on public.points_history
  for all to anon, authenticated using (user_id = auth.uid());

-- ── Grants ───────────────────────────────────────────────────
grant select on public.places to anon, authenticated;
grant select, insert, update, delete on public.trips to anon, authenticated;
grant select, insert, update, delete on public.trip_days to anon, authenticated;
grant select, insert, update, delete on public.trip_activities to anon, authenticated;
grant select on public.achievements to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;
grant select, insert on public.user_achievements to anon, authenticated;
grant select, insert on public.points_history to anon, authenticated;

-- ── Seed: Places ─────────────────────────────────────────────
insert into public.places (name, name_fi, description, category, lat, lng, address, price_level, rating, tags) values
('Sävy',               'Sävy',              'Neighbourhood café famous for cinnamon buns and specialty coffee.',               'cafe',    60.1579, 24.9331, 'Tehtaankatu 27, Eira',                 1, 4.6, '{"cinnamon bun","coffee","quiet"}'),
('Good Life Coffee',   'Good Life Coffee',  'Specialty roaster in Kallio, minimalist and calm.',                              'cafe',    60.1840, 24.9510, 'Kolmas linja 17, Kallio',              1, 4.7, '{"specialty coffee","roaster","Kallio"}'),
('Kaffa Roastery',     'Kaffa Roastery',    'Pioneering Helsinki specialty coffee roastery.',                                 'cafe',    60.1659, 24.9396, 'Pursimiehenkatu 29, Punavuori',        1, 4.5, '{"specialty coffee","roastery"}'),
('Old Market Hall',    'Vanha kauppahalli', 'Historic 1889 market hall — salmon soup, rye bread, Finnish delicacies.',       'food',    60.1672, 24.9522, 'Eteläranta 1, Kauppatori',             2, 4.5, '{"market","salmon","Finnish","historic"}'),
('Ravintola Story',    'Ravintola Story',   'Nordic cuisine with seasonal Finnish ingredients, long weekend lunches.',        'food',    60.1601, 24.9458, 'Kasarmikatu 22, Centre',               2, 4.6, '{"Nordic","lunch","seasonal"}'),
('Ravintola Nokka',    'Ravintola Nokka',   'Farm-to-table Finnish fine dining in a renovated warehouse by the harbour.',    'food',    60.1656, 24.9559, 'Kanavaranta 7F, Katajanokka',          3, 4.7, '{"fine dining","harbour","Finnish"}'),
('Ravintola Olo',      'Ravintola Olo',     'Two Michelin-star tasting menu celebrating Finnish nature.',                    'food',    60.1670, 24.9543, 'Pohjoisesplanadi 5, Centre',           3, 4.8, '{"Michelin","tasting menu","luxury"}'),
('Hakaniemi Market',   'Hakaniemen kauppahalli', 'Two-floor covered market: local produce, Finnish street food.',           'food',    60.1788, 24.9499, 'Hämeentie 1, Hakaniemi',               1, 4.3, '{"market","local","street food"}'),
('Löyly',              'Löyly',             'Design sauna on the waterfront — smoke sauna, sea swimming, restaurant.',       'sauna',   60.1547, 24.9215, 'Hernesaarenranta 4, Hernesaari',       2, 4.7, '{"smoke sauna","sea swim","design","restaurant"}'),
('Allas Sea Pool',     'Allas Sea Pool',    'Harbour pools, saunas and a restaurant right by the Market Square.',           'sauna',   60.1673, 24.9556, 'Katajanokanlaituri 2a, Kauppatori',    2, 4.4, '{"sea pool","harbour","sauna","restaurant"}'),
('Kotiharju Sauna',    'Kotiharju Sauna',   'Helsinki''s oldest public wood-fired sauna, run continuously since 1928.',     'sauna',   60.1885, 24.9577, 'Harjutorinkatu 1, Kallio',             1, 4.8, '{"wood-fired","public","historic","Kallio"}'),
('Amos Rex',           'Amos Rex',          'Art museum with a stunning underground space and biomorphic skylights.',        'museums', 60.1698, 24.9357, 'Mannerheimintie 22–24, Centre',        2, 4.8, '{"contemporary art","architecture","underground"}'),
('Kiasma',             'Kiasma',            'Museum of contemporary art — bold architecture by Steven Holl.',               'museums', 60.1716, 24.9319, 'Mannerheiminaukio 2, Centre',          2, 4.4, '{"contemporary art","Steven Holl","architecture"}'),
('Finnish National Museum', 'Kansallismuseo', 'National history museum in a National Romantic building from 1910.',        'history', 60.1741, 24.9312, 'Mannerheimintie 34, Centre',           1, 4.4, '{"history","National Romantic","architecture"}'),
('HAM Helsinki',       'HAM Helsinki',      'Helsinki Art Museum — Finnish 20th century art and city collection.',          'museums', 60.1747, 24.9317, 'Eteläinen Rautatiekatu 8, Centre',     1, 4.3, '{"Finnish art","city art","20th century"}'),
('Oodi Central Library','Oodi',             'Award-winning 2018 public library — timber waves, reading decks, maker space.','arch',    60.1741, 24.9305, 'Töölönlahdenkatu 4, Centre',           1, 4.9, '{"library","award-winning","timber","public space"}'),
('Helsinki Cathedral', 'Helsingin tuomiokirkko', 'Neoclassical 1852 cathedral dominating Senate Square.',                  'arch',    60.1699, 24.9525, 'Unioninkatu 29, Senate Square',        1, 4.6, '{"cathedral","neoclassical","Senate Square","landmark"}'),
('Design Museum',      'Designmuseo',       'Collection of Finnish design — Aalto, Marimekko, Arabia.',                    'design',  60.1621, 24.9449, 'Korkeavuorenkatu 23, Kaartinkaupunki', 1, 4.3, '{"Finnish design","Aalto","Marimekko","Arabia"}'),
('Temppeliaukio Church','Temppeliaukio',    'Rock church blasted into solid granite — natural light, extraordinary acoustics.','arch', 60.1664, 24.9253, 'Lutherinkatu 3, Töölö',               1, 4.7, '{"rock church","unique","architecture","acoustics"}'),
('Suomenlinna',        'Suomenlinna',       'UNESCO sea fortress on 6 islands — 15-min ferry from Market Square.',         'nature',  60.1453, 24.9881, 'Ferry from Kauppatori',                1, 4.8, '{"UNESCO","fortress","ferry","islands","history"}'),
('Seurasaari',         'Seurasaari',        'Open-air museum island with traditional Finnish farmsteads.',                  'nature',  60.1815, 24.8875, 'Seurasaari, Munkkiniemi',              1, 4.4, '{"open-air museum","island","nature","Finnish heritage"}'),
('Kaivopuisto Park',   'Kaivopuisto',       'Helsinki''s oldest park — sea views, picnics, art installations.',            'nature',  60.1552, 24.9398, 'Puistokatu, Kaivopuisto',              1, 4.5, '{"park","sea view","picnic","history"}'),
('Marimekko Flagship', 'Marimekko',         'Iconic Finnish design brand — flagship store with full collection.',           'shop',    60.1683, 24.9483, 'Pohjoisesplanadi 33, Centre',          2, 4.4, '{"Finnish design","flagship","textile","fashion"}'),
('Artek',              'Artek',             'Alvar Aalto''s design brand — furniture, lighting, accessories.',              'shop',    60.1688, 24.9476, 'Eteläesplanadi 18, Centre',            3, 4.5, '{"Aalto","furniture","Finnish design","luxury"}'),
('Hietalahti Flea Market','Hietalahdentori','Helsinki''s largest outdoor flea market — vintage, local, unique finds.',     'shop',    60.1609, 24.9268, 'Hietalahdentori, Punavuori',           1, 4.2, '{"flea market","vintage","outdoor","unique"}');

-- ── Seed: Achievements ───────────────────────────────────────
insert into public.achievements (key, title, description, icon, points, category) values
('first_trip',   'Helsinki Rookie',      'Created your first Helsinki trip.',               '🗺',  50,  'milestone'),
('cafe_5',       'Aamukahvi',            'Visited 5 cafés. The cinnamon bun life chose you.','☕', 100, 'food'),
('sauna_3',      'Saunamestari',         'Visited 3 saunas. Wood smoke, cold sea, repeat.',  '♨',  150, 'sauna'),
('suomenlinna',  'Saaristoseilari',      'Made it to Suomenlinna by ferry.',                '⛵',  75,  'nature'),
('design_5',     'Designsisäänpiiri',    'Explored 5 design or architecture stops.',         '◎',  100, 'design'),
('ferry_3',      'Lautan kuningas',      'Took 3 ferry trips.',                             '🚢', 100, 'nature'),
('food_3',       'Kalakukko',            'Tasted 3 traditional Finnish dishes.',             '🐟', 100, 'food'),
('night_1',      'Yömyssy',             'Visited somewhere open past 22:00.',               '🌙', 75,  'nightlife'),
('all_complete', 'Helsinki sydämessä',   'Completed every activity in a trip.',              '❤',  200, 'milestone');
