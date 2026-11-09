-- TIPY STEM · PostgreSQL/Supabase schema. Review/apply to a NEW TIPY project.
-- No SQL Server GO/IDENTITY statements and no plaintext passwords.
begin;
create schema if not exists tipy_private;
revoke all on schema tipy_private from public, anon, authenticated;

create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete restrict,
 username text not null unique check (username ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
 full_name text not null check (length(trim(full_name)) between 1 and 100),
 role text not null default 'student' check (role in ('student','admin')),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.games (
 game_id uuid primary key default gen_random_uuid(),
 game_code text not null unique check (game_code ~ '^[a-z][a-z0-9_]{0,49}$'),
 game_name text not null check (length(trim(game_name)) between 1 and 100),
 engine_code text not null default 'falling_letters',
 description text not null default '',
 is_active boolean not null default true,
 config jsonb not null default '{}' check (jsonb_typeof(config)='object'),
 created_at timestamptz not null default now()
);
create table if not exists public.play_history (
 play_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete restrict,
 game_id uuid not null references public.games(game_id) on delete restrict,
 stage_number integer check (stage_number >= 1),
 difficulty text check (length(difficulty) between 1 and 40),
 score integer not null default 0 check (score >= 0),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 active_seconds integer not null default 0 check (active_seconds >= 0),
 result text not null default 'in_progress' check (result in ('in_progress','completed','game_over','quit')),
 metrics jsonb not null default '{}' check (jsonb_typeof(metrics)='object'),
 check ((result='in_progress' and ended_at is null) or (result<>'in_progress' and ended_at is not null and ended_at>=started_at))
);
create index if not exists play_history_user_time on public.play_history(user_id, started_at desc);
create index if not exists play_history_game_user on public.play_history(game_id,user_id);
create index if not exists profiles_student_active on public.profiles(role,is_active);

-- A private lookup prevents recursive profiles RLS. Roles come from the DB,
-- never user-editable JWT user_metadata. Function is not exposed as an RPC.
create or replace function tipy_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where user_id=(select auth.uid()) and role='admin' and is_active);
$$;
revoke all on function tipy_private.is_admin() from public;
grant usage on schema tipy_private to authenticated;
grant execute on function tipy_private.is_admin() to authenticated;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.play_history enable row level security;
revoke all on public.profiles,public.games,public.play_history from anon,authenticated;
grant select on public.profiles,public.games,public.play_history to authenticated;
grant select on public.games to anon;
grant all on public.profiles,public.games,public.play_history to service_role;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
 using(user_id=(select auth.uid()) or (select tipy_private.is_admin()));
drop policy if exists games_read on public.games;
create policy games_read on public.games for select to anon,authenticated using(is_active);
drop policy if exists games_admin_read on public.games;
create policy games_admin_read on public.games for select to authenticated using((select tipy_private.is_admin()));
drop policy if exists history_read on public.play_history;
create policy history_read on public.play_history for select to authenticated
 using(user_id=(select auth.uid()) or (select tipy_private.is_admin()));

create or replace function tipy_private.new_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare chosen_username text := lower(trim(new.raw_user_meta_data->>'username'));
begin
 insert into public.profiles(user_id,username,full_name,role)
 values(new.id,chosen_username,trim(new.raw_user_meta_data->>'full_name'),'student');
 return new;
end $$;
revoke all on function tipy_private.new_profile() from public,anon,authenticated;
drop trigger if exists tipy_new_user on auth.users;
create trigger tipy_new_user after insert on auth.users for each row execute function tipy_private.new_profile();

-- Durable shared rate limits. No IP addresses are stored: backend passes HMACs.
create table if not exists tipy_private.auth_limits (
 bucket_key text primary key, attempts integer not null, expires_at timestamptz not null
);
alter table tipy_private.auth_limits enable row level security;
grant usage on schema tipy_private to service_role;
grant all on tipy_private.auth_limits to service_role;
create or replace function public.tipy_auth_limit(p_key text,p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare used integer;
begin
 if length(p_key)<>64 or p_limit not in (10,60) then raise exception 'Invalid rate limit'; end if;
 delete from tipy_private.auth_limits where expires_at<now()-interval '1 day';
 insert into tipy_private.auth_limits as limits(bucket_key,attempts,expires_at)
 values(p_key,1,now()+interval '5 minutes')
 on conflict(bucket_key) do update set
  attempts=case when limits.expires_at<now() then 1 else limits.attempts+1 end,
  expires_at=case when limits.expires_at<now() then now()+interval '5 minutes' else limits.expires_at end
 returning attempts into used;
 return used<=p_limit;
end $$;
revoke all on function public.tipy_auth_limit(text,integer) from public,anon,authenticated;
grant execute on function public.tipy_auth_limit(text,integer) to service_role;

insert into public.games(game_code,game_name,engine_code,description,config)
values('falling_letters','Chữ rơi','falling_letters','Luyện phím với những chữ cái đang rơi.',
 '{"levels":{"easy":{"fall":9,"minFall":5,"spawn":2,"minSpawn":1.2,"max":4},"normal":{"fall":7,"minFall":4,"spawn":1.5,"minSpawn":0.9,"max":6},"hard":{"fall":5.5,"minFall":3,"spawn":1.1,"minSpawn":0.65,"max":8}}}'::jsonb)
on conflict(game_code) do nothing;
commit;
