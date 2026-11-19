-- Idempotent start receipts and list/start metadata; existing grading/access/deadlines remain authoritative.
begin;
create table public.assessment_start_requests (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 request_id uuid not null, assessment_id uuid not null references public.assessments(assessment_id) on delete cascade,
 attempt_id uuid not null references public.assessment_attempts(attempt_id) on delete cascade,
 primary key(user_id,request_id)
);
create index assessment_start_requests_exam on public.assessment_start_requests(assessment_id);
create index assessment_start_requests_attempt on public.assessment_start_requests(attempt_id);
alter table public.assessment_start_requests enable row level security;
revoke all on public.assessment_start_requests from public,anon,authenticated;
grant all on public.assessment_start_requests to service_role;
alter function public.tipy_assessment(uuid,text,jsonb) rename to tipy_assessment_before_auto_finish;
create function public.tipy_assessment(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare answer jsonb; prior public.assessment_start_requests; attempt public.assessment_attempts; exam uuid=(p_input->>'assessmentId')::uuid; request uuid=(p_input->>'requestId')::uuid; student boolean;
begin
 select role='student' into student from public.profiles where user_id=p_actor and is_active;
 if not found then raise exception 'Access denied'; end if;
 if p_action='start' and request is not null then
  if not student or not public.tipy_assessment_access(p_actor,exam) then raise exception 'Access denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended('assessment-start:'||p_actor::text||':'||request::text,0));
  select * into prior from public.assessment_start_requests where user_id=p_actor and request_id=request;
  if found then
   if prior.assessment_id<>exam then raise exception 'Conflict'; end if;
   perform public.tipy_assessment_before_auto_finish(p_actor,'detail',p_input);
   select * into attempt from public.assessment_attempts where attempt_id=prior.attempt_id and user_id=p_actor;
   answer=to_jsonb(attempt)||jsonb_build_object('server_now',clock_timestamp(),'definition',attempt.definition-'targets'-'selection'-'targetNames');
  else
   answer=public.tipy_assessment_before_auto_finish(p_actor,p_action,p_input);
   insert into public.assessment_start_requests values(p_actor,request,exam,(answer->>'attempt_id')::uuid);
  end if;
 else answer=public.tipy_assessment_before_auto_finish(p_actor,p_action,p_input);
 end if;
 if student and p_action in ('start','checkpoint','submit') then
  answer=answer||jsonb_build_object('allowedAttempts',(select case when e.definition->'repeats'->>'mode'='unlimited' then null else a.allowed_attempts end from public.assessments e join public.assessment_assignments a using(assessment_id) where e.assessment_id=exam and a.user_id=p_actor));
  if p_action='start' then
   answer=answer||jsonb_build_object('assessment',(select jsonb_build_object('assessment_id',e.assessment_id,'status',e.status,'hidden',e.hidden,'definition',answer->'definition','teacher',case when p.role='admin' then 'Thầy Hùng' else p.full_name end) from public.assessments e join public.profiles p on p.user_id=e.created_by where e.assessment_id=exam));
  end if;
 elsif student and p_action='list' then
  answer=answer||jsonb_build_object('items',coalesce((select jsonb_agg(item||jsonb_build_object('allowedAttempts',case when e.definition->'repeats'->>'mode'='unlimited' then null else a.allowed_attempts end,'attemptNumber',coalesce(t.attempt_number,0)) order by ordinality)
   from jsonb_array_elements(answer->'items') with ordinality as entries(item,ordinality)
   join public.assessments e on e.assessment_id=(item->>'assessment_id')::uuid
   join public.assessment_assignments a on a.assessment_id=e.assessment_id and a.user_id=p_actor
   left join lateral(select z.attempt_number from public.assessment_attempts z where z.assessment_id=e.assessment_id and z.user_id=p_actor order by z.attempt_number desc limit 1)t on true),'[]'));
 end if;
 return answer;
end $$;
revoke all on function public.tipy_assessment(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_assessment(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
