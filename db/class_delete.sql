-- Inspected live schema: no comments table; class foreign keys use NO ACTION.
begin;
create table public.class_deletions (
 class_id uuid primary key, name text not null, paths text[] not null default '{}',
 deleted_at timestamptz not null default now()
);
alter table public.class_deletions enable row level security;
revoke all on public.class_deletions from public, anon, authenticated;
grant all on public.class_deletions to service_role;

create function public.tipy_delete_class(p_actor uuid, p_class uuid, p_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.classes; job public.class_deletions; files text[];
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active)
 then raise exception 'Chỉ quản trị viên được xóa lớp.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class::text, 0));
 select * into job from public.class_deletions where class_id=p_class for update;
 if not found then
  select * into c from public.classes where class_id=p_class for update;
  if not found then raise exception 'Không tìm thấy lớp.'; end if;
  if c.archived_at is null then raise exception 'Hãy lưu trữ lớp trước khi xóa vĩnh viễn.'; end if;
  if c.name is distinct from p_name then raise exception 'Tên xác nhận chưa đúng.'; end if;
  -- Refuse inconsistent cross-class references rather than delete another class's rows.
  if exists(select 1 from public.class_attachments a join public.class_posts p using(post_id)
   where (a.class_id=p_class) <> (p.class_id=p_class))
  then raise exception 'Có tệp liên kết chéo lớp; cần kiểm tra trước khi xóa.'; end if;
  select coalesce(array_agg(distinct path),'{}') into files from (
   select storage_path path from public.class_attachments where class_id=p_class
   union select storage_path||'.webp' from public.class_attachments
    where class_id=p_class and storage_path like '%.previewable.%'
  ) f where split_part(path,'/',1)=p_class::text;
  insert into public.class_deletions(class_id,name,paths) values(p_class,c.name,files);
  delete from public.class_attachments where class_id=p_class;
  delete from public.class_posts where class_id=p_class;
  delete from public.class_members where class_id=p_class;
  delete from public.classes where class_id=p_class;
  select * into job from public.class_deletions where class_id=p_class;
 end if;
 if job.name is distinct from p_name then raise exception 'Tên xác nhận chưa đúng.'; end if;
 -- Preserve files still referenced by attachments or links/text in another class.
 update public.class_deletions d set paths=coalesce((select array_agg(path) from unnest(d.paths) path
  where not exists(select 1 from public.class_attachments a
   where a.storage_path=path or a.storage_path||'.webp'=path)
  and not exists(select 1 from public.class_posts p where strpos(coalesce(p.link,'')||p.body,path)>0)
 ),'{}') where class_id=p_class returning * into job;
 return jsonb_build_object('paths',job.paths,'classId',p_class);
end $$;

create function public.tipy_ack_class_files(p_actor uuid,p_class uuid,p_paths text[])
returns integer language plpgsql security invoker set search_path='' as $$
declare remaining integer;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active)
 then raise exception 'Chỉ quản trị viên được dọn tệp.'; end if;
 update public.class_deletions d set paths=array(select p from unnest(d.paths) p where not(p=any(p_paths)))
 where class_id=p_class returning cardinality(paths) into remaining;
 return remaining;
end $$;
revoke all on function public.tipy_delete_class(uuid,uuid,text),public.tipy_ack_class_files(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.tipy_delete_class(uuid,uuid,text),public.tipy_ack_class_files(uuid,uuid,text[]) to service_role;
commit;
