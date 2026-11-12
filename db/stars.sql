-- Additive rewards. No conversion of old game points or inferred historical weekly results.
begin;
create table public.star_rewards (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 source text not null check(source in ('lesson','weekly')),
 source_key text not null, amount smallint not null check(amount between 0 and 5),
 play_id uuid, legacy boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(user_id,source,source_key),
 check((source='lesson' and amount between 0 and 3) or (source='weekly' and amount=5))
);
alter table public.player_lesson_progress
 add column awarded_stars smallint not null default 0 check(awarded_stars between 0 and 3),
 add column award_play_id uuid,
 add column reward_status text not null default 'pending' check(reward_status in ('pending','awarded','legacy'));
-- Best/latest snapshots cannot prove first-completion stars. Reserve the source without granting any.
insert into public.star_rewards(user_id,source,source_key,amount,legacy)
 select p.user_id,'lesson',p.game_id::text||':'||p.lesson_id,0,true
 from public.player_lesson_progress p join public.games g using(game_id)
 where g.game_code='keyboard_quest' and p.completed;
update public.player_lesson_progress p set reward_status='legacy'
 where exists(select 1 from public.star_rewards r where r.user_id=p.user_id and r.source='lesson'
 and r.source_key=p.game_id::text||':'||p.lesson_id and r.legacy);

