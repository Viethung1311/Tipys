-- Apply after student_star_balance_reset. No award ceiling or lesson progress is deleted.
begin;
alter table public.student_admin_actions drop constraint student_admin_actions_action_check;
alter table public.student_admin_actions add constraint student_admin_actions_action_check check(action in ('reset','gift','stars_reset','deduct'));

create function public.tipy_star_class_scope(p_actor uuid,p_user uuid,p_class uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if p_class is not null then
  perform 1 from public.classes where class_id=p_class and archived_at is null for share;
  if not found then raise exception 'Class access denied'; end if;
  perform 1 from public.class_members where class_id=p_class and user_id=p_user and is_active for share;
  if not found then raise exception 'Class access denied'; end if;
 end if;
end $$;

create function public.tipy_deduct_stars(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text default '',p_class uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.student_admin_actions; body jsonb; answer jsonb; balance bigint; remaining integer; part integer; reward record;
begin
 perform public.tipy_star_class_scope(p_actor,p_user,p_class);
 if not exists(select 1 from public.profiles where user_id=p_user and role='student' and is_active) then raise exception 'Chỉ trừ sao tài khoản học sinh đang mở.'; end if;
 if p_request is null or p_amount is null or p_amount<=0 or p_message is null or length(p_message)>240 then raise exception 'Số sao hoặc lý do chưa hợp lệ.'; end if;
 body=jsonb_build_object('amount',p_amount,'message',p_message,'classId',p_class);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('star-balance:'||p_user::text,0));
 select * into receipt from public.student_admin_actions where request_id=p_request;
 if found then
  if receipt.actor_id is distinct from p_actor or receipt.user_id<>p_user or receipt.action<>'deduct' or receipt.payload<>body then raise exception 'Mã yêu cầu đã dùng cho thao tác khác.'; end if;
  return receipt.response||jsonb_build_object('stars',(public.tipy_star_total(p_user)->>'stars')::bigint);
 end if;
 balance=(public.tipy_star_total(p_user)->>'stars')::bigint;
 if p_amount>balance then raise exception 'Số sao cần trừ vượt số sao hiện tại (%).',balance; end if;
 remaining=p_amount;
 for reward in select source,source_key,amount-reset_amount available from public.star_rewards where user_id=p_user and amount>reset_amount order by created_at,source,source_key for update loop
  part=least(remaining,reward.available);
  update public.star_rewards set reset_amount=reset_amount+part where user_id=p_user and source=reward.source and source_key=reward.source_key;
  remaining=remaining-part;
  exit when remaining=0;
 end loop;
 answer=jsonb_build_object('completed',true,'amount',p_amount,'beforeStars',balance,'afterStars',balance-p_amount,'stars',balance-p_amount,'deductedAt',clock_timestamp());
 insert into public.student_admin_actions(request_id,actor_id,user_id,action,payload,response) values(p_request,p_actor,p_user,'deduct',body,answer);
 return answer;
end $$;

create function public.tipy_class_star_gift(p_actor uuid,p_user uuid,p_request uuid,p_amount integer,p_message text,p_class uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform public.tipy_star_class_scope(p_actor,p_user,p_class);
 return public.tipy_teacher_gift(p_actor,p_user,p_request,p_amount,p_message);
end $$;

create function public.tipy_class_member_balances(p_actor uuid,p_class uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and is_active) or not exists(select 1 from public.classes where class_id=p_class and archived_at is null) then raise exception 'Class access denied'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(b)),'[]') from (
  select p.user_id,p.username,coalesce(sum(r.amount-r.reset_amount),0) stars from public.class_members m
  join public.profiles p using(user_id) left join public.star_rewards r using(user_id)
  where m.class_id=p_class and m.is_active and p.is_active and p.role='student'
  group by p.user_id,p.username
 ) b);
end $$;
revoke all on function public.tipy_star_class_scope(uuid,uuid,uuid),public.tipy_deduct_stars(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_member_balances(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tipy_star_class_scope(uuid,uuid,uuid),public.tipy_deduct_stars(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_star_gift(uuid,uuid,uuid,integer,text,uuid),public.tipy_class_member_balances(uuid,uuid) to service_role;
commit;
