-- Familias
create table if not exists families (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Miembros
create table if not exists family_members (
  id               uuid default gen_random_uuid() primary key,
  family_id        uuid references families(id) on delete cascade not null,
  name             text not null,
  emoji            text not null default '👤',
  type             text not null check (type in ('adult','child')),
  age              int,
  weight_kg        numeric,
  height_cm        numeric,
  goal             text check (goal in ('deficit','deficit_agresivo','mantenimiento','volumen','crecimiento')),
  activity_level   text check (activity_level in ('sedentary','moderate','active','very_active')),
  eating_style     text not null default 'omnivore',
  conditions       text[] not null default '{}',
  allergies        text[] not null default '{}',
  prohibited       text[] not null default '{}',
  dislikes         text[] not null default '{}',
  restrictions_prep text[] not null default '{}',
  created_at       timestamptz default now()
);

-- RLS
alter table families enable row level security;
alter table family_members enable row level security;

create policy "familia propia" on families
  for all using (auth.uid() = owner_id);

create policy "miembros de familia propia" on family_members
  for all using (
    family_id in (select id from families where owner_id = auth.uid())
  );
