-- Classroom workspace. Apply after teacher_roles; no account/progress backfill.
begin;
alter table public.assessments add column hidden boolean not null default false;
create function public.tipy_classroom_allowed(p_actor uuid,p_class uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.classes c,public.profiles p where c.class_id=p_class and c.archived_at is null and p.user_id=p_actor and p.is_active and (public.tipy_manages_class(p_actor,p_class) or (p.role='student' and exists(select 1 from public.class_members m where m.class_id=p_class and m.user_id=p_actor and m.is_active))));
$$;
revoke all on function public.tipy_classroom_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tipy_classroom_allowed(uuid,uuid) to service_role;

create or replace function public.tipy_assessment(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare manager boolean; is_admin boolean; actor_role text; e public.assessments; assigned public.assessment_assignments; t public.assessment_attempts;
 exam uuid=(p_input->>'assessmentId')::uuid; target uuid; def jsonb; items jsonb; amount integer;
 page integer=greatest(1,coalesce((p_input->>'page')::integer,1)); v_classes uuid[]; v_students uuid[]; fingerprint text; limit_attempts integer; response jsonb;
begin
 select role in ('admin','teacher'),role='admin',role into manager,is_admin,actor_role from public.profiles where user_id=p_actor and is_active;
 if not found then raise exception 'Access denied'; end if;
 if actor_role='teacher' then
  if p_action not in ('list','detail','save','publish','results_v2','attempts','retake','delete','visibility') then raise exception 'Class access denied'; end if;
  if coalesce(p_input->>'classId','all')<>'all' and not public.tipy_manages_class(p_actor,(p_input->>'classId')::uuid) then raise exception 'Class access denied'; end if;
  if p_action='delete' and p_input->>'confirm'='accept' and not exists(select 1 from public.assessments where assessment_id=exam) then return jsonb_build_object('deleted',true,'permanent',true); end if;
  if p_action in ('start','checkpoint','submit') then raise exception 'Access denied'; end if;
  if p_action='save' then
   if not public.tipy_teacher_targets(p_actor,p_input->'definition') or exists(select 1 from public.assessments where assessment_id=exam and created_by<>p_actor) then raise exception 'Class access denied'; end if;
  elsif p_action<>'list' then
   if not public.tipy_teacher_exam_read(p_actor,exam) then raise exception 'Class access denied'; end if;
   if p_action in ('publish','delete','retake','visibility') and not exists(select 1 from public.assessments owned_exam where owned_exam.assessment_id=exam and owned_exam.created_by=p_actor and public.tipy_teacher_targets(p_actor,owned_exam.definition)) then raise exception 'Class access denied'; end if;
  end if;
  if p_action in ('attempts','retake') and not public.tipy_manages_student(p_actor,(p_input->>'userId')::uuid) then raise exception 'Class access denied'; end if;
 end if;
 p_input=p_input||jsonb_build_object('_teacher',case when actor_role='teacher' then p_actor else null end);
 if p_action in ('save','publish','results','results_v2','retake','delete','visibility') and not manager then raise exception 'Admin required'; end if;
 if p_action='delete' and coalesce(p_input->>'confirm','')<>'accept' then raise exception 'Confirmation required'; end if;
 if p_action in ('save','publish','retake','delete','visibility','start','checkpoint','submit') then
  perform 1 from public.assessments where assessment_id=exam for update;
 end if;
 if not manager and p_action in ('list','detail','attempts','start','checkpoint','submit') then
  perform public.tipy_sync_assessment_assignments(exam,p_actor);
 elsif manager and p_action in ('results','results_v2','retake') then
  perform public.tipy_sync_assessment_assignments(exam,null);
 end if;
 if actor_role<>'teacher' or exam is not null then perform public.tipy_expire_assessments(exam,case when manager then null else p_actor end); end if;
 if p_action='list' and coalesce(p_input->>'classId','all')<>'all' and not public.tipy_classroom_allowed(p_actor,(p_input->>'classId')::uuid) then raise exception 'Class access denied'; end if;
 if p_action='list' then
  select count(*) into amount from public.assessments x where (is_admin or (actor_role='teacher' and public.tipy_teacher_exam_read(p_actor,x.assessment_id)) or (actor_role='student' and public.tipy_assessment_access(p_actor,x.assessment_id))) and (coalesce(p_input->>'classId','all')='all' or x.definition->'targets'->'classIds' ? (p_input->>'classId'));
  page=least(page,greatest(1,ceil(amount/20.0)::integer));
  select coalesce(jsonb_agg(r order by r.created_at desc,r.assessment_id),'[]') into items from (
   select x.assessment_id,x.created_by,(is_admin or (x.created_by=p_actor and public.tipy_teacher_targets(p_actor,x.definition))) as can_manage,x.hidden,x.status,x.version,x.created_at,x.published_at,x.definition->>'title' as title,
   x.definition->>'description' as description,x.definition->'schedule' as schedule,clock_timestamp() as server_now,case when p.role='admin' then 'Thầy Hùng' else coalesce(p.full_name,'Thầy cô') end as teacher,
   case when latest.submitted_at is not null then 'submitted' when latest.attempt_id is not null then 'in_progress' else 'not_started' end as attempt_status
   from public.assessments x left join public.profiles p on p.user_id=x.created_by
   left join lateral(select attempt_id,submitted_at from public.assessment_attempts z where z.assessment_id=x.assessment_id and z.user_id=p_actor order by z.attempt_number desc limit 1) latest on true
   where (is_admin or (actor_role='teacher' and public.tipy_teacher_exam_read(p_actor,x.assessment_id)) or (actor_role='student' and public.tipy_assessment_access(p_actor,x.assessment_id))) and (coalesce(p_input->>'classId','all')='all' or x.definition->'targets'->'classIds' ? (p_input->>'classId'))
   order by x.created_at desc,x.assessment_id limit 20 offset (page-1)*20
  )r;
  return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(amount/20.0)::integer),'total',amount);
 end if;
 if p_action='save' then
  perform pg_advisory_xact_lock(hashtextextended(exam::text,0));
  select * into e from public.assessments where assessment_id=exam for update;
  if found and e.status<>'draft' then raise exception 'Published assessment is immutable'; end if;
  if found and e.last_request_id=(p_input->>'requestId')::uuid then
   if e.last_request_hash<>md5((p_input->'definition')::text) then raise exception 'Conflict'; end if;
   return to_jsonb(e);
  end if;
  if coalesce(e.version,0)<>coalesce((p_input->>'version')::integer,0) then raise exception 'Conflict'; end if;
  def=p_input->'definition';
  if jsonb_typeof(def)<>'object' or coalesce(length(def->>'title'),0) not between 1 and 100
   or jsonb_typeof(def->'sections')<>'array' or jsonb_array_length(def->'sections')>2 then raise exception 'Invalid assessment'; end if;
  select coalesce(array_agg(value::uuid),'{}') into v_classes from jsonb_array_elements_text(def->'targets'->'classIds');
  select coalesce(array_agg(value::uuid),'{}') into v_students from jsonb_array_elements_text(def->'targets'->'userIds');
  if exists(select 1 from unnest(v_classes) id where not exists(select 1 from public.classes where class_id=id and archived_at is null))
   or exists(select 1 from unnest(v_students) id where not exists(select 1 from public.profiles where user_id=id and role='student' and is_active)) then raise exception 'Invalid recipients'; end if;
  def=def||jsonb_build_object('targetNames',coalesce((select jsonb_agg(name) from
   (select name from public.classes where class_id=any(v_classes) union all select full_name from public.profiles where user_id=any(v_students)) names),'[]'));
  insert into public.assessments(assessment_id,created_by,definition,last_request_id,last_request_hash) values(exam,p_actor,def,(p_input->>'requestId')::uuid,md5((p_input->'definition')::text))
  on conflict(assessment_id) do update set definition=excluded.definition,version=assessments.version+1,last_request_id=excluded.last_request_id,last_request_hash=excluded.last_request_hash returning * into e;
  return to_jsonb(e);
 end if;
 select * into e from public.assessments where assessment_id=exam;
 if p_action='delete' then
  if not found then return jsonb_build_object('deleted',true,'permanent',true); end if;
  if e.definition->>'title'<>p_input->>'title' then raise exception 'Conflict'; end if;
  delete from public.assessments where assessment_id=exam;
  if exists(select 1 from public.assessments where assessment_id=exam)
   or exists(select 1 from public.assessment_assignments where assessment_id=exam)
   or exists(select 1 from public.assessment_attempts where assessment_id=exam)
   or exists(select 1 from public.assessment_class_targets where assessment_id=exam) then raise exception 'Deletion incomplete'; end if;
  return jsonb_build_object('deleted',true,'permanent',true);
 end if;
 if not found then raise exception 'Assessment deleted'; end if;
 if not manager and e.status='deleted' then raise exception 'Assessment deleted'; end if;
 if not manager and not public.tipy_assessment_access(p_actor,exam) then raise exception 'Access denied'; end if;
 if p_action='visibility' then
  if jsonb_typeof(p_input->'hidden') is distinct from 'boolean' or e.status<>'published' then raise exception 'Invalid visibility'; end if;
  update public.assessments set hidden=(p_input->>'hidden')::boolean where assessment_id=exam returning * into e;
  return jsonb_build_object('assessment_id',exam,'hidden',e.hidden,'completed',true);
 end if;
 if p_action='detail' then
  if manager then
   if not is_admin then
    e.definition=(e.definition-'targetNames')||jsonb_build_object('targets',jsonb_build_object(
     'classIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(e.definition->'targets'->'classIds') id where public.tipy_manages_class(p_actor,id::uuid)),'[]'),
     'userIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(e.definition->'targets'->'userIds') id where public.tipy_manages_student(p_actor,id::uuid)),'[]')));
   end if;
   return jsonb_build_object('assessment',to_jsonb(e)||jsonb_build_object('can_manage',is_admin or (e.created_by=p_actor and public.tipy_teacher_targets(p_actor,(select definition from public.assessments where assessment_id=exam)))),'serverNow',clock_timestamp());
  end if;
  select * into assigned from public.assessment_assignments where assessment_id=exam and user_id=p_actor;
  select * into t from public.assessment_attempts where assessment_id=exam and user_id=p_actor order by attempt_number desc limit 1;
  limit_attempts=case when e.definition->'repeats'->>'mode'='unlimited' then null else assigned.allowed_attempts end;
  return jsonb_build_object('assessment',jsonb_build_object('assessment_id',exam,'status',e.status,'hidden',e.hidden,'definition',
   (case when t.attempt_id is not null and t.submitted_at is null then t.definition else e.definition end)-'targets'-'selection'-'targetNames',
   'teacher',coalesce((select case when role='admin' then 'Thầy Hùng' else full_name end from public.profiles where user_id=e.created_by),'Thầy cô')),
   'attempt',case when t.attempt_id is null then null else (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')) end,'allowedAttempts',limit_attempts,
   'remainingAttempts',case when limit_attempts is null then null else greatest(0,limit_attempts-coalesce(t.attempt_number,0)) end,'serverNow',clock_timestamp());
 end if;
 if p_action='attempts' then
  target=case when manager then (p_input->>'userId')::uuid else p_actor end;
  if not manager and p_input->>'userId'<>p_actor::text then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.assessment_assignments where assessment_id=exam and user_id=target) then raise exception 'Access denied'; end if;
  select count(*) into amount from public.assessment_attempts where assessment_id=exam and user_id=target;
  page=least(page,greatest(1,ceil(amount/20.0)::integer));
  select coalesce(jsonb_agg(r order by r.attempt_number desc),'[]') into items from (
   select attempt_id,attempt_number,started_at,submitted_at,active_seconds,results,closed_reason from public.assessment_attempts
   where assessment_id=exam and user_id=target order by attempt_number desc limit 20 offset (page-1)*20)r;
  return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(amount/20.0)::integer),'total',amount,'best_sections',public.tipy_assessment_best(exam,target));
 end if;
 if p_action='publish' then
  select * into e from public.assessments where assessment_id=exam for update;
  if e.status='published' then return to_jsonb(e); end if;
  if e.status<>'draft' then raise exception 'Deleted'; end if;
  if e.version<>(p_input->>'version')::integer then raise exception 'Conflict'; end if;
  if jsonb_array_length(e.definition->'sections')=0 then raise exception 'Assessment has no content'; end if;
  select coalesce(array_agg(value::uuid),'{}') into v_classes from jsonb_array_elements_text(e.definition->'targets'->'classIds');
  select coalesce(array_agg(value::uuid),'{}') into v_students from jsonb_array_elements_text(e.definition->'targets'->'userIds');
  perform 1 from public.classes where class_id=any(v_classes) for share;
  perform 1 from public.class_members where class_id=any(v_classes) for share;
  if exists(select 1 from unnest(v_classes) id where not exists(select 1 from public.classes where class_id=id and archived_at is null))
   or exists(select 1 from unnest(v_students) id where not exists(select 1 from public.profiles where user_id=id and is_active and role='student')) then raise exception 'Invalid recipients'; end if;
  insert into public.assessment_class_targets(assessment_id,class_id)
  select exam,c.class_id from public.classes c where c.class_id=any(v_classes) on conflict do nothing;
  insert into public.assessment_assignments(assessment_id,user_id,direct,class_ids)
  select exam,p.user_id,p.user_id=any(v_students),array(select m.class_id from public.class_members m where m.user_id=p.user_id and m.is_active and m.class_id=any(v_classes))
  from public.profiles p where p.role='student' and p.is_active and (p.user_id=any(v_students) or exists(select 1 from public.class_members m where m.user_id=p.user_id and m.is_active and m.class_id=any(v_classes))) on conflict do nothing;
  if cardinality(v_classes)=0 and not exists(select 1 from public.assessment_assignments where assessment_id=exam) then raise exception 'No students to receive'; end if;
  update public.assessment_assignments set allowed_attempts=case when e.definition->'repeats'->>'mode'='limited' then 1+(e.definition->'repeats'->>'extra')::integer else 1 end where assessment_id=exam;
  update public.assessments set status='published',published_at=now() where assessment_id=exam returning * into e;
  return to_jsonb(e);
 end if;
 if p_action='results_v2' then return public.tipy_assessment_results(exam,p_input); end if;
 if p_action='results' then
  select count(*) into amount from public.assessment_assignments where assessment_id=exam;
  page=least(page,greatest(1,ceil(amount/20.0)::integer));
  select coalesce(jsonb_agg(r order by r.full_name,r.user_id),'[]') into items from (
   select p.user_id,p.full_name,p.username,assignment_row.allowed_attempts,coalesce((select jsonb_agg(jsonb_build_object('attempt_id',z.attempt_id,'attempt_number',z.attempt_number,'started_at',z.started_at,'submitted_at',z.submitted_at,'active_seconds',z.active_seconds,'results',z.results) order by z.attempt_number desc) from public.assessment_attempts z where z.assessment_id=exam and z.user_id=p.user_id),'[]') as attempts
   from public.assessment_assignments assignment_row join public.profiles p using(user_id) where assignment_row.assessment_id=exam
   order by p.full_name,p.user_id limit 20 offset (page-1)*20
  )r;
  return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(amount/20.0)::integer),'total',amount);
 end if;

 if p_action='retake' then
  target=(p_input->>'userId')::uuid;
  select * into assigned from public.assessment_assignments where assessment_id=exam and user_id=target for update;
  if not found then raise exception 'Access denied'; end if;
  select * into t from public.assessment_attempts where assessment_id=exam and user_id=target and attempt_id=(p_input->>'attemptId')::uuid;
  if not found or t.submitted_at is null then raise exception 'Submit before retake'; end if;
  update public.assessment_assignments set allowed_attempts=greatest(allowed_attempts,t.attempt_number+1) where assessment_id=exam and user_id=target;
  return jsonb_build_object('completed',true);
 end if;
 if manager then raise exception 'Student assignment required'; end if;
 select * into assigned from public.assessment_assignments where assessment_id=exam and user_id=p_actor for update;
 if not found then raise exception 'Access denied'; end if;
 if p_action='start' then
  select * into t from public.assessment_attempts where assessment_id=exam and user_id=p_actor order by attempt_number desc limit 1;
  if t.attempt_id is not null and t.submitted_at is null then return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')); end if;
  if e.status<>'published' or e.hidden then raise exception 'Deleted'; end if;
  if e.definition->'schedule'->>'mode'='scheduled' then
   if clock_timestamp()<(e.definition->'schedule'->>'opensAt')::timestamptz then raise exception 'Not open'; end if;
   if clock_timestamp()>=(e.definition->'schedule'->>'closesAt')::timestamptz then raise exception 'Closed'; end if;
  end if;
  if e.definition->'repeats'->>'mode' is distinct from 'unlimited' and coalesce(t.attempt_number,0)>=assigned.allowed_attempts then raise exception 'Attempt already submitted'; end if;
  insert into public.assessment_attempts(assessment_id,user_id,attempt_number,definition,deadline,results) values(exam,p_actor,coalesce(t.attempt_number,0)+1,e.definition,case when e.definition->'schedule'->>'mode'='scheduled' then (e.definition->'schedule'->>'closesAt')::timestamptz end,public.tipy_assessment_outcomes(e.definition,'[]')) returning * into t;
  return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames'));
 end if;
 if p_action in ('checkpoint','submit') then
  select * into t from public.assessment_attempts where attempt_id=(p_input->>'attemptId')::uuid and assessment_id=exam and user_id=p_actor for update;
  if not found then raise exception 'Access denied'; end if;
  if t.closed_reason='deadline' then return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')); end if;
  fingerprint=md5((p_input->'payload')::text||(p_input->'results')::text);
  if t.last_request_id=(p_input->>'requestId')::uuid then
   if t.last_request_hash<>fingerprint then raise exception 'Conflict'; end if;
   return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames'));
  end if;
  if t.submitted_at is not null then
   if p_action='submit' then return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')); end if;
   raise exception 'Attempt already submitted';
  end if;
  if t.revision<>(p_input->>'revision')::integer then raise exception 'Conflict'; end if;
  if (p_input->>'seconds')::integer<t.active_seconds or (p_input->>'seconds')::integer>extract(epoch from clock_timestamp()-t.started_at)+3 then raise exception 'Invalid time'; end if;
  update public.assessment_attempts set payload=p_input->'payload',results=public.tipy_assessment_outcomes(t.definition,p_input->'results'),active_seconds=(p_input->>'seconds')::integer,
   revision=revision+1,last_request_id=(p_input->>'requestId')::uuid,last_request_hash=fingerprint,updated_at=now(),submitted_at=case when p_action='submit' then now() else null end
  where attempt_id=t.attempt_id returning * into t;
  return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames'));
 end if;
 raise exception 'Unknown assessment action';
