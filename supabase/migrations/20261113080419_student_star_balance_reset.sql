-- Apply after db/admin_students.sql, db/student_actions.sql and db/lesson_star_upgrades.sql.
begin;
-- amount remains the lifetime award ceiling for each lesson; only its spendable balance resets.
alter table public.star_rewards add column reset_amount integer not null default 0
 check(reset_amount>=0 and reset_amount<=amount);
alter table public.student_admin_actions drop constraint student_admin_actions_action_check;
alter table public.student_admin_actions add constraint student_admin_actions_action_check
 check(action in ('reset','gift','stars_reset'));

create function public.tipy_lock_star_award() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- All reward writers use INSERT (including lesson UPSERT), before taking a reward row lock.
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||new.user_id::text,0));
 return new;
end $$;
create trigger lock_star_award before insert on public.star_rewards
 for each row execute function public.tipy_lock_star_award();

create or replace function public.tipy_star_total(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('stars',coalesce(sum(amount-reset_amount),0),
  'lessonStars',coalesce(sum(amount-reset_amount) filter(where source='lesson'),0),
  'weeklyStars',coalesce(sum(amount-reset_amount) filter(where source='weekly'),0),
  'teacherStars',coalesce(sum(amount-reset_amount) filter(where source='teacher'),0))
 from public.star_rewards where user_id=p_user
$$;

create function public.tipy_reset_stars(p_actor uuid,p_user uuid,p_request uuid,p_confirm text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.student_admin_actions; before_balance jsonb; answer jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if p_confirm is distinct from 'accept' then raise exception 'Nhập chính xác accept để xác nhận.'; end if;
 if not exists(select 1 from public.profiles where user_id=p_user and role='student') then raise exception 'Chỉ reset sao tài khoản học sinh.'; end if;
 if p_request is null then raise exception 'Thiếu mã yêu cầu.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 select * into receipt from public.student_admin_actions where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.user_id<>p_user or receipt.action<>'stars_reset' or receipt.payload<>'{}'::jsonb then raise exception 'Mã yêu cầu đã dùng cho thao tác khác.'; end if;
  return receipt.response||jsonb_build_object('stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
 end if;
 before_balance=public.tipy_star_total(p_user);
 update public.star_rewards set reset_amount=amount where user_id=p_user and reset_amount<>amount;
 answer=jsonb_build_object('completed',true,'before',before_balance,'stars',0,'afterStars',0,'resetAt',clock_timestamp());
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response)
 values(p_request,p_actor,p_user,'stars_reset','{}',answer);
 return answer;
end $$;

-- Receipt retries report the current balance without applying the gift a second time.
alter function public.tipy_teacher_gift(uuid,uuid,uuid,integer,text) rename to tipy_teacher_gift_before_balance;
create function public.tipy_teacher_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare answer jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 answer=public.tipy_teacher_gift_before_balance(p_actor,p_user,p_request,p_amount,p_message);
 return answer||jsonb_build_object('stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
end $$;

alter function public.tipy_students_page(integer,text,text,text,uuid,text) rename to tipy_students_page_before_balance;
create function public.tipy_students_page(p_page integer default 1,p_search text default '',p_class text default 'all',p_sort text default 'desc',p_roster uuid default null,p_membership text default 'all')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare page_data jsonb; students jsonb;
begin
 page_data=public.tipy_students_page_before_balance(p_page,p_search,p_class,p_sort,p_roster,p_membership);
 with page_rows as (
  select value student,ordinality position from jsonb_array_elements(page_data->'students') with ordinality
 ), totals as (
  select r.user_id,sum(r.amount-r.reset_amount) stars from public.star_rewards r
  join page_rows p on r.user_id=(p.student->>'user_id')::uuid group by r.user_id
 )
 select coalesce(jsonb_agg(p.student||jsonb_build_object('stars',coalesce(t.stars,0)) order by p.position),'[]')
 into students from page_rows p left join totals t on t.user_id=(p.student->>'user_id')::uuid;
 return page_data||jsonb_build_object('students',students);
end $$;

create or replace function public.tipy_class_star_board(p_actor uuid,p_class uuid,p_week date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week date=coalesce(p_week,public.tipy_week_start(now())); lessons jsonb; weekly jsonb; closure jsonb; members integer;
begin
 if week>public.tipy_week_start(now()) or extract(isodow from week)<>1 then raise exception 'Invalid week'; end if;
 if not exists(select 1 from public.classes c,public.profiles p where c.class_id=p_class and c.archived_at is null and p.user_id=p_actor and p.is_active
  and (p.role='admin' or exists(select 1 from public.class_members m where m.class_id=p_class and m.user_id=p_actor and m.is_active))) then raise exception 'Class access denied'; end if;
 select count(*) into members from public.class_members m join public.profiles p using(user_id) where m.class_id=p_class and m.is_active and p.role='student';
 with roster as (
  select m.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal
  from public.class_members m join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where m.class_id=p_class and m.is_active and p.is_active and p.role='student'
 ), totals as (
  select r.user_id,sum(r.amount-r.reset_amount) stars from public.star_rewards r join roster m using(user_id) group by r.user_id
 ), progress as (
  select l.user_id,count(*) completed from public.player_lesson_progress l join roster m using(user_id)
  join public.games g using(game_id) where l.completed and g.game_code='keyboard_quest' group by l.user_id
 )
 select coalesce(jsonb_agg(to_jsonb(t) order by t.stars desc,t.completed desc,t.user_id),'[]') into lessons
 from (select m.*,coalesce(s.stars,0) stars,coalesce(p.completed,0) completed from roster m left join totals s using(user_id) left join progress p using(user_id)) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into weekly from (
  select s.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal,s.score,
   100*s.correct::numeric/greatest(1,s.correct+s.wrong) accuracy,s.achieved_at
  from public.class_week_scores s join public.class_members m using(class_id,user_id)
  join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where s.class_id=p_class and s.week_start=week and s.rule_id='hard-v1' and m.is_active and s.joined_at=m.joined_at and p.is_active and p.role='student'
  order by s.score desc,s.correct::numeric/greatest(1,s.correct+s.wrong) desc,s.achieved_at,s.user_id
 ) t;
 select jsonb_build_object('winnerId',winner_id,'closedAt',closed_at) into closure from public.class_week_closures where class_id=p_class and week_start=week;
 return jsonb_build_object('lessons',lessons,'weekly',weekly,'memberCount',members,'weekStart',week,'weekEnd',week+7,'currentWeek',public.tipy_week_start(now()),'closure',closure,'rule','Khó · A–Z · hard-v1');
end $$;

-- A settlement can hold balance locks across several weeks; exclude legacy falling-game resets.
alter function public.tipy_close_star_weeks() rename to tipy_close_star_weeks_before_balance;
create function public.tipy_close_star_weeks() returns integer
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('star-settlement',0));
 return public.tipy_close_star_weeks_before_balance();
end $$;

-- Keep legacy game resets in the same stats -> week -> balance lock order as play writers.
create or replace function public.tipy_student_reset(p_actor uuid,p_user uuid,p_game uuid,p_request uuid,p_confirm text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.student_admin_actions; stats public.player_game_stats; code text; revoked bigint; period record; answer jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if p_confirm is distinct from 'accept' then raise exception 'Nhập chính xác accept để xác nhận.'; end if;
 if not exists(select 1 from public.profiles where user_id=p_user and role='student') then raise exception 'Chỉ đặt lại tài khoản học sinh.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into receipt from public.student_admin_actions where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.user_id<>p_user or receipt.action<>'reset' or receipt.payload<>jsonb_build_object('gameId',p_game) then raise exception 'Mã yêu cầu đã dùng cho thao tác khác.'; end if;
  return receipt.response;
 end if;
 select game_code into code from public.games where game_id=p_game;
 if not found then raise exception 'Không tìm thấy trò chơi.'; end if;
 if code='falling_letters' then perform pg_advisory_xact_lock(hashtextextended('star-settlement',0)); end if;
 insert into public.player_game_stats(user_id,game_id) values(p_user,p_game) on conflict do nothing;
 -- Begin/save/finish use this same lock. Old play UUIDs are removed before releasing it.
 select * into stats from public.player_game_stats where user_id=p_user and game_id=p_game for update;
 if code='falling_letters' then
  delete from public.ranked_class_entries where user_id=p_user;
  for period in select class_id,week_start from public.class_week_scores where user_id=p_user order by week_start,class_id
  loop
   perform pg_advisory_xact_lock(hashtextextended(period.class_id::text||period.week_start::text,0));
   if not exists(select 1 from public.class_week_closures where class_id=period.class_id and week_start=period.week_start) then
    delete from public.class_week_scores where class_id=period.class_id and week_start=period.week_start and user_id=p_user;
   end if;
  end loop;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 delete from public.active_plays where user_id=p_user and game_id=p_game;
 delete from public.player_lesson_progress where user_id=p_user and game_id=p_game;
 select coalesce(sum(amount-reset_amount),0) into revoked from public.star_rewards where user_id=p_user and source='lesson' and left(source_key,37)=p_game::text||':';
 delete from public.star_rewards where user_id=p_user and source='lesson' and left(source_key,37)=p_game::text||':';
 -- Historical legacy rows must not reappear in admin results after resetting this game.
 delete from public.play_history where user_id=p_user and game_id=p_game;
 update public.player_game_stats set best_play=null,latest_play=null,total_plays=0,last_played_at=null where user_id=p_user and game_id=p_game;
 answer=jsonb_build_object('completed',true,'gameId',p_game,'revokedStars',revoked,'removedPlays',stats.total_plays,'lifetimeSeconds',stats.total_active_seconds,'stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response)
 values(p_request,p_actor,p_user,'reset',jsonb_build_object('gameId',p_game),answer);
 return answer;
end $$;

revoke all on function public.tipy_lock_star_award(),public.tipy_reset_stars(uuid,uuid,uuid,text),public.tipy_teacher_gift(uuid,uuid,uuid,integer,text),public.tipy_students_page(integer,text,text,text,uuid,text),public.tipy_close_star_weeks() from public,anon,authenticated;
grant execute on function public.tipy_lock_star_award(),public.tipy_reset_stars(uuid,uuid,uuid,text),public.tipy_teacher_gift(uuid,uuid,uuid,integer,text),public.tipy_students_page(integer,text,text,text,uuid,text),public.tipy_close_star_weeks() to service_role;
commit;
