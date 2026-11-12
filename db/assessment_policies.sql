-- Additive assessment policies; existing published definitions and results stay intact.
begin;
alter table public.assessments drop constraint assessments_status_check;
alter table public.assessments add constraint assessments_status_check check(status in ('draft','published','deleted'));
alter table public.assessment_assignments drop constraint assessment_assignments_allowed_attempts_check;
alter table public.assessment_assignments add constraint assessment_assignments_allowed_attempts_check check(allowed_attempts between 1 and 1000000);
alter table public.assessment_attempts add column definition jsonb, add column deadline timestamptz, add column closed_reason text;
update public.assessment_attempts t set definition=e.definition from public.assessments e where e.assessment_id=t.assessment_id;
alter table public.assessment_attempts alter column definition set not null;
create index assessment_attempts_due on public.assessment_attempts(deadline) where submitted_at is null and deadline is not null;
create or replace function public.tipy_assessment_access(p_user uuid,p_exam uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.assessment_assignments a join public.assessments e using(assessment_id)
 where a.user_id=p_user and a.assessment_id=p_exam and (e.status='published' or (e.status='deleted' and exists(select 1 from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p_user))) and
 (a.direct or exists(select 1 from public.class_members m join public.classes c using(class_id)
 where m.user_id=p_user and m.is_active and c.archived_at is null and m.class_id=any(a.class_ids))))
$$;
create function public.tipy_assessment_outcomes(def jsonb,rows jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r||case when s->>'type'='falling' and s->>'targetScore' is not null then
 jsonb_build_object('targetScore',(s->>'targetScore')::integer,'outcome',case when coalesce((r->>'score')::integer,0)>=(s->>'targetScore')::integer then 'good' else 'practice' end) else '{}'::jsonb end order by ord),'[]')
 from jsonb_array_elements(def->'sections') with ordinality parts(s,ord)
 cross join lateral(select coalesce((select value from jsonb_array_elements(rows) where value->>'id'=s->>'id'),
 jsonb_build_object('id',s->>'id','title',s->>'title','type',s->>'type','seconds',0,'correct',0,'wrong',0,'accuracy',0,'completed',false)||
 case when s->>'type'='falling' then jsonb_build_object('score',0,'missed',0) else jsonb_build_object('answered',0,'total',jsonb_array_length(s->'items')) end) as r) fallback
