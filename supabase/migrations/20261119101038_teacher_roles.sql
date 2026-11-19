-- Separate teachers from administrators. Existing administrator accounts are unchanged.
begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('student','teacher','admin'));
create table public.class_teachers (
 class_id uuid not null references public.classes(class_id) on delete cascade,
 teacher_id uuid not null references public.profiles(user_id) on delete cascade,
 assigned_by uuid references public.profiles(user_id) on delete set null,
 assigned_at timestamptz not null default clock_timestamp(),
 primary key(class_id,teacher_id)
);
create index class_teachers_teacher on public.class_teachers(teacher_id,class_id);
alter table public.class_teachers enable row level security;
revoke all on public.class_teachers from public,anon,authenticated;
grant all on public.class_teachers to service_role;

create function public.tipy_manages_class(p_actor uuid,p_class uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles p join public.classes c on c.class_id=p_class
 where p.user_id=p_actor and p.is_active and c.archived_at is null and
 (p.role='admin' or (p.role='teacher' and exists(select 1 from public.class_teachers t where t.teacher_id=p_actor and t.class_id=p_class))))
$$;
create function public.tipy_manages_student(p_actor uuid,p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=p_user and p.role='student' and p.is_active
 and exists(select 1 from public.class_members m where m.user_id=p_user and m.is_active and public.tipy_manages_class(p_actor,m.class_id)))
$$;
create function public.tipy_class_access(p_actor uuid,p_class uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.tipy_manages_class(p_actor,p_class) then raise exception 'Class access denied'; end if;
 return (select to_jsonb(c) from public.classes c where c.class_id=p_class);
end $$;

-- RLS uses the current database profile; JWT user_metadata cannot grant a role.
create or replace function tipy_private.can_read_class(p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.is_active and
 (p.role='admin' or public.tipy_manages_class(p.user_id,p_class) or (p.role='student' and exists(select 1 from public.class_members m
 join public.classes c using(class_id) where m.user_id=p.user_id and m.class_id=p_class and m.is_active and c.archived_at is null))))
$$;

create function public.tipy_teacher_admin(p_actor uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target uuid=(p_input->>'userId')::uuid; ids uuid[]; target_role text; amount integer; page integer; items jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if p_action in ('validate','provision','save') and (jsonb_typeof(p_input->'classIds') is distinct from 'array' or jsonb_array_length(p_input->'classIds')>200) then raise exception 'Invalid classes'; end if;
 if p_action='validate' then
  if exists(select 1 from jsonb_array_elements_text(p_input->'classIds') id where not exists(select 1 from public.classes c where c.class_id=id::uuid and c.archived_at is null)) then raise exception 'Invalid classes'; end if;
  return jsonb_build_object('valid',true);
 end if;
 if p_action='list' then
  select count(*) into amount from public.profiles where role='teacher' and (coalesce(p_input->>'search','')='' or position(lower(p_input->>'search') in lower(full_name||' '||username))>0);
  page=least(greatest(1,coalesce((p_input->>'page')::integer,1)),greatest(1,ceil(amount/7.0)::integer));
  select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('classIds',(select coalesce(jsonb_agg(c.class_id),'[]') from public.class_teachers c where c.teacher_id=t.user_id)) order by t.full_name,t.user_id),'[]') into items
  from (select user_id,username,full_name,is_active from public.profiles where role='teacher' and (coalesce(p_input->>'search','')='' or position(lower(p_input->>'search') in lower(full_name||' '||username))>0) order by full_name,user_id limit 7 offset (page-1)*7)t;
  return jsonb_build_object('items',items,'page',page,'total',amount,'pages',greatest(1,ceil(amount/7.0)::integer));
 end if;
 select role into target_role from public.profiles where user_id=target for update;
 if not found or target=p_actor or target_role='admin' then raise exception 'Protected account'; end if;
 if p_action='provision' then
  -- The HTTP service provisions Auth first; retrying cannot overwrite a later administrative assignment.
  if target_role='teacher' then return jsonb_build_object('completed',true,'userId',target); end if;
  if target_role<>'student' then raise exception 'Invalid teacher'; end if;
  update public.profiles set role='teacher' where user_id=target;
 elsif target_role<>'teacher' then raise exception 'Invalid teacher';
 end if;
 if p_action not in ('provision','save') then raise exception 'Unknown action'; end if;
 select coalesce(array_agg(distinct value::uuid),'{}') into ids from jsonb_array_elements_text(p_input->'classIds');
 if exists(select 1 from unnest(ids) id where not exists(select 1 from public.classes c where c.class_id=id and (c.archived_at is null or (p_action='save' and exists(select 1 from public.class_teachers t where t.class_id=id and t.teacher_id=target))))) then raise exception 'Invalid classes'; end if;
 delete from public.class_teachers where teacher_id=target and not(class_id=any(ids));
 insert into public.class_teachers(class_id,teacher_id,assigned_by) select id,target,p_actor from unnest(ids)id on conflict do nothing;
 if p_input ? 'active' then update public.profiles set is_active=(p_input->>'active')::boolean where user_id=target; end if;
 return jsonb_build_object('completed',true,'userId',target);
