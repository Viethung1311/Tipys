-- Keep existing rewards unchanged; future valid completions can earn only the missing stars.
begin;
alter table public.player_lesson_progress
 add column last_award_delta smallint not null default 0 check(last_award_delta between 0 and 3);
-- Preserve the response for a retried completion from before this migration.
update public.player_lesson_progress p set last_award_delta=r.amount
 from public.star_rewards r where r.user_id=p.user_id and r.source='lesson'
 and r.source_key=p.game_id::text||':'||p.lesson_id and not r.legacy and r.play_id=p.last_play_id;

create or replace function public.tipy_finish_quest_lesson(p_user uuid,p_play uuid,p_lesson text,p_values jsonb,p_grade jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare game uuid; saved jsonb; reward public.star_rewards; previous public.player_lesson_progress;
 old_amount integer=0; extra integer=0; earned integer;
begin
 select a.game_id into game from public.active_plays a join public.games g using(game_id)
 where a.play_id=p_play and a.user_id=p_user and g.game_code='keyboard_quest';
 if not found then return jsonb_build_object('superseded',true); end if;
 -- Same lock as begin/save/reset: another tab cannot read an outdated award amount.
 perform 1 from public.player_game_stats where user_id=p_user and game_id=game for update;
 select * into previous from public.player_lesson_progress where user_id=p_user and game_id=game and lesson_id=p_lesson;
 if found and previous.last_play_id=p_play then
  return to_jsonb(previous)||jsonb_build_object('award_this_play',previous.last_award_delta);
 end if;
 if (p_grade->>'completed')::boolean then
  earned=(p_grade->>'stars')::integer;
  if earned is null or earned not between 1 and 3 then raise exception 'Invalid stars'; end if;
 end if;
 saved=public.tipy_finish_quest_without_rewards(p_user,p_play,p_lesson,p_values,p_grade);
 if saved->>'superseded'='true' then return saved; end if;
 select * into reward from public.star_rewards where user_id=p_user and source='lesson' and source_key=game::text||':'||p_lesson;
 old_amount=coalesce(reward.amount,0);
 if (p_grade->>'completed')::boolean then
  extra=greatest(0,earned-old_amount);
  -- Legacy best stars are not evidence of an award. Only this new validated grade earns stars.
  insert into public.star_rewards(user_id,source,source_key,amount,play_id)
  values(p_user,'lesson',game::text||':'||p_lesson,earned,p_play)
  on conflict(user_id,source,source_key) do update set
   amount=greatest(star_rewards.amount,excluded.amount),
   play_id=case when excluded.amount>star_rewards.amount then p_play else star_rewards.play_id end,
   legacy=false
  returning * into reward;
 end if;
 update public.player_lesson_progress set awarded_stars=coalesce(reward.amount,0),award_play_id=reward.play_id,
  reward_status=case when reward.legacy then 'legacy' when reward.amount>0 then 'awarded' else 'pending' end,
  last_award_delta=extra
 where user_id=p_user and game_id=game and lesson_id=p_lesson returning to_jsonb(player_lesson_progress) into saved;
 return saved||jsonb_build_object('award_this_play',extra);
end $$;
revoke all on function public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.tipy_finish_quest_lesson(uuid,uuid,text,jsonb,jsonb) to service_role;
commit;
