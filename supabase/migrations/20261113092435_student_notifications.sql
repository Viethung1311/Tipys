-- After assessment_class_access.sql and student_star_balance_reset. No historical gift backfill.
begin;
create table public.student_notifications (
 notification_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 kind text not null check(kind in ('assessment','star_gift')),
 source_key text not null,
 assessment_id uuid references public.assessments(assessment_id) on delete set null,
 payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 presented_at timestamptz, spoken_at timestamptz,
 unique(user_id,kind,source_key)
);
create index student_notifications_history on public.student_notifications(user_id,created_at desc,notification_id desc);
create index student_notifications_unread on public.student_notifications(user_id,created_at desc) where presented_at is null;
alter table public.student_notifications enable row level security;
revoke all on public.student_notifications from public,anon,authenticated;
grant all on public.student_notifications to service_role;

create function public.tipy_notify_assessment(p_exam uuid,p_user uuid default null) returns void
language sql security invoker set search_path='' as $$
 insert into public.student_notifications(user_id,kind,source_key,assessment_id,payload)
 select a.user_id,'assessment',e.assessment_id::text,e.assessment_id,
  jsonb_build_object('title',e.definition->>'title','schedule',e.definition->'schedule','teacher','Thầy Hùng')
 from public.assessments e join public.assessment_assignments a using(assessment_id)
 join public.profiles p on p.user_id=a.user_id
 where e.assessment_id=p_exam and e.status='published' and p.role='student' and p.is_active
  and (p_user is null or a.user_id=p_user) and public.tipy_assessment_access(a.user_id,e.assessment_id)
 on conflict(user_id,kind,source_key) do nothing
$$;

create function public.tipy_notification_event() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='assessments' then
  if new.status='published' and old.status is distinct from 'published' then
   perform public.tipy_notify_assessment(new.assessment_id);
  end if;
 elsif tg_table_name='assessment_assignments' then
  perform public.tipy_notify_assessment(new.assessment_id,new.user_id);
 elsif tg_table_name='class_members' then
  if new.is_active and (tg_op='INSERT' or old.is_active is distinct from new.is_active) then
   perform public.tipy_sync_assessment_assignments(null,new.user_id);
  end if;
 elsif tg_table_name='star_rewards' then
  if new.source='teacher' then
   insert into public.student_notifications(user_id,kind,source_key,payload)
   values(new.user_id,'star_gift',new.source_key,jsonb_build_object('amount',new.amount,'message',new.message,'teacher','Thầy Hùng'))
   on conflict(user_id,kind,source_key) do nothing;
  end if;
 end if;
 return new;
end $$;
create trigger notification_assessment_published after update of status on public.assessments for each row execute function public.tipy_notification_event();
create trigger notification_assignment after insert on public.assessment_assignments for each row execute function public.tipy_notification_event();
create trigger notification_class_member after insert or update of is_active on public.class_members for each row execute function public.tipy_notification_event();
create trigger notification_gift after insert on public.star_rewards for each row when(new.source='teacher') execute function public.tipy_notification_event();

create function public.tipy_notifications_list(p_user uuid,p_page integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare total integer; unread integer; page integer; items jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_user and role='student' and is_active) then raise exception 'Student required'; end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page'; end if;
 perform public.tipy_sync_assessment_assignments(null,p_user);
 select count(*),count(*) filter(where n.presented_at is null) into total,unread from public.student_notifications n
 where n.user_id=p_user and (n.kind='star_gift' or n.assessment_id is null or public.tipy_assessment_access(p_user,n.assessment_id));
 page=least(p_page,greatest(1,ceil(total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(t) order by (t.presented_at is null) desc,t.created_at desc,t.notification_id desc),'[]') into items from (
  select n.notification_id,n.kind,n.assessment_id,n.payload,n.created_at,n.presented_at,n.spoken_at
  from public.student_notifications n where n.user_id=p_user
   and (n.kind='star_gift' or n.assessment_id is null or public.tipy_assessment_access(p_user,n.assessment_id))
  order by (n.presented_at is null) desc,n.created_at desc,n.notification_id desc limit 20 offset (page-1)*20
 ) t;
 return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(total/20.0)::integer),'total',total,'unread',unread,
  'revision',coalesce((select to_char(max(greatest(created_at,presented_at,spoken_at)) at time zone 'UTC','YYYYMMDDHH24MISSUS') from public.student_notifications where user_id=p_user),''));
end $$;

create function public.tipy_notifications_present(p_user uuid,p_ids uuid[],p_speak boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare changed jsonb; spoken jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_user and role='student' and is_active) then raise exception 'Student required'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 50 or p_speak is null then raise exception 'Invalid notification batch'; end if;
 -- Row locks choose exactly one tab to claim each previously unpresented notification.
 with locked as materialized (
  select n.notification_id,n.kind,n.spoken_at from public.student_notifications n
  where n.user_id=p_user and n.notification_id=any(p_ids) and n.presented_at is null
   and (n.kind='star_gift' or n.assessment_id is null or public.tipy_assessment_access(p_user,n.assessment_id))
  order by n.notification_id for update
 ), updated as (
  update public.student_notifications n set presented_at=clock_timestamp(),
   spoken_at=case when p_speak then coalesce(n.spoken_at,clock_timestamp()) else n.spoken_at end
  from locked l where n.notification_id=l.notification_id and n.presented_at is null
  returning n.notification_id,l.kind,(p_speak and l.spoken_at is null) speak
 )
 select coalesce(jsonb_agg(notification_id),'[]'),coalesce(jsonb_agg(jsonb_build_object('notification_id',notification_id,'kind',kind)) filter(where speak),'[]')
 into changed,spoken from updated;
 return jsonb_build_object('presented',changed,'spoken',spoken,'page',public.tipy_notifications_list(p_user,1));
end $$;

revoke all on function public.tipy_notify_assessment(uuid,uuid),public.tipy_notification_event(),public.tipy_notifications_list(uuid,integer),public.tipy_notifications_present(uuid,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.tipy_notify_assessment(uuid,uuid),public.tipy_notification_event(),public.tipy_notifications_list(uuid,integer),public.tipy_notifications_present(uuid,uuid[],boolean) to service_role;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.student_notifications;
 end if;
end $$;
commit;