end $$;

create function public.tipy_teacher_students(p_actor uuid,p_page integer,p_search text,p_class text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare answer jsonb;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='teacher' and is_active) then raise exception 'Access denied'; end if;
 if p_class<>'all' and not public.tipy_manages_class(p_actor,p_class::uuid) then raise exception 'Class access denied'; end if;
 with roster as materialized (
  select p.user_id,p.username,p.full_name,p.is_active,p.created_at from public.profiles p where p.role='student' and p.is_active
  and (p_search='' or position(lower(p_search) in lower(p.full_name||' '||p.username))>0)
  and exists(select 1 from public.class_members m where m.user_id=p.user_id and m.is_active and public.tipy_manages_class(p_actor,m.class_id) and (p_class='all' or m.class_id::text=p_class))
 ), totals as (select count(*) total,greatest(1,ceil(count(*)/7.0)::integer) pages from roster), bounds as(select *,least(greatest(1,p_page),pages) page from totals),
 rows as (select r.* from roster r order by r.full_name,r.user_id limit 7 offset ((select page from bounds)-1)*7)
 select jsonb_build_object('page',b.page,'pages',b.pages,'total',b.total,'summary',jsonb_build_object('students',b.total,'seconds',0,'plays',0),
 'students',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('class_members',coalesce((select jsonb_agg(jsonb_build_object('is_active',true,'classes',jsonb_build_object('class_id',c.class_id,'name',c.name,'archived_at',null))) from public.class_members m join public.classes c using(class_id) where m.user_id=r.user_id and m.is_active and public.tipy_manages_class(p_actor,c.class_id)),'[]')) order by r.full_name,r.user_id) from rows r),'[]')) into answer from bounds b;
 return answer;
end $$;

-- Teachers never call the old unscoped administrative gift/reset/deduction RPCs.
alter function public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid) rename to tipy_class_star_gift_admin;
create function public.tipy_class_star_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text,p_class uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.student_admin_actions; body jsonb; answer jsonb;
begin
 if exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then return public.tipy_class_star_gift_admin(p_actor,p_user,p_request,p_amount,p_message,p_class); end if;
 if not public.tipy_manages_class(p_actor,p_class) or not exists(select 1 from public.class_members m join public.profiles p using(user_id) where m.user_id=p_user and m.class_id=p_class and m.is_active and p.is_active and p.role='student') then raise exception 'Class access denied'; end if;
 if p_request is null or p_amount is null or p_amount<=0 or p_message is null or length(p_message)>240 then raise exception 'Invalid gift'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 body=jsonb_build_object('amount',p_amount,'message',p_message);
 select * into receipt from public.student_admin_actions where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.user_id<>p_user or receipt.action<>'gift' or receipt.payload<>body
   or not exists(select 1 from public.star_rewards where source='teacher' and source_key=p_request::text and class_id=p_class and user_id=p_user) then raise exception 'Request conflict'; end if;
  return receipt.response||jsonb_build_object('stars',(public.tipy_star_total(p_user)->>'stars')::bigint,'classId',p_class);
 end if;
 insert into public.star_rewards(user_id,source,source_key,amount,granted_by,message,class_id,class_awarded_at)
 values(p_user,'teacher',p_request::text,p_amount,p_actor,p_message,p_class,clock_timestamp());
 answer=jsonb_build_object('completed',true,'amount',p_amount,'stars',(public.tipy_star_total(p_user)->>'stars')::bigint,'classId',p_class);
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response) values(p_request,p_actor,p_user,'gift',body,answer);
 return answer;
