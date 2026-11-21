-- Add guard assessment sections; keep existing attempts, permissions, and immutable snapshots.
begin;
create or replace function public.tipy_assessment_before_auto_finish(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb
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
   x.definition->>'description' as description,(select coalesce(jsonb_agg(s->>'title'),'[]') from jsonb_array_elements(x.definition->'sections') s) as game_titles,x.definition->'schedule' as schedule,clock_timestamp() as server_now,case when p.role='admin' then 'Thầy Hùng' else coalesce(p.full_name,'Thầy cô') end as teacher,
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
   or jsonb_typeof(def->'sections')<>'array' or jsonb_array_length(def->'sections')>3 then raise exception 'Invalid assessment'; end if;
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
create or replace function public.tipy_assessment_outcomes(def jsonb,rows jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r||case when s->>'type'='falling' and s->>'targetScore' is not null then
 jsonb_build_object('targetScore',(s->>'targetScore')::integer,'outcome',case when coalesce((r->>'score')::integer,0)>=(s->>'targetScore')::integer then 'good' else 'practice' end) when s->>'type'='guard' then jsonb_build_object('targetScore',(s->>'goodScore')::integer,'outcome',case when coalesce((r->>'completed')::boolean,false) and coalesce((r->>'score')::integer,0)>=(s->>'goodScore')::integer then 'good' when coalesce((r->>'completed')::boolean,false) then 'completed' else 'practice' end) else '{}'::jsonb end order by ord),'[]')
 from jsonb_array_elements(def->'sections') with ordinality parts(s,ord)
 cross join lateral(select coalesce((select value from jsonb_array_elements(rows) where value->>'id'=s->>'id'),
 jsonb_build_object('id',s->>'id','title',s->>'title','type',s->>'type','seconds',0,'correct',0,'wrong',0,'accuracy',0,'completed',false)||
 case when s->>'type'='guard' then jsonb_build_object('score',0,'destroyed',0,'total',(s->'config'->>'totalTargets')::integer) when s->>'type'='falling' then jsonb_build_object('score',0,'missed',0) else jsonb_build_object('answered',0,'total',jsonb_array_length(s->'items')) end) as r) fallback
$$;

revoke all on function public.tipy_assessment_before_auto_finish(uuid,text,jsonb),public.tipy_assessment_outcomes(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_assessment_before_auto_finish(uuid,text,jsonb),public.tipy_assessment_outcomes(jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