$$;
create function public.tipy_expire_assessments(p_exam uuid default null,p_user uuid default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 -- Last server-validated checkpoint is authoritative when the browser is offline.
 update public.assessment_attempts set submitted_at=deadline,closed_reason='deadline',revision=revision+1,updated_at=clock_timestamp(),
 results=public.tipy_assessment_outcomes(definition,results)
 where submitted_at is null and deadline<=clock_timestamp() and (p_exam is null or assessment_id=p_exam) and (p_user is null or user_id=p_user);
 get diagnostics n=row_count; return n;
end $$;
-- Included by assessment_policies.sql; not a separate migration.
create function public.tipy_assessment_results(p_exam uuid,p_input jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 with students as (
  select p.user_id,p.full_name,p.username,a.allowed_attempts,
   coalesce((select jsonb_agg(jsonb_build_object('class_id',c.class_id,'name',c.name) order by c.name) from public.class_members m join public.classes c using(class_id)
    where m.user_id=p.user_id and m.is_active and c.archived_at is null),'[]') as classes,
   (select count(*) from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id) as attempt_count,
   (select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results)
    from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id order by t.attempt_number desc limit 1) as latest,
   (select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results)
    from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id and t.submitted_at is not null order by t.attempt_number desc limit 1) as latest_submitted,
   (select coalesce(jsonb_agg(best),'[]') from (
    select distinct on (r->>'id') jsonb_build_object('id',r->>'id','title',r->>'title','type',r->>'type','score',r->'score','accuracy',r->'accuracy','attempt_number',t.attempt_number) as best
    from public.assessment_attempts t cross join lateral jsonb_array_elements(t.results) r
    where t.assessment_id=p_exam and t.user_id=p.user_id and t.submitted_at is not null
    order by r->>'id',coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) desc,(r->>'accuracy')::numeric desc,t.attempt_number
   ) b) as best_sections
  from public.assessment_assignments a join public.profiles p using(user_id)
  where a.assessment_id=p_exam and (coalesce(p_input->>'search','')='' or position(lower(p_input->>'search') in lower(p.full_name||' '||p.username))>0)
   and (coalesce(p_input->>'classId','all')='all' or exists(select 1 from public.class_members m join public.classes c using(class_id) where m.user_id=p.user_id and m.is_active and c.archived_at is null and m.class_id::text=p_input->>'classId'))
 ), filtered as (
  select *,case when latest is null then 'not_started' when latest->>'submitted_at' is null then 'in_progress' else 'submitted' end as attempt_status,
   (select coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) from jsonb_array_elements(latest_submitted->'results') r order by case when r->>'type'='falling' then 0 else 1 end limit 1) as metric
  from students
 ), matches as (select * from filtered where coalesce(p_input->>'status','all')='all' or attempt_status=p_input->>'status'),
 totals as (select count(*) as total,greatest(1,ceil(count(*)/7.0)::integer) as pages from matches),
 bounds as (select *,least(greatest(1,coalesce((p_input->>'page')::integer,1)),pages) as page from totals),
 numbered as (
  select *,row_number() over(order by
   case when p_input->>'sort'='score_desc' then metric end desc nulls last,
   case when p_input->>'sort'='score_asc' then metric end asc nulls last,
   case when p_input->>'sort'='time_asc' then (latest_submitted->>'active_seconds')::integer end asc nulls last,
   case when p_input->>'sort'='time_desc' then (latest_submitted->>'active_seconds')::integer end desc nulls last,
   case when p_input->>'sort'='submitted_asc' then (latest_submitted->>'submitted_at')::timestamptz end asc nulls last,
   case when p_input->>'sort'='submitted_desc' then (latest_submitted->>'submitted_at')::timestamptz end desc nulls last,
   full_name,user_id) as row_number from matches
 )
 select jsonb_build_object('total',bounds.total,'page',bounds.page,'pages',bounds.pages,
 'sections',(select definition->'sections' from public.assessments where assessment_id=p_exam),
 'items',coalesce((select jsonb_agg(to_jsonb(n)-'metric' order by row_number) from numbered n where row_number>(bounds.page-1)*7 and row_number<=bounds.page*7),'[]')) from bounds
$$;

create function public.tipy_assessment_best(p_exam uuid,p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(best),'[]') from (
 select distinct on(r->>'id') jsonb_build_object('id',r->>'id','title',r->>'title','type',r->>'type','score',r->'score','accuracy',r->'accuracy','attempt_number',t.attempt_number) as best
 from public.assessment_attempts t cross join lateral jsonb_array_elements(t.results) r
 where t.assessment_id=p_exam and t.user_id=p_user and t.submitted_at is not null
 order by r->>'id',coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) desc,(r->>'accuracy')::numeric desc,t.attempt_number
 ) b