end $$;

create function public.tipy_teacher_targets(p_actor uuid,p_definition jsonb) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.class_teachers t where t.teacher_id=p_actor and public.tipy_manages_class(p_actor,t.class_id)) and not exists(select 1 from jsonb_array_elements_text(p_definition->'targets'->'classIds') id where not public.tipy_manages_class(p_actor,id::uuid))
 and not exists(select 1 from jsonb_array_elements_text(p_definition->'targets'->'userIds') id where not public.tipy_manages_student(p_actor,id::uuid))
$$;
create function public.tipy_teacher_exam_read(p_actor uuid,p_exam uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.assessments e where e.assessment_id=p_exam and
 (exists(select 1 from public.assessment_class_targets t where t.assessment_id=p_exam and public.tipy_manages_class(p_actor,t.class_id))
 or (e.created_by=p_actor and e.status='draft' and public.tipy_teacher_targets(p_actor,e.definition))
 or exists(select 1 from public.assessment_assignments a where a.assessment_id=p_exam and a.direct and public.tipy_manages_student(p_actor,a.user_id))))
$$;


-- Post archival checks ownership and current assignment atomically.
create function public.tipy_archive_post(p_actor uuid,p_post uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare post public.class_posts;
begin
 select * into post from public.class_posts where post_id=p_post for update;
 if not found or not public.tipy_manages_class(p_actor,post.class_id) or
 (post.author_id<>p_actor and not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active)) then raise exception 'Class access denied'; end if;
 update public.class_posts set archived_at=clock_timestamp() where post_id=p_post;
end $$;

create or replace function public.tipy_publish_post(
 p_admin uuid,p_class uuid,p_title text,p_body text,p_link text,p_files uuid[],p_request uuid
) returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid := coalesce(p_request,gen_random_uuid()); existing public.class_posts%rowtype;
begin
 if not public.tipy_manages_class(p_admin,p_class) then raise exception 'Admin required'; end if;
 perform 1 from public.classes where class_id=p_class and archived_at is null for update;
 if not found then raise exception 'Class unavailable'; end if;
 if p_files is null or cardinality(p_files)>3 or cardinality(p_files)<>(select count(distinct x) from unnest(p_files) x) then raise exception 'Invalid files'; end if;
 select * into existing from public.class_posts where post_id=new_id;
 if found then
  if existing.class_id<>p_class or existing.author_id<>p_admin or existing.title is distinct from p_title
    or existing.body is distinct from p_body or existing.link is distinct from p_link
    or (select coalesce(array_agg(a.attachment_id order by a.attachment_id),'{}'::uuid[]) from public.class_attachments a where a.post_id=new_id)
      is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(p_files) x)
  then raise exception 'Request conflicts with an existing post'; end if;
  return new_id;
 end if;
 if (select count(*) from public.class_attachments a where a.attachment_id=any(p_files) and a.class_id=p_class and a.uploaded_by=p_admin and a.post_id is null and exists(select 1 from storage.objects o where o.bucket_id='tipy-classroom' and o.name=a.storage_path))<>cardinality(p_files) then raise exception 'Files not ready'; end if;
 insert into public.class_posts(post_id,class_id,author_id,title,body,link) values(new_id,p_class,p_admin,p_title,p_body,p_link);
 update public.class_attachments set post_id=new_id where attachment_id=any(p_files);
 return new_id;
end $$;
create or replace function public.tipy_publish_post(p_admin uuid,p_class uuid,p_title text,p_body text,p_link text,p_files uuid[]) returns uuid language sql security invoker set search_path='' as $$ select public.tipy_publish_post(p_admin,p_class,p_title,p_body,p_link,p_files,gen_random_uuid()) $$;
create or replace function public.tipy_class_member_balances(p_actor uuid,p_class uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.tipy_manages_class(p_actor,p_class) then raise exception 'Class access denied'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(b)),'[]') from (
  select p.user_id,p.username,coalesce(sum(r.amount-r.reset_amount),0) stars from public.class_members m
  join public.profiles p using(user_id) left join public.star_rewards r using(user_id)
  where m.class_id=p_class and m.is_active and p.is_active and p.role='student'
  group by p.user_id,p.username
 ) b);
