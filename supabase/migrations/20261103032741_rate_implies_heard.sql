-- Keep the invariant the heard_at backfill asserted: a rated take was heard.
--
-- Rating is enforced before a partner may reply, and nobody can rate a take
-- they have not listened to, so rated_at has always implied hearing. The
-- backfill set heard_at = rated_at for every turn that already existed, but
-- pp_rate_turn did not maintain it, so a take rated from now on would come out
-- rated-but-never-heard and heard_at would stop being a fact about the world.
--
-- coalesce, not now(): a take heard at 10:02 and rated at 10:09 keeps 10:02.
-- heard_at still only ever moves from null to a time, never backwards.
--
-- Everything else in pp_rate_turn is untouched, line for line.

create or replace function public.pp_rate_turn(tid uuid, tone integer, prompt_adherence integer, mood integer, clarity integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  t public.pp_turns;
  s public.pp_sessions;
  agg numeric;
  redo_below numeric := coalesce((public.game_setting('redo_below'))::numeric, 4.0);
  max_att int := coalesce((public.game_setting('max_redo_attempts'))::int, 3);
  min_secs numeric := coalesce((public.game_setting('min_rally_seconds'))::numeric, 40);
  window_h int := coalesce((public.game_setting('reply_window_hours'))::int, 24);
  all_rated boolean;
  total numeric;
begin
  perform public.pp_heartbeat();
  select * into t from public.pp_turns where id = tid for update;
  if not found then raise exception 'no such turn'; end if;
  select * into s from public.pp_sessions where id = t.session_id and (speaker_a = me or speaker_b = me) for update;
  if not found or t.speaker = me then raise exception 'you cannot rate this turn'; end if;
  if t.status <> 'recorded' then raise exception 'turn already rated'; end if;
  if s.status not in ('waiting','active') then raise exception 'rally is closed'; end if;
  insert into public.pp_ratings (turn_id, rater, tone, prompt_adherence, mood, clarity) values (tid, me, tone, prompt_adherence, mood, clarity);
  agg := (tone + prompt_adherence + mood + clarity) / 4.0;
  if agg < redo_below and t.attempt < max_att then
    update public.pp_turns set status = 'redo', rated_at = now(), heard_at = coalesce(heard_at, now()) where id = tid;
    update public.pp_sessions set next_speaker = t.speaker, due_at = now() + make_interval(hours => window_h), updated_at = now() where id = s.id;
    return jsonb_build_object('ok', true, 'aggregate', agg, 'redo', true);
  end if;
  update public.pp_turns set status = 'rated', rated_at = now(), heard_at = coalesce(heard_at, now()) where id = tid;
  select s.turn_count >= s.turns_target and not exists (
    select 1 from public.pp_turns u where u.session_id = s.id and u.status = 'recorded'
      and u.attempt = (select max(attempt) from public.pp_turns v where v.session_id = s.id and v.turn_no = u.turn_no)
  ) into all_rated;
  if all_rated then
    select coalesce(sum(u.seconds), 0) into total from public.pp_turns u where u.session_id = s.id
      and u.attempt = (select max(attempt) from public.pp_turns v where v.session_id = s.id and v.turn_no = u.turn_no);
    update public.pp_sessions set status = 'complete', completed_at = now(), next_speaker = null, due_at = null, total_seconds = total,
      flags = case when total < min_secs then array_append(flags, 'short_rally') else flags end, updated_at = now() where id = s.id;
  else
    update public.pp_sessions set next_speaker = me, due_at = now() + make_interval(hours => window_h), updated_at = now() where id = s.id;
  end if;
  return jsonb_build_object('ok', true, 'aggregate', agg, 'redo', false, 'complete', all_rated, 'flagged_short', (all_rated and total < min_secs));
end
$function$;

-- The two turns rated between the first migration and this one.
update public.pp_turns
   set heard_at = rated_at
 where rated_at is not null and heard_at is null;
