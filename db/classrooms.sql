-- Classroom extension. Run after schema.sql and compact_results.sql.
-- Membership is many-to-many; archive operations preserve recoverable data.
begin;
create table if not exists public.classes (
 class_id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 100),
 created_by uuid not null references public.profiles(user_id),
 created_at timestamptz not null default now(), archived_at timestamptz
);
create table if not exists public.class_members (
 class_id uuid not null references public.classes(class_id),
 user_id uuid not null references public.profiles(user_id),
 joined_at timestamptz not null default now(), is_active boolean not null default true,
 primary key(class_id,user_id)
);
create index if not exists class_members_user on public.class_members(user_id,class_id) where is_active;
create table if not exists public.student_avatars (
 user_id uuid primary key references public.profiles(user_id),
 animal text not null default 'rat' check(animal in ('rat','ox','tiger','cat','dragon','snake','horse','goat','monkey','rooster','dog','pig')),
 accessory text not null default 'none' check(accessory in ('none','star','flower','crown','glasses','book')),
 color text not null default 'sun' check(color in ('sun','mint','sky','rose','lavender'))
);
create table if not exists public.class_posts (
 post_id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(class_id),
 author_id uuid not null references public.profiles(user_id),
 title text not null check(length(trim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=10000),
 link text check(link is null or (length(link)<=2000 and link ~ '^https?://')),
 created_at timestamptz not null default now(), archived_at timestamptz
);
create index if not exists class_posts_feed on public.class_posts(class_id,created_at desc) where archived_at is null;
create table if not exists public.class_attachments (
 attachment_id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(class_id),
 post_id uuid references public.class_posts(post_id),
 uploaded_by uuid not null references public.profiles(user_id),
 storage_path text not null unique,
 name text not null check(length(name) between 1 and 180),
 mime_type text not null, size_bytes integer not null check(size_bytes between 1 and 5242880),
 created_at timestamptz not null default now()
);
create index if not exists class_attachments_post on public.class_attachments(post_id);
-- Private helper avoids recursive RLS on membership lookups.
create or replace function tipy_private.can_read_class(p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.is_active and
 (p.role='admin' or exists(select 1 from public.class_members m join public.classes c using(class_id)
 where m.user_id=p.user_id and m.class_id=p_class and m.is_active and c.archived_at is null)));
$$;
revoke all on function tipy_private.can_read_class(uuid) from public,anon;
grant execute on function tipy_private.can_read_class(uuid) to authenticated;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.student_avatars enable row level security;
alter table public.class_posts enable row level security;
alter table public.class_attachments enable row level security;
revoke all on public.classes,public.class_members,public.student_avatars,public.class_posts,public.class_attachments from public,anon,authenticated;
grant select on public.classes,public.class_members,public.class_posts,public.class_attachments to authenticated;
grant all on public.classes,public.class_members,public.student_avatars,public.class_posts,public.class_attachments to service_role;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='classes' and policyname='classes_read') then
  create policy classes_read on public.classes for select to authenticated using(tipy_private.can_read_class(class_id));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='class_members' and policyname='members_read') then
  create policy members_read on public.class_members for select to authenticated using(tipy_private.can_read_class(class_id));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='class_posts' and policyname='posts_read') then
  create policy posts_read on public.class_posts for select to authenticated using(tipy_private.can_read_class(class_id) and (archived_at is null or tipy_private.is_admin()));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='class_attachments' and policyname='attachments_read') then
  create policy attachments_read on public.class_attachments for select to authenticated using(post_id is not null and exists(select 1 from public.class_posts p where p.post_id=class_attachments.post_id and p.archived_at is null) and tipy_private.can_read_class(class_id));
 end if;
end $policy$;
-- Publish text and uploaded files atomically; only the server role can call this RPC.
create or replace function public.tipy_publish_post(p_admin uuid,p_class uuid,p_title text,p_body text,p_link text,p_files uuid[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_id uuid;
begin
 if not exists(select 1 from public.profiles where user_id=p_admin and role='admin' and is_active) then raise exception 'Admin required'; end if;
 perform 1 from public.classes where class_id=p_class and archived_at is null for update;
 if not found then raise exception 'Class unavailable'; end if;
 if cardinality(p_files)>3 or cardinality(p_files)<>(select count(distinct x) from unnest(p_files) x) then raise exception 'Invalid files'; end if;
 if (select count(*) from public.class_attachments a where a.attachment_id=any(p_files) and a.class_id=p_class and a.uploaded_by=p_admin and a.post_id is null and exists(select 1 from storage.objects o where o.bucket_id='tipy-classroom' and o.name=a.storage_path))<>cardinality(p_files) then raise exception 'Files not ready'; end if;
 insert into public.class_posts(class_id,author_id,title,body,link) values(p_class,p_admin,p_title,p_body,p_link) returning post_id into new_id;
 update public.class_attachments set post_id=new_id where attachment_id=any(p_files);
 return new_id;
end $$;
revoke all on function public.tipy_publish_post(uuid,uuid,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.tipy_publish_post(uuid,uuid,text,text,text,uuid[]) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tipy-classroom','tipy-classroom',false,5242880,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No direct browser grants/policies on storage.objects: server-issued short-lived
-- download links follow membership checks. Signed uploads are admin-only.
commit;
