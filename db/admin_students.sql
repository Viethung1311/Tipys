begin;
-- Auth deletion is one transaction: personal rows follow the profile; shared class content still restricts deletion.
alter table public.profiles drop constraint profiles_user_id_fkey;
alter table public.profiles add constraint profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
do $$ declare t text; begin
  foreach t in array array['play_history','player_game_stats','active_plays','class_members','student_avatars','player_lesson_progress'] loop
    execute format('alter table public.%I drop constraint %I',t,t||'_user_id_fkey');
    execute format('alter table public.%I add constraint %I foreign key(user_id) references public.profiles(user_id) on delete cascade',t,t||'_user_id_fkey');
  end loop;
end $$;

-- Cover inactive memberships too when checking/deleting an account.
create index if not exists class_members_account on public.class_members(user_id);
create index if not exists classes_owner on public.classes(created_by);
create index if not exists class_posts_owner on public.class_posts(author_id);
create index if not exists class_attachments_owner on public.class_attachments(uploaded_by);

create or replace function public.tipy_students_page(p_page integer default 1,p_search text default '',p_class text default 'all',p_sort text default 'desc',p_roster uuid default null,p_membership text default 'all')
returns jsonb language sql stable security invoker set search_path = public as $$
with stats as (
 select user_id,sum(total_active_seconds) seconds,sum(total_plays) plays from player_game_stats group by user_id
), all_students as (
 select p.user_id,p.username,p.full_name,p.is_active,coalesce(s.seconds,0) total_active_seconds,coalesce(s.plays,0) total_plays,
 coalesce((select jsonb_agg(jsonb_build_object('class_id',c.class_id,'name',c.name) order by c.name,c.class_id) from class_members m join classes c using(class_id) where m.user_id=p.user_id and m.is_active and c.archived_at is null),'[]'::jsonb) classes,
 exists(select 1 from class_members m where m.user_id=p.user_id and m.class_id=p_roster and m.is_active) joined
 from profiles p left join stats s using(user_id) where p.role='student'
), filtered as (
 select * from all_students s where (p_search='' or strpos(lower(s.full_name||' '||s.username),lower(p_search))>0)
 and (p_class='all' or (p_class='none' and jsonb_array_length(s.classes)=0) or exists(select 1 from jsonb_array_elements(s.classes) c where c->>'class_id'=p_class))
 and (p_membership='all' or (p_membership='members' and joined) or (p_membership='candidates' and not joined))
), bounds as (
 select count(*) total,greatest(1,ceil(count(*)/7.0)::integer) pages from filtered
), page_rows as (
 select * from filtered order by case when p_sort='asc' then total_active_seconds end asc,case when p_sort='desc' then total_active_seconds end desc,full_name,user_id
 limit 7 offset ((select least(greatest(p_page,1),pages) from bounds)-1)*7
)
select jsonb_build_object('students',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),'total',b.total,'pages',b.pages,'page',least(greatest(p_page,1),b.pages),
 'memberTotal',(select count(*) from all_students where joined),
 'summary',(select jsonb_build_object('students',count(*),'seconds',coalesce(sum(total_active_seconds),0),'plays',coalesce(sum(total_plays),0)) from all_students)) from bounds b;
$$;
revoke all on function public.tipy_students_page(integer,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.tipy_students_page(integer,text,text,text,uuid,text) to service_role;
commit;
