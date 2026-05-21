-- ============================================================
-- Helsinki Explorer — Initial Schema
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────

-- Profiles — one per auth user, created automatically on sign-up
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  display_name    text,
  avatar_url      text,
  total_points    integer not null default 0,
  level           integer not null default 1,
  is_anonymous    boolean not null default true
);

-- Places — Helsinki POIs (seeded below)
create table if not exists public.places (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  name            text not null,
  name_fi         text,
  description     text,
  description_fi  text,
  category        text not null,         -- food | sauna | museums | design | nature | night | arch | shop | family | history | cafe | events
  lat             double precision not null,
  lng             double precision not null,
  address         text,
  image_url       text,
  rating          numeric(2,1),          -- 1.0–5.0
  price_level     integer,               -- 1–4 (matches budget tiers)
  tags            text[] not null default '{}',
  opening_hours   jsonb,
  website         text
);

-- Trips — one per planning session
create table if not exists public.trips (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'My Helsinki',
  duration_days   integer not null check (duration_days between 1 and 14),
  budget_level    integer not null check (budget_level between 1 and 3),
  interests       text[] not null default '{}',
  status          text not null default 'planning' check (status in ('planning','active','completed')),
  start_date      date
);

-- Trip days — one row per calendar day within a trip
create table if not exists public.trip_days (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  day_number      integer not null,
  title           text,
  date            date,
  notes           text,
  unique (trip_id, day_number)
);

-- Trip activities — ordered stops within a day
create table if not exists public.trip_activities (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  trip_day_id     uuid not null references public.trip_days(id) on delete cascade,
  place_id        uuid references public.places(id) on delete set null,
  title           text not null,
  description     text,
  order_index     integer not null default 0,
  duration_minutes integer,
  completed       boolean not null default false,
  custom_location text
);

-- Achievements — static catalogue
create table if not exists public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  key         text not null unique,
  title       text not null,
  description text not null,
  icon        text not null,
  points      integer not null default 0,
  category    text not null
);

-- User achievements — which badges a user has earned
create table if not exists public.user_achievements (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  achievement_id  uuid not null references public.achievements(id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  unique (user_id, achievement_id)
);

-- Points history — audit log
create table if not exists public.points_history (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  points          integer not null,
  reason          text not null,
  reference_id    uuid,
  reference_type  text
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists trips_user_id_idx        on public.trips(user_id);
create index if not exists trip_days_trip_id_idx    on public.trip_days(trip_id);
create index if not exists trip_act_day_id_idx      on public.trip_activities(trip_day_id);
create index if not exists places_category_idx      on public.places(category);
create index if not exists places_price_level_idx   on public.places(price_level);

-- ── updated_at auto-trigger ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- ── Auto-create profile on new user ──────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, is_anonymous)
  values (new.id, (new.raw_user_meta_data->>'is_anonymous')::boolean is not distinct from true)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.places          enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_days       enable row level security;
alter table public.trip_activities enable row level security;
alter table public.achievements    enable row level security;
alter table public.user_achievements enable row level security;
alter table public.points_history  enable row level security;

-- Profiles: users can only read/update their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);

-- Places: everyone can read (public POI data)
create policy "places: public read"  on public.places  for select using (true);

-- Trips: own only
create policy "trips: own read"   on public.trips for select using (auth.uid() = user_id);
create policy "trips: own insert" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips: own update" on public.trips for update using (auth.uid() = user_id);
create policy "trips: own delete" on public.trips for delete using (auth.uid() = user_id);

-- Trip days: accessible via trip ownership
create policy "trip_days: own read"   on public.trip_days for select using (
  exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid())
);
create policy "trip_days: own insert" on public.trip_days for insert with check (
  exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid())
);
create policy "trip_days: own update" on public.trip_days for update using (
  exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid())
);
create policy "trip_days: own delete" on public.trip_days for delete using (
  exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.user_id = auth.uid())
);

-- Trip activities: accessible via trip_day → trip ownership
create policy "trip_activities: own read"   on public.trip_activities for select using (
  exists (
    select 1 from public.trip_days
    join public.trips on trips.id = trip_days.trip_id
    where trip_days.id = trip_activities.trip_day_id and trips.user_id = auth.uid()
  )
);
create policy "trip_activities: own insert" on public.trip_activities for insert with check (
  exists (
    select 1 from public.trip_days
    join public.trips on trips.id = trip_days.trip_id
    where trip_days.id = trip_activities.trip_day_id and trips.user_id = auth.uid()
  )
);
create policy "trip_activities: own update" on public.trip_activities for update using (
  exists (
    select 1 from public.trip_days
    join public.trips on trips.id = trip_days.trip_id
    where trip_days.id = trip_activities.trip_day_id and trips.user_id = auth.uid()
  )
);