end $$;

-- The existing deduction transaction keeps receipt, balance lock and reward ceilings.
create or replace function public.tipy_star_class_scope(p_actor uuid,p_user uuid,p_class uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then
  if p_class is null or not public.tipy_manages_class(p_actor,p_class) then raise exception 'Class access denied'; end if;
 end if;
 if p_class is not null then
  perform 1 from public.classes where class_id=p_class and archived_at is null for share;
  if not found then raise exception 'Class access denied'; end if;
  perform 1 from public.class_members where class_id=p_class and user_id=p_user and is_active for share;
  if not found then raise exception 'Class access denied'; end if;
 end if;
end $$;

-- Serialize class removal with gifts using the same membership locks as deductions.
alter function public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid) rename to tipy_class_star_gift_before_hub;
create function public.tipy_class_star_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text,p_class uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform public.tipy_star_class_scope(p_actor,p_user,p_class);
 return public.tipy_class_star_gift_before_hub(p_actor,p_user,p_request,p_amount,p_message,p_class);
end $$;
revoke all on function public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid) to service_role;

create function public.tipy_classroom_hub(p_actor uuid,p_class uuid,p_page integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare room public.classes; staff boolean=public.tipy_manages_class(p_actor,p_class); amount integer; page integer; members jsonb; podium jsonb; week date=public.tipy_week_start(clock_timestamp());
begin
 select * into room from public.classes c where c.class_id=p_class and c.archived_at is null;
 if not found or not exists(select 1 from public.profiles where user_id=p_actor and is_active and (staff or (role='student' and exists(select 1 from public.class_members where class_id=p_class and user_id=p_actor and is_active)))) then raise exception 'Class access denied'; end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page'; end if;
 select count(*) into amount from public.class_members m join public.profiles p using(user_id) where m.class_id=p_class and m.is_active and p.is_active and p.role='student';
 page=least(p_page,greatest(1,ceil(amount/24.0)::integer));
 with rows as materialized (
  select p.user_id,p.full_name name,case when staff then p.username else null end username,to_jsonb(a) avatar
  from public.class_members m join public.profiles p using(user_id) left join public.student_avatars a using(user_id)
  where m.class_id=p_class and m.is_active and p.is_active and p.role='student' order by p.full_name,p.user_id limit 24 offset (page-1)*24
 ), balances as (select r.user_id,sum(s.amount-s.reset_amount) stars from rows r left join public.star_rewards s using(user_id) where staff group by r.user_id)
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('stars',case when staff then coalesce(b.stars,0) else null end) order by r.name,r.user_id),'[]') into members from rows r left join balances b using(user_id);
 select coalesce(jsonb_agg(value||jsonb_build_object('rank',ordinality) order by ordinality),'[]') into podium from jsonb_array_elements(public.tipy_class_week_stars(p_class,week)) with ordinality where ordinality<=3;
 return jsonb_build_object('classroom',to_jsonb(room),'canManage',staff,'members',members,'total',amount,'page',page,'pages',greatest(1,ceil(amount/24.0)::integer),'top',podium,'weekStart',week,'weekEnd',week+7,'serverNow',clock_timestamp(),'nextWeekAt',(week+7)::timestamp at time zone 'Asia/Ho_Chi_Minh');