create table public.ranked_class_entries (
 class_id uuid not null references public.classes(class_id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 play_id uuid not null, joined_at timestamptz not null, started_at timestamptz not null,
 primary key(class_id,user_id)
);
create index ranked_entries_user on public.ranked_class_entries(user_id);
create table public.class_week_scores (
 class_id uuid not null references public.classes(class_id) on delete cascade,
 week_start date not null, user_id uuid not null references public.profiles(user_id) on delete cascade,
 rule_id text not null check(rule_id='hard-v1'), score integer not null check(score>0),
 correct integer not null, wrong integer not null, missed integer not null,
 active_seconds integer not null, play_id uuid not null,
 achieved_at timestamptz not null, joined_at timestamptz not null,
 evidence jsonb not null,
 primary key(class_id,week_start,user_id),
 check(score=correct*10 and wrong between 0 and 6 and missed between 0 and 3)
);
create index week_scores_user on public.class_week_scores(user_id);
create table public.class_week_closures (
 class_id uuid not null references public.classes(class_id) on delete cascade,
 week_start date not null, winner_id uuid, closed_at timestamptz not null default now(),
 primary key(class_id,week_start)
);
-- A rejoin starts a new membership period, invalidating results from the previous enrollment.
create function tipy_private.membership_period() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_active and not old.is_active then new.joined_at=clock_timestamp(); end if;
 return new;
end $$;
create trigger membership_period before update on public.class_members for each row execute function tipy_private.membership_period();

create function public.tipy_week_start(p_time timestamptz) returns date
language sql immutable set search_path='' as $$ select date_trunc('week',p_time at time zone 'Asia/Ho_Chi_Minh')::date $$;
create function public.tipy_ranked_config() returns jsonb language sql immutable set search_path='' as $$
 select '{"ranked_rule":"hard-v1","levels":{"hard":{"fall":3,"minFall":1,"spawn":0.95,"minSpawn":0.65,"max":10}}}'::jsonb
$$;
create function public.tipy_begin_ranked(p_user uuid,p_game uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare play jsonb;
begin
 if not exists(select 1 from public.games where game_id=p_game and game_code='falling_letters' and engine_code='falling_letters' and is_active)
 then raise exception 'Wrong ranked game'; end if;
 play=public.tipy_begin_play(p_user,p_game,'hard',to_jsonb(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z',',')),public.tipy_ranked_config(),null);
 delete from public.ranked_class_entries where user_id=p_user;
 insert into public.ranked_class_entries(class_id,user_id,play_id,joined_at,started_at)
 select m.class_id,p_user,(play->>'play_id')::uuid,m.joined_at,(play->>'started_at')::timestamptz
 from public.class_members m join public.classes c using(class_id)
 where m.user_id=p_user and m.is_active and c.archived_at is null and m.joined_at<=(play->>'started_at')::timestamptz;
 return play;
end $$;

alter function public.tipy_save_play(uuid,uuid,jsonb) rename to tipy_save_play_without_rewards;
create function public.tipy_save_play(p_user uuid,p_play uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare game uuid; old public.active_plays; saved jsonb; e record; stamp timestamptz; week date; c integer; w integer; missed integer;
begin
 select game_id into game from public.active_plays where play_id=p_play and user_id=p_user;
 if not found then return jsonb_build_object('superseded',true); end if;
 perform 1 from public.player_game_stats where user_id=p_user and game_id=game for update;
 select * into old from public.active_plays where play_id=p_play and user_id=p_user for update;
 if not found then return jsonb_build_object('superseded',true); end if;
 saved=public.tipy_save_play_without_rewards(p_user,p_play,p_values);
 if old.result='in_progress' and old.difficulty='hard' and old.metrics->'config_snapshot'=public.tipy_ranked_config()
 and p_values->>'result'='game_over' and exists(select 1 from public.games where game_id=game and game_code='falling_letters' and engine_code='falling_letters') then
  c=(p_values->'metrics'->>'correct')::integer; w=(p_values->'metrics'->>'wrong')::integer; missed=(p_values->'metrics'->>'missed')::integer;
  if c is null or w is null or missed is null or c<0 or w not between 0 and 6 or missed not between 0 and 3
   or (w<>6 and missed<>3) or (p_values->>'score')::integer<>c*10
   or c>floor(((p_values->>'active_seconds')::integer+1)/0.65)+1
   or old.metrics->'keys'<>to_jsonb(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z',','))
  then raise exception 'Invalid ranked result'; end if;
  stamp=clock_timestamp(); week=public.tipy_week_start(stamp);
  if c>0 then
   for e in select m.class_id,m.joined_at from public.ranked_class_entries r
    join public.class_members m using(class_id,user_id) join public.classes cl using(class_id)
    join public.profiles p on p.user_id=m.user_id
    where r.user_id=p_user and r.play_id=p_play and m.is_active and r.joined_at=m.joined_at
    and r.started_at>=m.joined_at and cl.archived_at is null and p.is_active and p.role='student' for share of m,cl,p
   loop
    perform pg_advisory_xact_lock(hashtextextended(e.class_id::text||week::text,0));
    if week=public.tipy_week_start(clock_timestamp()) and not exists(select 1 from public.class_week_closures where class_id=e.class_id and week_start=week) then
     insert into public.class_week_scores(class_id,week_start,user_id,rule_id,score,correct,wrong,missed,active_seconds,play_id,achieved_at,joined_at,evidence)
     values(e.class_id,week,p_user,'hard-v1',c*10,c,w,missed,(p_values->>'active_seconds')::integer,p_play,stamp,e.joined_at,
      jsonb_build_object('rules',public.tipy_ranked_config(),'keys',old.metrics->'keys','started_at',old.started_at,'result','game_over'))
     on conflict(class_id,week_start,user_id) do update set score=excluded.score,correct=excluded.correct,wrong=excluded.wrong,
      missed=excluded.missed,active_seconds=excluded.active_seconds,play_id=excluded.play_id,achieved_at=excluded.achieved_at,joined_at=excluded.joined_at,evidence=excluded.evidence
     where class_week_scores.joined_at<>excluded.joined_at or
      (excluded.score,excluded.correct::numeric/greatest(1,excluded.correct+excluded.wrong))>
      (class_week_scores.score,class_week_scores.correct::numeric/greatest(1,class_week_scores.correct+class_week_scores.wrong));
    end if;
   end loop;
  end if;
 end if;
 if old.result='in_progress' and p_values->>'result'<>'in_progress' then delete from public.ranked_class_entries where user_id=p_user and play_id=p_play; end if;
 return saved;
end $$;

alter function public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb) rename to tipy_finish_quest_without_rewards;
create function public.tipy_finish_quest_lesson(p_user uuid,p_play uuid,p_lesson text,p_values jsonb,p_grade jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare game uuid; saved jsonb; reward public.star_rewards; was_complete boolean;
begin
 select a.game_id into game from public.active_plays a join public.games g using(game_id)
 where a.play_id=p_play and a.user_id=p_user and g.game_code='keyboard_quest';
 if not found then return jsonb_build_object('superseded',true); end if;
 perform 1 from public.player_game_stats where user_id=p_user and game_id=game for update;
 select completed into was_complete from public.player_lesson_progress where user_id=p_user and game_id=game and lesson_id=p_lesson;
 saved=public.tipy_finish_quest_without_rewards(p_user,p_play,p_lesson,p_values,p_grade);
 if saved->>'superseded'='true' then return saved; end if;
 if not coalesce(was_complete,false) and (p_grade->>'completed')::boolean then
  if (p_grade->>'stars')::integer not between 1 and 3 then raise exception 'Invalid stars'; end if;
  insert into public.star_rewards(user_id,source,source_key,amount,play_id)
  values(p_user,'lesson',game::text||':'||p_lesson,(p_grade->>'stars')::integer,p_play) on conflict do nothing;
 end if;
 select * into reward from public.star_rewards where user_id=p_user and source='lesson' and source_key=game::text||':'||p_lesson;
 update public.player_lesson_progress set awarded_stars=coalesce(reward.amount,0),award_play_id=reward.play_id,
 reward_status=case when reward.legacy then 'legacy' when reward.amount>0 then 'awarded' else 'pending' end
 where user_id=p_user and game_id=game and lesson_id=p_lesson returning to_jsonb(player_lesson_progress) into saved;
 return saved||jsonb_build_object('award_this_play',case when reward.play_id=p_play then reward.amount else 0 end);
end $$;

create function public.tipy_close_star_weeks() returns integer
language plpgsql security invoker set search_path='' as $$
declare period record; winner uuid; count_awards integer=0;
begin
 for period in select distinct s.class_id,s.week_start from public.class_week_scores s
  where s.week_start<public.tipy_week_start(clock_timestamp()) and not exists
   (select 1 from public.class_week_closures x where x.class_id=s.class_id and x.week_start=s.week_start)
  order by s.week_start,s.class_id
 loop
  perform pg_advisory_xact_lock(hashtextextended(period.class_id::text||period.week_start::text,0));
  if exists(select 1 from public.class_week_closures where class_id=period.class_id and week_start=period.week_start) then continue; end if;
  perform 1 from public.profiles where user_id in (select user_id from public.class_members where class_id=period.class_id) for share;
  perform 1 from public.classes where class_id=period.class_id for share;
  perform 1 from public.class_members where class_id=period.class_id for share;
  winner=null;
  select s.user_id into winner from public.class_week_scores s join public.class_members m using(class_id,user_id)
  join public.profiles p using(user_id) join public.classes c using(class_id)
  where s.class_id=period.class_id and s.week_start=period.week_start and s.rule_id='hard-v1'
  and m.is_active and s.joined_at=m.joined_at and p.is_active and p.role='student' and c.archived_at is null
  order by s.score desc,s.correct::numeric/greatest(1,s.correct+s.wrong) desc,s.achieved_at,s.user_id limit 1;
  insert into public.class_week_closures(class_id,week_start,winner_id) values(period.class_id,period.week_start,winner);
  if winner is not null then
   insert into public.star_rewards(user_id,source,source_key,amount) values(winner,'weekly',period.class_id::text||':'||period.week_start::text,5) on conflict do nothing;
   count_awards=count_awards+1;
  end if;
 end loop;
 return count_awards;
end $$;

create function public.tipy_star_total(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('stars',coalesce(sum(amount),0),'lessonStars',coalesce(sum(amount) filter(where source='lesson'),0),'weeklyStars',coalesce(sum(amount) filter(where source='weekly'),0)) from public.star_rewards where user_id=p_user
$$;

create function public.tipy_class_star_board(p_actor uuid,p_class uuid,p_week date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week date=coalesce(p_week,public.tipy_week_start(now())); lessons jsonb; weekly jsonb; closure jsonb;
begin
 if week>public.tipy_week_start(now()) or extract(isodow from week)<>1 then raise exception 'Invalid week'; end if;
 if not exists(select 1 from public.classes c,public.profiles p where c.class_id=p_class and c.archived_at is null and p.user_id=p_actor and p.is_active
  and (p.role='admin' or exists(select 1 from public.class_members m where m.class_id=p_class and m.user_id=p_actor and m.is_active))) then raise exception 'Class access denied'; end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into lessons from (
  select m.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal,
  coalesce((select sum(r.amount) from public.star_rewards r where r.user_id=m.user_id and r.source='lesson'),0) stars,
  (select count(*) from public.player_lesson_progress l join public.games g using(game_id) where l.user_id=m.user_id and l.completed and g.game_code='keyboard_quest') completed
  from public.class_members m join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where m.class_id=p_class and m.is_active and p.is_active and p.role='student'
  order by stars desc,completed desc,m.user_id
 ) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into weekly from (
  select s.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal,s.score,
   100*s.correct::numeric/greatest(1,s.correct+s.wrong) accuracy,s.achieved_at
  from public.class_week_scores s join public.class_members m using(class_id,user_id)
  join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where s.class_id=p_class and s.week_start=week and s.rule_id='hard-v1' and m.is_active and s.joined_at=m.joined_at and p.is_active and p.role='student'
  order by s.score desc,s.correct::numeric/greatest(1,s.correct+s.wrong) desc,s.achieved_at,s.user_id
 ) t;
 select jsonb_build_object('winnerId',winner_id,'closedAt',closed_at) into closure from public.class_week_closures where class_id=p_class and week_start=week;
 return jsonb_build_object('lessons',lessons,'weekly',weekly,'weekStart',week,'weekEnd',week+7,'currentWeek',public.tipy_week_start(now()),'closure',closure,'rule','Khó · A–Z · hard-v1');
end $$;

alter table public.star_rewards enable row level security;
alter table public.ranked_class_entries enable row level security;
alter table public.class_week_scores enable row level security;
alter table public.class_week_closures enable row level security;
revoke all on public.star_rewards,public.ranked_class_entries,public.class_week_scores,public.class_week_closures from public,anon,authenticated;
grant all on public.star_rewards,public.ranked_class_entries,public.class_week_scores,public.class_week_closures to service_role;
revoke all on function public.tipy_week_start(timestamptz),public.tipy_ranked_config(),public.tipy_begin_ranked(uuid,uuid),public.tipy_save_play(uuid,uuid,jsonb),public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb),public.tipy_close_star_weeks(),public.tipy_star_total(uuid),public.tipy_class_star_board(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.tipy_week_start(timestamptz),public.tipy_ranked_config(),public.tipy_begin_ranked(uuid,uuid),public.tipy_save_play(uuid,uuid,jsonb),public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb),public.tipy_close_star_weeks(),public.tipy_star_total(uuid),public.tipy_class_star_board(uuid,uuid,date) to service_role;
commit;