$$;
revoke all on function public.tipy_assessment_best(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tipy_assessment_best(uuid,uuid) to service_role;
create or replace function public.tipy_assessment(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare admin boolean; e public.assessments; assigned public.assessment_assignments; t public.assessment_attempts;
 exam uuid=(p_input->>'assessmentId')::uuid; target uuid; def jsonb; items jsonb; amount integer;
 page integer=greatest(1,coalesce((p_input->>'page')::integer,1)); v_classes uuid[]; v_students uuid[]; fingerprint text; limit_attempts integer; response jsonb;
begin
 select role='admin' into admin from public.profiles where user_id=p_actor and is_active;
 if not found then raise exception 'Access denied'; end if;
 if p_action in ('save','publish','results','results_v2','retake','delete') and not admin then raise exception 'Admin required'; end if;
 if p_action in ('save','publish','retake','delete','start','checkpoint','submit') then
  perform 1 from public.assessments where assessment_id=exam for update;
 end if;
 perform public.tipy_expire_assessments(exam,case when admin then null else p_actor end);
 if p_action='list' then
  select count(*) into amount from public.assessments x where admin or public.tipy_assessment_access(p_actor,x.assessment_id);
  page=least(page,greatest(1,ceil(amount/20.0)::integer));
  select coalesce(jsonb_agg(r order by r.created_at desc,r.assessment_id),'[]') into items from (
   select x.assessment_id,x.status,x.version,x.created_at,x.published_at,x.definition->>'title' as title,
   x.definition->>'description' as description,x.definition->'schedule' as schedule,clock_timestamp() as server_now,coalesce(p.full_name,'Thầy cô') as teacher,
   case when latest.submitted_at is not null then 'submitted' when latest.attempt_id is not null then 'in_progress' else 'not_started' end as attempt_status
   from public.assessments x left join public.profiles p on p.user_id=x.created_by
   left join lateral(select attempt_id,submitted_at from public.assessment_attempts z where z.assessment_id=x.assessment_id and z.user_id=p_actor order by z.attempt_number desc limit 1) latest on true
   where admin or public.tipy_assessment_access(p_actor,x.assessment_id)
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
  if not found then return jsonb_build_object('deleted',true); end if;
  if e.definition->>'title'<>p_input->>'title' then raise exception 'Conflict'; end if;
  if e.status='draft' and not exists(select 1 from public.assessment_attempts where assessment_id=exam) then
   delete from public.assessments where assessment_id=exam;
   return jsonb_build_object('deleted',true,'permanent',true);
  end if;
  update public.assessments set status='deleted' where assessment_id=exam;
  return jsonb_build_object('deleted',true,'permanent',false);
 end if;
 if not found then raise exception 'Access denied'; end if;
 if not admin and not public.tipy_assessment_access(p_actor,exam) then raise exception 'Access denied'; end if;
 if p_action='detail' then
  if admin then return jsonb_build_object('assessment',to_jsonb(e),'serverNow',clock_timestamp()); end if;
  select * into assigned from public.assessment_assignments where assessment_id=exam and user_id=p_actor;
  select * into t from public.assessment_attempts where assessment_id=exam and user_id=p_actor order by attempt_number desc limit 1;
  limit_attempts=case when e.definition->'repeats'->>'mode'='unlimited' then null else assigned.allowed_attempts end;
  return jsonb_build_object('assessment',jsonb_build_object('assessment_id',exam,'status',e.status,'definition',
   (case when t.attempt_id is not null and t.submitted_at is null then t.definition else e.definition end)-'targets'-'selection'-'targetNames',
   'teacher',coalesce((select full_name from public.profiles where user_id=e.created_by),'Thầy cô')),
   'attempt',case when t.attempt_id is null then null else (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')) end,'allowedAttempts',limit_attempts,
   'remainingAttempts',case when limit_attempts is null then null else greatest(0,limit_attempts-coalesce(t.attempt_number,0)) end,'serverNow',clock_timestamp());
 end if;
 if p_action='attempts' then
  target=case when admin then (p_input->>'userId')::uuid else p_actor end;
  if not admin and p_input->>'userId'<>p_actor::text then raise exception 'Access denied'; end if;
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
  insert into public.assessment_assignments(assessment_id,user_id,direct,class_ids)
  select exam,p.user_id,p.user_id=any(v_students),array(select m.class_id from public.class_members m where m.user_id=p.user_id and m.is_active and m.class_id=any(v_classes))
  from public.profiles p where p.role='student' and p.is_active and (p.user_id=any(v_students) or exists(select 1 from public.class_members m where m.user_id=p.user_id and m.is_active and m.class_id=any(v_classes))) on conflict do nothing;
  if not exists(select 1 from public.assessment_assignments where assessment_id=exam) then raise exception 'No students to receive'; end if;
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
 if admin then raise exception 'Student assignment required'; end if;
 select * into assigned from public.assessment_assignments where assessment_id=exam and user_id=p_actor for update;
 if not found then raise exception 'Access denied'; end if;
 if p_action='start' then
  select * into t from public.assessment_attempts where assessment_id=exam and user_id=p_actor order by attempt_number desc limit 1;
  if t.attempt_id is not null and t.submitted_at is null then return (to_jsonb(t)||jsonb_build_object('server_now',clock_timestamp(),'definition',t.definition-'targets'-'selection'-'targetNames')); end if;
  if e.status<>'published' then raise exception 'Deleted'; end if;
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

revoke all on function public.tipy_assessment_outcomes(jsonb,jsonb),public.tipy_expire_assessments(uuid,uuid),public.tipy_assessment_results(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_assessment_outcomes(jsonb,jsonb),public.tipy_expire_assessments(uuid,uuid),public.tipy_assessment_results(uuid,jsonb) to service_role;
commit;