-- Achievements: public read
create policy "achievements: public read" on public.achievements for select using (true);

-- User achievements: own only
create policy "user_achievements: own read"   on public.user_achievements for select using (auth.uid() = user_id);
create policy "user_achievements: own insert" on public.user_achievements for insert with check (auth.uid() = user_id);

-- Points history: own only
create policy "points_history: own read"   on public.points_history for select using (auth.uid() = user_id);
create policy "points_history: own insert" on public.points_history for insert with check (auth.uid() = user_id);

-- ── Seed: Helsinki Places ─────────────────────────────────────
insert into public.places (name, name_fi, description, category, lat, lng, address, price_level, rating, tags) values

-- Cafés
('Sävy',               'Sävy',              'Neighbourhood café famous for cinnamon buns and specialty coffee.',               'cafe',    60.1579, 24.9331, 'Tehtaankatu 27, Eira',             1, 4.6, '{"cinnamon bun","coffee","quiet"}'),
('Good Life Coffee',   'Good Life Coffee',  'Specialty roaster in Kallio, minimalist and calm.',                              'cafe',    60.1840, 24.9510, 'Kolmas linja 17, Kallio',          1, 4.7, '{"specialty coffee","roaster","Kallio"}'),
('Kaffa Roastery',     'Kaffa Roastery',    'Pioneering Helsinki specialty coffee roastery.',                                 'cafe',    60.1659, 24.9396, 'Pursimiehenkatu 29, Punavuori',    1, 4.5, '{"specialty coffee","roastery"}'),

-- Food
('Old Market Hall',    'Vanha kauppahalli', 'Historic 1889 market hall — salmon soup, rye bread, Finnish delicacies.',       'food',    60.1672, 24.9522, 'Eteläranta 1, Kauppatori',         2, 4.5, '{"market","salmon","Finnish","historic"}'),
('Ravintola Story',    'Ravintola Story',   'Nordic cuisine with seasonal Finnish ingredients, long weekend lunches.',        'food',    60.1601, 24.9458, 'Kasarmikatu 22, Centre',           2, 4.6, '{"Nordic","lunch","seasonal"}'),
('Ravintola Nokka',    'Ravintola Nokka',   'Farm-to-table Finnish fine dining in a renovated warehouse by the harbour.',    'food',    60.1656, 24.9559, 'Kanavaranta 7F, Katajanokka',      3, 4.7, '{"fine dining","harbour","Finnish"}'),
('Ravintola Olo',      'Ravintola Olo',     'Two Michelin-star tasting menu celebrating Finnish nature.',                    'food',    60.1670, 24.9543, 'Pohjoisesplanadi 5, Centre',       3, 4.8, '{"Michelin","tasting menu","luxury"}'),
('Hakaniemi Market',   'Hakaniemen kauppahalli', 'Two-floor covered market: local produce, Finnish street food.',           'food',    60.1788, 24.9499, 'Hämeentie 1, Hakaniemi',           1, 4.3, '{"market","local","street food"}'),

-- Saunas
('Löyly',              'Löyly',             'Design sauna on the waterfront — smoke sauna, sea swimming, restaurant.',       'sauna',   60.1547, 24.9215, 'Hernesaarenranta 4, Hernesaari',   2, 4.7, '{"smoke sauna","sea swim","design","restaurant"}'),
('Allas Sea Pool',     'Allas Sea Pool',    'Harbour pools, saunas and a restaurant right by the Market Square.',           'sauna',   60.1673, 24.9556, 'Katajanokanlaituri 2a, Kauppatori',2, 4.4, '{"sea pool","harbour","sauna","restaurant"}'),
('Kotiharju Sauna',    'Kotiharju Sauna',   'Helsinki''s oldest public wood-fired sauna, run continuously since 1928.',     'sauna',   60.1885, 24.9577, 'Harjutorinkatu 1, Kallio',         1, 4.8, '{"wood-fired","public","historic","Kallio"}'),

-- Museums & Art
('Amos Rex',           'Amos Rex',          'Art museum with a stunning underground space and biomorphic skylights.',        'museums', 60.1698, 24.9357, 'Mannerheimintie 22–24, Centre',    2, 4.8, '{"contemporary art","architecture","underground"}'),
('Kiasma',             'Kiasma',            'Museum of contemporary art — bold architecture by Steven Holl.',               'museums', 60.1716, 24.9319, 'Mannerheiminaukio 2, Centre',      2, 4.4, '{"contemporary art","Steven Holl","architecture"}'),
('Finnish National Museum', 'Kansallismuseo', 'National history museum in a National Romantic building from 1910.',         'history', 60.1741, 24.9312, 'Mannerheimintie 34, Centre',       1, 4.4, '{"history","National Romantic","architecture"}'),
('HAM Helsinki',       'HAM Helsinki',      'Helsinki Art Museum — Finnish 20th century art and city collection.',          'museums', 60.1747, 24.9317, 'Eteläinen Rautatiekatu 8, Centre', 1, 4.3, '{"Finnish art","city art","20th century"}'),