end $$;
create or replace function public.tipy_class_star_board(p_actor uuid,p_class uuid,p_week date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare server_time timestamptz=clock_timestamp(); current_week date=public.tipy_week_start(server_time); week date=coalesce(p_week,current_week); weekly jsonb; closure jsonb; members integer;
begin
 if week>current_week or extract(isodow from week)<>1 then raise exception 'Invalid week'; end if;
 if not exists(select 1 from public.classes c,public.profiles p where c.class_id=p_class and c.archived_at is null and p.user_id=p_actor and p.is_active and (public.tipy_manages_class(p_actor,p_class) or (p.role='student' and exists(select 1 from public.class_members m where m.class_id=p_class and m.user_id=p_actor and m.is_active)))) then raise exception 'Class access denied'; end if;
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
create or replace function public.tipy_assessment(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare manager boolean; is_admin boolean; actor_role text; e public.assessments; assigned public.assessment_assignments; t public.assessment_attempts;
 exam uuid=(p_input->>'assessmentId')::uuid; target uuid; def jsonb; items jsonb; amount integer;
 page integer=greatest(1,coalesce((p_input->>'page')::integer,1)); v_classes uuid[]; v_students uuid[]; fingerprint text; limit_attempts integer; response jsonb;
begin
 select role in ('admin','teacher'),role='admin',role into manager,is_admin,actor_role from public.profiles where user_id=p_actor and is_active;
 if not found then raise exception 'Access denied'; end if;
 if actor_role='teacher' then
  if p_action not in ('list','detail','save','publish','results_v2','attempts','retake','delete') then raise exception 'Class access denied'; end if;
  if coalesce(p_input->>'classId','all')<>'all' and not public.tipy_manages_class(p_actor,(p_input->>'classId')::uuid) then raise exception 'Class access denied'; end if;
  if p_action='delete' and p_input->>'confirm'='accept' and not exists(select 1 from public.assessments where assessment_id=exam) then return jsonb_build_object('deleted',true,'permanent',true); end if;
  if p_action in ('start','checkpoint','submit') then raise exception 'Access denied'; end if;
  if p_action='save' then
   if not public.tipy_teacher_targets(p_actor,p_input->'definition') or exists(select 1 from public.assessments where assessment_id=exam and created_by<>p_actor) then raise exception 'Class access denied'; end if;
  elsif p_action<>'list' then
   if not public.tipy_teacher_exam_read(p_actor,exam) then raise exception 'Class access denied'; end if;
   if p_action in ('publish','delete','retake') and not exists(select 1 from public.assessments owned_exam where owned_exam.assessment_id=exam and owned_exam.created_by=p_actor and public.tipy_teacher_targets(p_actor,owned_exam.definition)) then raise exception 'Class access denied'; end if;
  end if;
  if p_action in ('attempts','retake') and not public.tipy_manages_student(p_actor,(p_input->>'userId')::uuid) then raise exception 'Class access denied'; end if;
 end if;
 p_input=p_input||jsonb_build_object('_teacher',case when actor_role='teacher' then p_actor else null end);
 if p_action in ('save','publish','results','results_v2','retake','delete') and not manager then raise exception 'Admin required'; end if;
 if p_action='delete' and coalesce(p_input->>'confirm','')<>'accept' then raise exception 'Confirmation required'; end if;
 if p_action in ('save','publish','retake','delete','start','checkpoint','submit') then
  perform 1 from public.assessments where assessment_id=exam for update;
 end if;
 if not manager and p_action in ('list','detail','attempts','start','checkpoint','submit') then
  perform public.tipy_sync_assessment_assignments(exam,p_actor);
 elsif manager and p_action in ('results','results_v2','retake') then
  perform public.tipy_sync_assessment_assignments(exam,null);
 end if;
 if actor_role<>'teacher' or exam is not null then perform public.tipy_expire_assessments(exam,case when manager then null else p_actor end); end if;
 if p_action='list' then
  select count(*) into amount from public.assessments x where is_admin or (actor_role='teacher' and public.tipy_teacher_exam_read(p_actor,x.assessment_id)) or (actor_role='student' and public.tipy_assessment_access(p_actor,x.assessment_id));
  page=least(page,greatest(1,ceil(amount/20.0)::integer));
  select coalesce(jsonb_agg(r order by r.created_at desc,r.assessment_id),'[]') into items from (
   select x.assessment_id,x.created_by,(is_admin or (x.created_by=p_actor and public.tipy_teacher_targets(p_actor,x.definition))) as can_manage,x.status,x.version,x.created_at,x.published_at,x.definition->>'title' as title,
   x.definition->>'description' as description,x.definition->'schedule' as schedule,clock_timestamp() as server_now,case when p.role='admin' then 'Thầy Hùng' else coalesce(p.full_name,'Thầy cô') end as teacher,
   case when latest.submitted_at is not null then 'submitted' when latest.attempt_id is not null then 'in_progress' else 'not_started' end as attempt_status
   from public.assessments x left join public.profiles p on p.user_id=x.created_by
   left join lateral(select attempt_id,submitted_at from public.assessment_attempts z where z.assessment_id=x.assessment_id and z.user_id=p_actor order by z.attempt_number desc limit 1) latest on true
   where is_admin or (actor_role='teacher' and public.tipy_teacher_exam_read(p_actor,x.assessment_id)) or (actor_role='student' and public.tipy_assessment_access(p_actor,x.assessment_id))
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
  return jsonb_build_object('assessment',jsonb_build_object('assessment_id',exam,'status',e.status,'definition',
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
create or replace function public.tipy_assessment_results(p_exam uuid,p_input jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 with submitted_parts as materialized (
  select t.user_id,r,position,t.attempt_id,t.attempt_number,t.submitted_at,t.active_seconds,
   row_number() over(partition by t.user_id,r->>'id' order by coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) desc nulls last,t.submitted_at,t.attempt_number,t.attempt_id) rank
  from public.assessment_attempts t cross join lateral jsonb_array_elements(t.results) with ordinality parts(r,position)
  where t.assessment_id=p_exam and t.submitted_at is not null
 ), best as materialized (
  select user_id,jsonb_agg(r||jsonb_build_object('attempt_id',attempt_id,'attempt_number',attempt_number,'submitted_at',submitted_at,'active_seconds',active_seconds) order by position) best_sections
  from submitted_parts where rank=1 group by user_id
 ), students as materialized (
  select p.user_id,p.full_name,p.username,a.allowed_attempts,l.latest,s.latest_submitted,coalesce(b.best_sections,'[]') best_sections,
   case when l.latest is null then 'not_started' when l.latest->>'submitted_at' is null then 'in_progress' else 'submitted' end attempt_status,
   (select coalesce((r->>'score')::numeric,(r->>'accuracy')::numeric) from jsonb_array_elements(b.best_sections) r order by case when r->>'type'='falling' then 0 else 1 end,r->>'id' limit 1) metric
  from public.assessment_assignments a join public.profiles p using(user_id) left join best b using(user_id)
  left join lateral (
   select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results) latest
   from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id order by t.attempt_number desc limit 1
  ) l on true
  left join lateral (
   select jsonb_build_object('attempt_id',t.attempt_id,'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,'active_seconds',t.active_seconds,'results',t.results) latest_submitted
   from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=p.user_id and t.submitted_at is not null order by t.attempt_number desc limit 1
  ) s on true
  where a.assessment_id=p_exam and (p_input->>'_teacher' is null or public.tipy_manages_student((p_input->>'_teacher')::uuid,p.user_id)) and (coalesce(p_input->>'search','')='' or position(lower(p_input->>'search') in lower(p.full_name||' '||p.username))>0)
   and (coalesce(p_input->>'classId','all')='all' or exists(select 1 from public.class_members m join public.classes c using(class_id) where m.user_id=p.user_id and m.is_active and c.archived_at is null and m.class_id::text=p_input->>'classId'))
 ), matches as materialized (
  select * from students where coalesce(p_input->>'status','all')='all' or attempt_status=p_input->>'status'
 ), totals as (select count(*) total,greatest(1,ceil(count(*)/7.0)::integer) pages from matches),
 bounds as (select *,least(greatest(1,coalesce((p_input->>'page')::integer,1)),pages) page from totals),
 numbered as (
  select *,row_number() over(order by
   case when p_input->>'sort'='score_desc' then metric end desc nulls last,
   case when p_input->>'sort'='score_asc' then metric end asc nulls last,
   case when p_input->>'sort'='time_asc' then (best_sections->0->>'active_seconds')::integer end asc nulls last,
   case when p_input->>'sort'='time_desc' then (best_sections->0->>'active_seconds')::integer end desc nulls last,
   case when p_input->>'sort'='submitted_asc' then (best_sections->0->>'submitted_at')::timestamptz end asc nulls last,
   case when p_input->>'sort'='submitted_desc' then (best_sections->0->>'submitted_at')::timestamptz end desc nulls last,
   full_name,user_id) row_number from matches
 ), page_rows as materialized (
  select n.* from numbered n cross join bounds b where row_number>(b.page-1)*7 and row_number<=b.page*7
 )
 select jsonb_build_object('total',bounds.total,'page',bounds.page,'pages',bounds.pages,
 'items',coalesce((select jsonb_agg((to_jsonb(n)-'metric')||jsonb_build_object(
  'attempt_count',(select count(*) from public.assessment_attempts t where t.assessment_id=p_exam and t.user_id=n.user_id),
  'classes',coalesce((select jsonb_agg(jsonb_build_object('class_id',c.class_id,'name',c.name) order by c.name) from public.class_members m join public.classes c using(class_id) where m.user_id=n.user_id and m.is_active and c.archived_at is null and (p_input->>'_teacher' is null or public.tipy_manages_class((p_input->>'_teacher')::uuid,c.class_id))),'[]')
 ) order by row_number) from page_rows n),'[]')) from bounds
$$;
create or replace function public.tipy_notify_assessment(p_exam uuid,p_user uuid default null) returns void
language sql security invoker set search_path='' as $$
 insert into public.student_notifications(user_id,kind,source_key,assessment_id,payload)
 select a.user_id,'assessment',e.assessment_id::text,e.assessment_id,
  jsonb_build_object('title',e.definition->>'title','schedule',e.definition->'schedule','teacher',(select case when role='admin' then 'Thầy Hùng' else full_name end from public.profiles where user_id=e.created_by))
 from public.assessments e join public.assessment_assignments a using(assessment_id)
 join public.profiles p on p.user_id=a.user_id
 where e.assessment_id=p_exam and e.status='published' and p.role='student' and p.is_active
  and (p_user is null or a.user_id=p_user) and public.tipy_assessment_access(a.user_id,e.assessment_id)
 on conflict(user_id,kind,source_key) do nothing
$$;
create or replace function public.tipy_notification_event() returns trigger
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
   values(new.user_id,'star_gift',new.source_key,jsonb_build_object('amount',new.amount,'message',new.message,'teacher',(select case when role='admin' then 'Thầy Hùng' else full_name end from public.profiles where user_id=new.granted_by)))
   on conflict(user_id,kind,source_key) do nothing;
  end if;
 end if;
 return new;
end $$;
do $$ declare f regprocedure; begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('tipy_manages_class','tipy_manages_student','tipy_class_access','tipy_teacher_admin','tipy_teacher_students','tipy_class_star_gift','tipy_teacher_exam_read','tipy_teacher_targets','tipy_archive_post') loop execute format('revoke all on function %s from public,anon,authenticated',f); execute format('grant execute on function %s to service_role',f); end loop; end $$;
create function tipy_private.teacher_student(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role='teacher' and p.is_active and public.tipy_manages_student(p.user_id,p_user))
$$;
revoke all on function tipy_private.teacher_student(uuid) from public,anon;
grant execute on function tipy_private.teacher_student(uuid) to authenticated;
create policy teacher_profiles_read on public.profiles for select to authenticated using(tipy_private.teacher_student(user_id));
create policy teacher_progress_read on public.player_lesson_progress for select to authenticated using(tipy_private.teacher_student(user_id));
create policy teacher_stats_read on public.player_game_stats for select to authenticated using(tipy_private.teacher_student(user_id));
create policy teacher_avatars_read on public.student_avatars for select to authenticated using(tipy_private.teacher_student(user_id));
notify pgrst, 'reload schema';
commit;
