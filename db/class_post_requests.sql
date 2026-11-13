-- Apply after classrooms.sql. Six-argument RPC remains compatible with older deployments.
begin;
create or replace function public.tipy_publish_post(
 p_admin uuid,p_class uuid,p_title text,p_body text,p_link text,p_files uuid[],p_request uuid
) returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid := coalesce(p_request,gen_random_uuid()); existing public.class_posts%rowtype;
begin
 if not exists(select 1 from public.profiles where user_id=p_admin and role='admin' and is_active) then raise exception 'Admin required'; end if;
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
revoke all on function public.tipy_publish_post(uuid,uuid,text,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.tipy_publish_post(uuid,uuid,text,text,text,uuid[],uuid) to service_role;
commit;