-- Architecture & Design
('Oodi Central Library','Oodi',             'Award-winning 2018 public library — timber waves, reading decks, maker space.','arch',    60.1741, 24.9305, 'Töölönlahdenkatu 4, Centre',       1, 4.9, '{"library","award-winning","timber","public space"}'),
('Helsinki Cathedral',  'Helsingin tuomiokirkko', 'Neoclassical 1852 cathedral dominating Senate Square.',               'arch',    60.1699, 24.9525, 'Unioninkatu 29, Senate Square',     1, 4.6, '{"cathedral","neoclassical","Senate Square","landmark"}'),
('Design Museum',       'Designmuseo',       'Collection of Finnish design — Aalto, Marimekko, Arabia.',                   'design',  60.1621, 24.9449, 'Korkeavuorenkatu 23, Kaartinkaupunki',1, 4.3,'{"Finnish design","Aalto","Marimekko","Arabia"}'),
('Temppeliaukio Church','Temppeliaukio',     'Rock church blasted into solid granite — natural light, extraordinary acoustics.','arch',60.1664, 24.9253, 'Lutherinkatu 3, Töölö',            1, 4.7, '{"rock church","unique","architecture","acoustics"}'),

-- Nature & Archipelago
('Suomenlinna',        'Suomenlinna',       'UNESCO sea fortress on 6 islands — 15-min ferry from Market Square.',         'nature',  60.1453, 24.9881, 'Suomenlinna ferry from Kauppatori', 1, 4.8, '{"UNESCO","fortress","ferry","islands","history"}'),
('Seurasaari',         'Seurasaari',        'Open-air museum island with traditional Finnish farmsteads.',                  'nature',  60.1815, 24.8875, 'Seurasaari, Munkkiniemi',          1, 4.4, '{"open-air museum","island","nature","Finnish heritage"}'),
('Kaivopuisto Park',   'Kaivopuisto',       'Helsinki''s oldest park — sea views, picnics, art installations.',           'nature',  60.1552, 24.9398, 'Puistokatu, Kaivopuisto',          1, 4.5, '{"park","sea view","picnic","history"}'),

-- Shopping & Design District
('Marimekko Flagship', 'Marimekko',         'Iconic Finnish design brand — flagship store with full collection.',           'shop',    60.1683, 24.9483, 'Pohjoisesplanadi 33, Centre',      2, 4.4, '{"Finnish design","flagship","textile","fashion"}'),
('Artek',              'Artek',             'Alvar Aalto''s design brand — furniture, lighting, accessories.',              'shop',    60.1688, 24.9476, 'Eteläesplanadi 18, Centre',        3, 4.5, '{"Aalto","furniture","Finnish design","luxury"}'),
('Hietalahti Flea Market','Hietalahden tori','Helsinki''s largest outdoor flea market — vintage, local, unique finds.',   'shop',    60.1609, 24.9268, 'Hietalahdentori, Punavuori',       1, 4.2, '{"flea market","vintage","outdoor","unique"}');

-- ── Seed: Achievements ────────────────────────────────────────
insert into public.achievements (key, title, description, icon, points, category) values
('first_trip',       'Helsinki Rookie',         'Created your first Helsinki trip.',                     '🗺',  50,  'milestone'),
('cafe_5',           'Aamukahvi',               'Visited 5 cafés. The cinnamon bun life chose you.',     '☕',  100, 'food'),
('sauna_3',          'Saunamestari',            'Visited 3 saunas. Wood smoke, cold sea, repeat.',       '♨',  150, 'sauna'),
('suomenlinna',      'Saaristoseilari',         'Made it to Suomenlinna by ferry.',                      '⛵',  75,  'nature'),
('design_5',         'Designsisäänpiiri',       'Explored 5 design or architecture stops.',              '◎',  100, 'design'),
('ferry_3',          'Lautan kuningas',         'Took 3 ferry trips.',                                   '🚢', 100, 'nature'),
('food_3',           'Kalakukko',               'Tasted 3 traditional Finnish dishes.',                  '🐟', 100, 'food'),
('night_1',          'Yömyssy',                 'Visited somewhere open past 22:00.',                    '🌙', 75,  'nightlife'),
('all_complete',     'Helsinki sydämessä',      'Completed every activity in a trip.',                   '❤',  200, 'milestone');
