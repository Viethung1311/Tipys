-- Teacher-only operations; installing this migration performs no reset or gift.
begin;
alter table public.star_rewards drop constraint star_rewards_amount_check,
 drop constraint star_rewards_source_check, drop constraint star_rewards_check;
alter table public.star_rewards alter column amount type integer,
 add column granted_by uuid references public.profiles(user_id) on delete set null,
 add column message text not null default '' check(length(message)<=240),
 add constraint star_rewards_source_check check(source in ('lesson','weekly','teacher')),
 add constraint star_rewards_amount_check check(amount>=0),
 add constraint star_rewards_check check((source='lesson' and amount between 0 and 3) or (source='weekly' and amount=5) or (source='teacher' and amount>0));

create table public.student_admin_actions (
 request_id uuid primary key,
 actor_id uuid references public.profiles(user_id) on delete set null,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 action text not null check(action in ('reset','gift')),
 payload jsonb not null, response jsonb not null,
 created_at timestamptz not null default now()
);
create index student_admin_actions_user on public.student_admin_actions(user_id);
alter table public.student_admin_actions enable row level security;
revoke all on public.student_admin_actions from public,anon,authenticated;
grant all on public.student_admin_actions to service_role;

create function public.tipy_student_reset(p_actor uuid,p_user uuid,p_game uuid,p_request uuid,p_confirm text)
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
 insert into public.player_game_stats(user_id,game_id) values(p_user,p_game) on conflict do nothing;
 -- Begin/save/finish use this same lock. Old play UUIDs are removed before releasing it.
 select * into stats from public.player_game_stats where user_id=p_user and game_id=p_game for update;
 delete from public.active_plays where user_id=p_user and game_id=p_game;
 delete from public.player_lesson_progress where user_id=p_user and game_id=p_game;
 select coalesce(sum(amount),0) into revoked from public.star_rewards where user_id=p_user and source='lesson' and left(source_key,37)=p_game::text||':';
 delete from public.star_rewards where user_id=p_user and source='lesson' and left(source_key,37)=p_game::text||':';
 -- Historical legacy rows must not reappear in admin results after resetting this game.
 delete from public.play_history where user_id=p_user and game_id=p_game;
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
 update public.player_game_stats set best_play=null,latest_play=null,total_plays=0,last_played_at=null where user_id=p_user and game_id=p_game;
 answer=jsonb_build_object('completed',true,'gameId',p_game,'revokedStars',revoked,'removedPlays',stats.total_plays,'lifetimeSeconds',stats.total_active_seconds,'stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response)
 values(p_request,p_actor,p_user,'reset',jsonb_build_object('gameId',p_game),answer);
 return answer;
end $$;

create function public.tipy_teacher_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.student_admin_actions; body jsonb; answer jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if not exists(select 1 from public.profiles where user_id=p_user and role='student') then raise exception 'Chỉ tặng sao cho học sinh.'; end if;
 if p_amount is null or p_amount<=0 or p_message is null or length(p_message)>240 then raise exception 'Số sao hoặc lời nhắn chưa hợp lệ.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 body=jsonb_build_object('amount',p_amount,'message',p_message);
 select * into receipt from public.student_admin_actions where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.user_id<>p_user or receipt.action<>'gift' or receipt.payload<>body then raise exception 'Mã yêu cầu đã dùng cho thao tác khác.'; end if;
  return receipt.response;
 end if;
 insert into public.star_rewards(user_id,source,source_key,amount,granted_by,message) values(p_user,'teacher',p_request::text,p_amount,p_actor,p_message);
 answer=jsonb_build_object('completed',true,'amount',p_amount,'stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response) values(p_request,p_actor,p_user,'gift',body,answer);
 return answer;
end $$;

create or replace function public.tipy_star_total(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('stars',coalesce(sum(amount),0),'lessonStars',coalesce(sum(amount) filter(where source='lesson'),0),'weeklyStars',coalesce(sum(amount) filter(where source='weekly'),0),'teacherStars',coalesce(sum(amount) filter(where source='teacher'),0)) from public.star_rewards where user_id=p_user
$$;

alter function public.tipy_class_star_board(uuid,uuid,date) rename to tipy_class_star_board_before_member_count;
create function public.tipy_class_star_board(p_actor uuid,p_class uuid,p_week date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare board jsonb; members integer;
begin
 board=public.tipy_class_star_board_before_member_count(p_actor,p_class,p_week);
 select count(*) into members from public.class_members m join public.profiles p using(user_id) where m.class_id=p_class and m.is_active and p.role='student';
 return board||jsonb_build_object('memberCount',members);
end $$;
revoke all on function public.tipy_student_reset(uuid,uuid,uuid,uuid,text),public.tipy_teacher_gift(uuid,uuid,uuid,integer,text),public.tipy_star_total(uuid),public.tipy_class_star_board(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.tipy_student_reset(uuid,uuid,uuid,uuid,text),public.tipy_teacher_gift(uuid,uuid,uuid,integer,text),public.tipy_star_total(uuid),public.tipy_class_star_board(uuid,uuid,date) to service_role;
commit;