end $$;

create table public.class_member_removals (
 request_id uuid primary key, actor_id uuid references public.profiles(user_id) on delete set null, class_id uuid not null references public.classes(class_id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade, removed_at timestamptz not null default clock_timestamp(), response jsonb not null
);
alter table public.class_member_removals enable row level security;
revoke all on public.class_member_removals from public,anon,authenticated;
grant all on public.class_member_removals to service_role;
create function public.tipy_remove_class_member(p_actor uuid,p_class uuid,p_user uuid,p_request uuid,p_confirm text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.class_member_removals; answer jsonb;
begin
 if not public.tipy_manages_class(p_actor,p_class) then raise exception 'Class access denied'; end if;
 if p_confirm is distinct from 'accept' or p_request is null then raise exception 'Confirmation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into receipt from public.class_member_removals where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.class_id<>p_class or receipt.user_id<>p_user then raise exception 'Request conflict'; end if;
  return receipt.response;
 end if;
 perform 1 from public.class_members m join public.profiles p using(user_id) where m.class_id=p_class and m.user_id=p_user and m.is_active and p.role='student' for update of m;
 if not found then raise exception 'Class access denied'; end if;
 update public.class_members set is_active=false where class_id=p_class and user_id=p_user;
 answer=jsonb_build_object('completed',true,'userId',p_user,'classId',p_class,'overview',public.tipy_classroom_hub(p_actor,p_class,1));
 insert into public.class_member_removals(request_id,actor_id,class_id,user_id,response) values(p_request,p_actor,p_class,p_user,answer);
 return answer;
end $$;
revoke all on function public.tipy_classroom_hub(uuid,uuid,integer),public.tipy_remove_class_member(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.tipy_classroom_hub(uuid,uuid,integer),public.tipy_remove_class_member(uuid,uuid,uuid,uuid,text) to service_role;

alter table public.student_notifications drop constraint student_notifications_kind_check;
alter table public.student_notifications add constraint student_notifications_kind_check check(kind in ('assessment','star_gift','post'));
create function public.tipy_notification_visible(p_user uuid,p_kind text,p_exam uuid,p_payload jsonb) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when p_kind='post' then exists(select 1 from public.class_posts p join public.classes c using(class_id) join public.class_members m using(class_id) where p.post_id::text=p_payload->>'postId' and m.user_id=p_user and m.is_active and c.archived_at is null and p.archived_at is null)
 else p_kind='star_gift' or p_exam is null or public.tipy_assessment_access(p_user,p_exam) end
$$;
create function public.tipy_class_post_notice() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='class_posts' then
  insert into public.student_notifications(user_id,kind,source_key,payload)
   select m.user_id,'post',new.post_id::text,jsonb_build_object('classId',new.class_id,'postId',new.post_id,'title',new.title,'teacher',case when a.role='admin' then 'Thầy Hùng' else a.full_name end)
   from public.class_members m join public.profiles p using(user_id),public.profiles a where m.class_id=new.class_id and m.is_active and p.is_active and p.role='student' and a.user_id=new.author_id and new.archived_at is null on conflict(user_id,kind,source_key) do nothing;
 elsif new.is_active and (tg_op='INSERT' or not old.is_active) then
  insert into public.student_notifications(user_id,kind,source_key,payload)
   select new.user_id,'post',p.post_id::text,jsonb_build_object('classId',p.class_id,'postId',p.post_id,'title',p.title,'teacher',case when a.role='admin' then 'Thầy Hùng' else a.full_name end)
   from public.class_posts p join public.profiles a on a.user_id=p.author_id where p.class_id=new.class_id and p.archived_at is null on conflict(user_id,kind,source_key) do nothing;
 end if;
 return new;
end $$;
create trigger notification_class_post after insert on public.class_posts for each row execute function public.tipy_class_post_notice();
create trigger notification_member_posts after insert or update of is_active on public.class_members for each row execute function public.tipy_class_post_notice();
create function public.tipy_class_notifications(p_actor uuid,p_class uuid,p_page integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare amount integer; page integer; items jsonb;
begin
 if not public.tipy_classroom_allowed(p_actor,p_class) then raise exception 'Class access denied'; end if;
 with matching as (
  select n.* from public.student_notifications n where n.user_id=p_actor and public.tipy_notification_visible(p_actor,n.kind,n.assessment_id,n.payload) and
  (n.payload->>'classId'=p_class::text or (n.kind='assessment' and exists(select 1 from public.assessment_class_targets t where t.assessment_id=n.assessment_id and t.class_id=p_class))
   or (n.kind='star_gift' and exists(select 1 from public.star_rewards r where r.source='teacher' and r.source_key=n.source_key and r.user_id=p_actor and r.class_id=p_class)))
 ), bounds as(select count(*) total from matching)
 select b.total,least(greatest(1,p_page),greatest(1,ceil(b.total/20.0)::integer)),coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.notification_id) from (select * from matching order by created_at desc,notification_id limit 20 offset (least(greatest(1,p_page),greatest(1,ceil(b.total/20.0)::integer))-1)*20)t),'[]') into amount,page,items from bounds b;
 return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(amount/20.0)::integer),'total',amount);
