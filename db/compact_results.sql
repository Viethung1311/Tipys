-- Bounded storage from this release onward. Old play_history is read once for
-- migration and is not written by the new backend. No historical rows deleted.
begin;
create table if not exists public.player_game_stats (
 user_id uuid not null references public.profiles(user_id) on delete restrict,
 game_id uuid not null references public.games(game_id) on delete restrict,
 total_active_seconds bigint not null default 0 check(total_active_seconds>=0),
 total_plays bigint not null default 0 check(total_plays>=0),
 best_play jsonb, latest_play jsonb, last_played_at timestamptz,
 primary key(user_id,game_id)
);
create index if not exists player_game_stats_game on public.player_game_stats(game_id);
create table if not exists public.active_plays (
 play_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete restrict,
 game_id uuid not null references public.games(game_id) on delete restrict,
 stage_number integer,difficulty text,score integer not null default 0,
 started_at timestamptz not null default now(),ended_at timestamptz,
 active_seconds integer not null default 0,result text not null default 'in_progress',
 metrics jsonb not null default '{}',unique(user_id,game_id)
);
create index if not exists active_plays_game on public.active_plays(game_id);
alter table public.player_game_stats enable row level security;
alter table public.active_plays enable row level security;
revoke all on public.player_game_stats,public.active_plays from public,anon,authenticated;
grant select on public.player_game_stats,public.active_plays to authenticated;
grant all on public.player_game_stats,public.active_plays to service_role;
drop policy if exists stats_read on public.player_game_stats;
create policy stats_read on public.player_game_stats for select to authenticated using(user_id=(select auth.uid()) or (select tipy_private.is_admin()));
drop policy if exists active_read on public.active_plays;
create policy active_read on public.active_plays for select to authenticated using(user_id=(select auth.uid()) or (select tipy_private.is_admin()));
with totals as (
 select user_id,game_id,sum(active_seconds) as seconds,count(*) as plays,max(started_at) as last_at from public.play_history group by user_id,game_id
), best as (
 select distinct on(user_id,game_id) user_id,game_id,to_jsonb(p) as snapshot from public.play_history p where result<>'in_progress' order by user_id,game_id,score desc,ended_at desc,play_id
), recent as (
 select distinct on(user_id,game_id) user_id,game_id,to_jsonb(p) as snapshot from public.play_history p where result<>'in_progress' order by user_id,game_id,ended_at desc,play_id
)
insert into public.player_game_stats(user_id,game_id,total_active_seconds,total_plays,last_played_at,best_play,latest_play)
select t.user_id,t.game_id,t.seconds,t.plays,t.last_at,b.snapshot,r.snapshot from totals t left join best b using(user_id,game_id) left join recent r using(user_id,game_id)
on conflict(user_id,game_id) do nothing;

create or replace function public.tipy_begin_play(p_user uuid,p_game uuid,p_difficulty text,p_keys jsonb,p_config jsonb,p_stage integer default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old public.active_plays; current_play public.active_plays; snapshot jsonb;
begin
 insert into public.player_game_stats(user_id,game_id) values(p_user,p_game) on conflict do nothing;
 perform 1 from public.player_game_stats where user_id=p_user and game_id=p_game for update;
 select * into old from public.active_plays where user_id=p_user and game_id=p_game for update;
 if found and old.result='in_progress' then
  snapshot=to_jsonb(old)||jsonb_build_object('result','quit','ended_at',now());
  update public.player_game_stats set latest_play=snapshot,
   best_play=case when best_play is null or old.score>coalesce((best_play->>'score')::integer,-1) then snapshot else best_play end
   where user_id=p_user and game_id=p_game;
 end if;
 insert into public.active_plays(user_id,game_id,difficulty,stage_number,metrics)
 values(p_user,p_game,p_difficulty,p_stage,jsonb_build_object('keys',p_keys,'config_snapshot',p_config))
 on conflict(user_id,game_id) do update set play_id=gen_random_uuid(),difficulty=excluded.difficulty,stage_number=excluded.stage_number,metrics=excluded.metrics,score=0,active_seconds=0,result='in_progress',started_at=now(),ended_at=null
 returning * into current_play;
 update public.player_game_stats set total_plays=total_plays+1,last_played_at=now() where user_id=p_user and game_id=p_game;
 return to_jsonb(current_play);
end $$;
revoke all on function public.tipy_begin_play(uuid,uuid,text,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.tipy_begin_play(uuid,uuid,text,jsonb,jsonb,integer) to service_role;

create or replace function public.tipy_save_play(p_user uuid,p_play uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old public.active_plays; updated public.active_plays; game uuid; seconds integer; snapshot jsonb;
begin
 select game_id into game from public.active_plays where play_id=p_play and user_id=p_user;
 if not found then return jsonb_build_object('superseded',true); end if;
 perform 1 from public.player_game_stats where user_id=p_user and game_id=game for update;
 select * into old from public.active_plays where play_id=p_play and user_id=p_user for update;
 if not found then return jsonb_build_object('superseded',true); end if;
 if old.result<>'in_progress' then return to_jsonb(old); end if;
 seconds=(p_values->>'active_seconds')::integer;
 if seconds<old.active_seconds or seconds>86400 or seconds>extract(epoch from now()-old.started_at)+3 or (p_values->>'score')::integer<old.score then raise exception 'Invalid monotonic progress'; end if;
 if p_values->>'result' not in ('in_progress','completed','game_over','quit') then raise exception 'Invalid result'; end if;
 update public.active_plays set score=(p_values->>'score')::integer,active_seconds=seconds,stage_number=(p_values->>'stage_number')::integer,result=p_values->>'result',ended_at=(p_values->>'ended_at')::timestamptz,metrics=p_values->'metrics' where play_id=p_play returning * into updated;
 snapshot=to_jsonb(updated);
 update public.player_game_stats set total_active_seconds=total_active_seconds+seconds-old.active_seconds,
  latest_play=case when updated.result<>'in_progress' then snapshot else latest_play end,
  best_play=case when updated.result<>'in_progress' and (best_play is null or updated.score>coalesce((best_play->>'score')::integer,-1)) then snapshot else best_play end
  where user_id=p_user and game_id=game;
 if updated.result<>'in_progress' then
  update public.active_plays set score=0,active_seconds=0,metrics='{}',difficulty=null,stage_number=null where play_id=p_play;
 end if;
 return snapshot;
end $$;
revoke all on function public.tipy_save_play(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_save_play(uuid,uuid,jsonb) to service_role;
commit;
