-- Class/week ranking is separate from the account balance and game competition.
begin;
alter table public.star_rewards add column class_id uuid references public.classes(class_id) on delete set null,
 add column class_awarded_at timestamptz,
 add constraint star_rewards_class_source check(class_id is null or (source='teacher' and class_awarded_at is not null));
create index star_rewards_class_week on public.star_rewards(class_id,class_awarded_at,user_id) where source='teacher' and class_id is not null;
create index student_actions_class_week on public.student_admin_actions((payload->>'classId'),((response->>'deductedAt'))) where action='deduct';

-- Only explicit historical class evidence may be imported. Never infer from current membership.
update public.star_rewards r set class_id=(a.payload->>'classId')::uuid,class_awarded_at=r.created_at
from public.student_admin_actions a join public.classes c on c.class_id::text=a.payload->>'classId'
where r.source='teacher' and r.source_key=a.request_id::text and a.action='gift' and r.user_id=a.user_id;

create function public.tipy_star_select_class(p_actor uuid,p_user uuid,p_class uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare chosen uuid=p_class; groups uuid[];
begin
 perform public.tipy_star_class_scope(p_actor,p_user,p_class);
 if chosen is null then
  select array_agg(m.class_id order by m.class_id) into groups from public.class_members m join public.classes c using(class_id) where m.user_id=p_user and m.is_active and c.archived_at is null;
  if cardinality(groups)>1 then raise exception 'Chọn lớp trước khi xác nhận.'; end if;
  chosen=groups[1];
 end if;
 perform public.tipy_star_class_scope(p_actor,p_user,chosen);
 return chosen;
end $$;

create or replace function public.tipy_class_star_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text,p_class uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen uuid; prior boolean; recorded uuid; recorded_at timestamptz; answer jsonb;
begin
 chosen=public.tipy_star_select_class(p_actor,p_user,p_class);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 select exists(select 1 from public.student_admin_actions where request_id=p_request) into prior;
 if prior then
  select class_id,class_awarded_at into recorded,recorded_at from public.star_rewards where user_id=p_user and source='teacher' and source_key=p_request::text;
  if recorded_at is not null and recorded is distinct from chosen then raise exception 'Mã yêu cầu đã dùng cho lớp khác.'; end if;
 end if;
 answer=public.tipy_teacher_gift(p_actor,p_user,p_request,p_amount,p_message);
 if not prior then
  update public.star_rewards set class_id=chosen,class_awarded_at=clock_timestamp() where user_id=p_user and source='teacher' and source_key=p_request::text;
 end if;
 return answer||jsonb_build_object('classId',case when prior then recorded else chosen end);
end $$;

alter function public.tipy_deduct_stars(uuid,uuid,uuid,integer,text,uuid) rename to tipy_deduct_stars_before_class_week;
create function public.tipy_deduct_stars(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text default '',p_class uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen uuid;
begin
 chosen=public.tipy_star_select_class(p_actor,p_user,p_class);
 return public.tipy_deduct_stars_before_class_week(p_actor,p_user,p_request,p_amount,p_message,chosen)||jsonb_build_object('classId',chosen);
end $$;

create function public.tipy_class_week_stars(p_class uuid,p_week date) returns jsonb
language sql stable security invoker set search_path='' as $$
 with bounds as (select p_week::timestamp at time zone 'Asia/Ho_Chi_Minh' starts,(p_week+7)::timestamp at time zone 'Asia/Ho_Chi_Minh' ends),
 roster as materialized (
  select m.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal from public.class_members m join public.classes c using(class_id)
  join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where m.class_id=p_class and m.is_active and c.archived_at is null and p.is_active and p.role='student'
 ), resets as (
  select a.user_id,max((a.response->>'resetAt')::timestamptz) reset_at from public.student_admin_actions a join roster using(user_id) cross join bounds b
  where a.action='stars_reset' and (a.response->>'resetAt')::timestamptz<b.ends group by a.user_id
 ), events as (
  select r.user_id,r.amount::bigint delta,r.class_awarded_at occurred_at,r.source_key event_id from public.star_rewards r cross join bounds b
  where r.source='teacher' and r.class_id=p_class and r.class_awarded_at>=b.starts and r.class_awarded_at<b.ends
  union all
  select a.user_id,-(a.payload->>'amount')::bigint,(a.response->>'deductedAt')::timestamptz,a.request_id::text from public.student_admin_actions a cross join bounds b
  where a.action='deduct' and a.payload->>'classId'=p_class::text and (a.response->>'deductedAt')::timestamptz>=b.starts and (a.response->>'deductedAt')::timestamptz<b.ends
 ), running as (
  select e.*,sum(e.delta) over(partition by e.user_id order by e.occurred_at,e.event_id rows unbounded preceding) balance
  from events e left join resets r using(user_id) where r.reset_at is null or e.occurred_at>r.reset_at
 ), totals as (
  select user_id,sum(delta)-least(0,min(balance)) stars from running group by user_id
 )
 select coalesce(jsonb_agg(to_jsonb(t) order by t.stars desc,t.name,t.user_id),'[]') from (select r.*,coalesce(t.stars,0) stars from roster r left join totals t using(user_id)) t
$$;

create or replace function public.tipy_class_star_board(p_actor uuid,p_class uuid,p_week date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare server_time timestamptz=clock_timestamp(); current_week date=public.tipy_week_start(server_time); week date=coalesce(p_week,current_week); weekly jsonb; closure jsonb; members integer;
begin
 if week>current_week or extract(isodow from week)<>1 then raise exception 'Invalid week'; end if;
 if not exists(select 1 from public.classes c,public.profiles p where c.class_id=p_class and c.archived_at is null and p.user_id=p_actor and p.is_active and (p.role='admin' or exists(select 1 from public.class_members m where m.class_id=p_class and m.user_id=p_actor and m.is_active))) then raise exception 'Class access denied'; end if;
 select count(*) into members from public.class_members m join public.profiles p using(user_id) where m.class_id=p_class and m.is_active and p.is_active and p.role='student';
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into weekly from (
  select s.user_id,p.full_name name,coalesce(a.animal,'icon_01') animal,s.score,100*s.correct::numeric/greatest(1,s.correct+s.wrong) accuracy,s.achieved_at
  from public.class_week_scores s join public.class_members m using(class_id,user_id) join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where s.class_id=p_class and s.week_start=week and s.rule_id='hard-v1' and m.is_active and s.joined_at=m.joined_at and p.is_active and p.role='student'
  order by s.score desc,s.correct::numeric/greatest(1,s.correct+s.wrong) desc,s.achieved_at,s.user_id
 ) t;
 select jsonb_build_object('winnerId',winner_id,'closedAt',closed_at) into closure from public.class_week_closures where class_id=p_class and week_start=week;
 return jsonb_build_object('lessons',public.tipy_class_week_stars(p_class,week),'weekly',weekly,'memberCount',members,'weekStart',week,'weekEnd',week+7,'currentWeek',current_week,'closure',closure,'rule','Khó · A–Z · hard-v1','starScope','class_week','serverNow',server_time,'nextWeekAt',(current_week+7)::timestamp at time zone 'Asia/Ho_Chi_Minh');
end $$;
revoke all on function public.tipy_star_select_class(uuid,uuid,uuid),public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid),public.tipy_deduct_stars(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_week_stars(uuid,date),public.tipy_class_star_board(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.tipy_star_select_class(uuid,uuid,uuid),public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid),public.tipy_deduct_stars(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_week_stars(uuid,date),public.tipy_class_star_board(uuid,uuid,date) to service_role;
commit;