end $$;
revoke all on function public.tipy_notification_visible(uuid,text,uuid,jsonb),public.tipy_class_post_notice(),public.tipy_class_notifications(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.tipy_notification_visible(uuid,text,uuid,jsonb),public.tipy_class_post_notice(),public.tipy_class_notifications(uuid,uuid,integer) to service_role;
create or replace function public.tipy_notifications_list(p_user uuid,p_page integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare total integer; unread integer; page integer; items jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_user and role='student' and is_active) then raise exception 'Student required'; end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page'; end if;
 perform public.tipy_sync_assessment_assignments(null,p_user);
 select count(*),count(*) filter(where n.presented_at is null) into total,unread from public.student_notifications n
 where n.user_id=p_user and public.tipy_notification_visible(p_user,n.kind,n.assessment_id,n.payload);
 page=least(p_page,greatest(1,ceil(total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(t) order by (t.presented_at is null) desc,t.created_at desc,t.notification_id desc),'[]') into items from (
  select n.notification_id,n.kind,n.assessment_id,
   case when n.kind='assessment' then n.payload||jsonb_build_object('classId',(select t.class_id from public.assessment_class_targets t join public.class_members m using(class_id) join public.classes c using(class_id) where t.assessment_id=n.assessment_id and m.user_id=p_user and m.is_active and c.archived_at is null order by t.class_id limit 1))
    when n.kind='star_gift' then n.payload||jsonb_build_object('classId',(select r.class_id from public.star_rewards r where r.user_id=p_user and r.source='teacher' and r.source_key=n.source_key)) else n.payload end payload,
   n.created_at,n.presented_at,n.spoken_at
  from public.student_notifications n where n.user_id=p_user
   and public.tipy_notification_visible(p_user,n.kind,n.assessment_id,n.payload)
  order by (n.presented_at is null) desc,n.created_at desc,n.notification_id desc limit 20 offset (page-1)*20
 ) t;
 return jsonb_build_object('items',items,'page',page,'pages',greatest(1,ceil(total/20.0)::integer),'total',total,'unread',unread,
  'revision',coalesce((select to_char(max(greatest(created_at,presented_at,spoken_at)) at time zone 'UTC','YYYYMMDDHH24MISSUS') from public.student_notifications where user_id=p_user),''));
end $$;

create or replace function public.tipy_notifications_present(p_user uuid,p_ids uuid[],p_speak boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare changed jsonb; spoken jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_user and role='student' and is_active) then raise exception 'Student required'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 50 or p_speak is null then raise exception 'Invalid notification batch'; end if;
 -- Row locks choose exactly one tab to claim each previously unpresented notification.
 with locked as materialized (
  select n.notification_id,n.kind,n.payload,n.spoken_at from public.student_notifications n
  where n.user_id=p_user and n.notification_id=any(p_ids) and n.presented_at is null
   and public.tipy_notification_visible(p_user,n.kind,n.assessment_id,n.payload)
  order by n.notification_id for update
 ), updated as (
  update public.student_notifications n set presented_at=clock_timestamp(),
   spoken_at=case when p_speak then coalesce(n.spoken_at,clock_timestamp()) else n.spoken_at end
  from locked l where n.notification_id=l.notification_id and n.presented_at is null
  returning n.notification_id,l.kind,l.payload,(p_speak and l.spoken_at is null) speak
 )
 select coalesce(jsonb_agg(notification_id),'[]'),coalesce(jsonb_agg(jsonb_build_object('notification_id',notification_id,'kind',kind,'payload',payload)) filter(where speak),'[]')
 into changed,spoken from updated;
 return jsonb_build_object('presented',changed,'spoken',spoken,'page',public.tipy_notifications_list(p_user,1));
end $$;


notify pgrst, 'reload schema';
commit;
