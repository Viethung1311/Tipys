-- Additive extension of the existing TIPY database; do not re-run the base schema.
begin;
create table if not exists public.player_lesson_progress (
 user_id uuid not null references public.profiles(user_id) on delete restrict,
 game_id uuid not null references public.games(game_id) on delete restrict,
 lesson_id text not null check(length(lesson_id) between 1 and 40),
 lesson_version integer not null default 1 check(lesson_version>=1),
 completed boolean not null default false,
 best_stars integer not null default 0 check(best_stars between 0 and 3),
 best_accuracy numeric not null default 0 check(best_accuracy between 0 and 100),
 last_accuracy numeric not null default 0 check(last_accuracy between 0 and 100),
 attempts integer not null default 0 check(attempts>=0),
 correct_count bigint not null default 0 check(correct_count>=0),
 wrong_count bigint not null default 0 check(wrong_count>=0),
 total_active_seconds bigint not null default 0 check(total_active_seconds>=0),
 weak_keys jsonb not null default '{}', weak_rules jsonb not null default '{}',
 last_play_id uuid, last_played_at timestamptz not null default now(),
 primary key(user_id,game_id,lesson_id)
);
create index if not exists player_lesson_progress_game on public.player_lesson_progress(game_id);
alter table public.player_lesson_progress enable row level security;
revoke all on public.player_lesson_progress from public,anon,authenticated;
grant select on public.player_lesson_progress to authenticated;
grant all on public.player_lesson_progress to service_role;
drop policy if exists lesson_progress_read on public.player_lesson_progress;
create policy lesson_progress_read on public.player_lesson_progress for select to authenticated
 using(user_id=(select auth.uid()) or (select tipy_private.is_admin()));

create or replace function public.tipy_finish_quest_lesson(p_user uuid,p_play uuid,p_lesson text,p_values jsonb,p_grade jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare game uuid; old public.active_plays; saved public.player_lesson_progress; snapshot jsonb;
begin
 select a.game_id into game from public.active_plays a join public.games g using(game_id)
 where a.play_id=p_play and a.user_id=p_user and g.game_code='keyboard_quest' and g.engine_code='keyboard_quest' and g.is_active;
 if not found then return jsonb_build_object('superseded',true); end if;
 -- Same lock order as begin/save prevents races with replay, another tab and reset.
 perform 1 from public.player_game_stats where user_id=p_user and game_id=game for update;
 select * into old from public.active_plays where play_id=p_play and user_id=p_user for update;
 if not found then return jsonb_build_object('superseded',true); end if;
 select * into saved from public.player_lesson_progress where user_id=p_user and game_id=game and lesson_id=p_lesson;
 if found and saved.last_play_id=p_play then return to_jsonb(saved); end if;
 if old.result<>'in_progress' then return jsonb_build_object('superseded',true); end if;
 if old.metrics->'config_snapshot'->>'lesson_id' is distinct from p_lesson or p_values->>'result'<>'completed' then raise exception 'Wrong lesson'; end if;
 snapshot=public.tipy_save_play(p_user,p_play,p_values);
 if snapshot->>'superseded'='true' then return snapshot; end if;
 insert into public.player_lesson_progress(user_id,game_id,lesson_id,completed,best_stars,best_accuracy,last_accuracy,attempts,correct_count,wrong_count,total_active_seconds,weak_keys,weak_rules,last_play_id)
 values(p_user,game,p_lesson,(p_grade->>'completed')::boolean,(p_grade->>'stars')::integer,(p_grade->>'accuracy')::numeric,(p_grade->>'accuracy')::numeric,1,(p_grade->>'correct')::integer,(p_grade->>'wrong')::integer,(p_values->>'active_seconds')::integer,p_grade->'weakKeys',p_grade->'weakRules',p_play)
 on conflict(user_id,game_id,lesson_id) do update set
 completed=player_lesson_progress.completed or excluded.completed,
 best_stars=greatest(player_lesson_progress.best_stars,excluded.best_stars),
 best_accuracy=greatest(player_lesson_progress.best_accuracy,excluded.best_accuracy),
 last_accuracy=excluded.last_accuracy,attempts=player_lesson_progress.attempts+1,
 correct_count=player_lesson_progress.correct_count+excluded.correct_count,
 wrong_count=player_lesson_progress.wrong_count+excluded.wrong_count,
 total_active_seconds=player_lesson_progress.total_active_seconds+excluded.total_active_seconds,
 weak_keys=excluded.weak_keys,weak_rules=excluded.weak_rules,last_play_id=p_play,last_played_at=now()
 returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb) to service_role;

create or replace function public.tipy_reset_quest_progress(p_user uuid,p_game uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.games where game_id=p_game and game_code='keyboard_quest') then raise exception 'Wrong game'; end if;
 perform 1 from public.player_game_stats where user_id=p_user and game_id=p_game for update;
 -- Invalidate old requests without erasing lifetime practice totals or the old game.
 update public.active_plays set play_id=gen_random_uuid(),result='quit',ended_at=now(),metrics='{}',score=0,active_seconds=0,stage_number=null where user_id=p_user and game_id=p_game;
 delete from public.player_lesson_progress where user_id=p_user and game_id=p_game;
end $$;
revoke all on function public.tipy_reset_quest_progress(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tipy_reset_quest_progress(uuid,uuid) to service_role;

insert into public.games(game_code,game_name,engine_code,description,is_active,config)
values('keyboard_quest','Bé chinh phục bàn phím','keyboard_quest','Khám phá bàn phím, gõ từ và làm quen tiếng Việt Telex.',false,'{"curriculum_version":1}')
on conflict(game_code) do nothing;
commit;
