-- Summary-only teacher pages: filter/sort first, count/classes only for seven rows.
-- No new tables, grants, indexes, grading or membership rules.
begin;
create or replace function public.tipy_assessment_results(p_exam uuid,p_input jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 with students as materialized (
  select p.user_id,p.full_name,p.username,a.allowed_attempts,
   l.latest,s.latest_submitted,
   case when l.latest is null then 'not_started' when l.latest->>'submitted_at' is null then 'in_progress' else 'submitted' end as attempt_status,
   (select coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) from jsonb_array_elements(s.latest_submitted->'results') r order by case when r->>'type'='falling' then 0 else 1 end limit 1) as metric
  from public.assessment_assignments a join public.profiles p using(user_id)
  left join lateral (
   select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results) as latest
   from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id order by t.attempt_number desc limit 1
  ) l on true
  left join lateral (
   select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results) as latest_submitted
   from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id and t.submitted_at is not null order by t.attempt_number desc limit 1
  ) s on true
  where a.assessment_id=p_exam and (coalesce(p_input->>'search','')='' or position(lower(p_input->>'search') in lower(p.full_name||' '||p.username))>0)
   and (coalesce(p_input->>'classId','all')='all' or exists(select 1 from public.class_members m join public.classes c using(class_id) where m.user_id=p.user_id and m.is_active and c.archived_at is null and m.class_id::text=p_input->>'classId'))
 ), matches as materialized (
  select * from students where coalesce(p_input->>'status','all')='all' or attempt_status=p_input->>'status'
 ), totals as (select count(*) as total,greatest(1,ceil(count(*)/7.0)::integer) as pages from matches),
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
 ), page_rows as materialized (
  select n.* from numbered n cross join bounds b where row_number>(b.page-1)*7 and row_number<=b.page*7
 )
 select jsonb_build_object('total',bounds.total,'page',bounds.page,'pages',bounds.pages,
 'items',coalesce((select jsonb_agg((to_jsonb(n)-'metric')||jsonb_build_object(
  'attempt_count',(select count(*) from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=n.user_id),
  'classes',coalesce((select jsonb_agg(jsonb_build_object('class_id',c.class_id,'name',c.name) order by c.name)
   from public.class_members m join public.classes c using(class_id) where m.user_id=n.user_id and m.is_active and c.archived_at is null),'[]')
 ) order by row_number) from page_rows n),'[]')) from bounds
$$;
commit;
