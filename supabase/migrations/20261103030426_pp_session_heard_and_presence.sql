-- Rung three: expose both over the one call the rally screen already makes.
--
-- This is pp_session as it stood, plus four fields and one line. Everything it
-- already returned — my_alias, partner_alias, my_avatar, partner_avatar, the
-- turn shape, my_turn / owe_rating / rate_turn_id / redo and the rest — is
-- unchanged, field for field.
--
--   turns[].heard_at             when the partner played that take (null = not yet)
--   partner_recording            is the partner holding the mic right this second
--   partner_last_active_seconds  how long ago the partner was last seen, in seconds
--   recording_ttl_seconds        the presence TTL, so the client can size its poll
--
-- The new line is `perform public.pp_heartbeat()`. Without it, opening and
-- sitting in a rally does not count as being active, and "in the rally" could
-- never be true for the partner — the presence line would be a lie by
-- omission. pp_my_sessions, pp_submit_turn and pp_rate_turn already heartbeat.
--
-- partner_last_active_seconds is relative, not an absolute timestamp: the
-- screen needs "how long ago", and a duration is the least that answers it.
-- The partner stays anonymous — alias and avatar only, never a real name — and
-- this is only ever computed for the one person the caller is paired with, in
-- a rally the caller is in. pp_browse already surfaces the same freshness for
-- rallies you may join, so this is not a new class of fact.

create or replace function public.pp_session(sid uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  s public.pp_sessions;
  c public.scenario_cards;
  my_speaker text;
  my_alias text;
  my_avatar text;
  partner uuid;
  partner_alias text;
  partner_avatar text;
  partner_seen timestamptz;
  partner_until timestamptz;
  latest_partner_turn public.pp_turns;
  owe_rating boolean := false;
  redo_turn public.pp_turns;
  next_no int;
  next_attempt int := 1;
  turns jsonb;
begin
  perform public.pp_heartbeat();
  perform public.pp_sweep();
  select * into s from public.pp_sessions where id = sid and (speaker_a = me or speaker_b = me);
  if not found then raise exception 'not your rally'; end if;
  select * into c from public.scenario_cards where id = s.card_id;
  select ct.speaker_id, ct.alias, ct.avatar into my_speaker, my_alias, my_avatar from public.contributors ct where ct.id = me;
  partner := case when s.speaker_a = me then s.speaker_b else s.speaker_a end;
  partner_until := case when s.speaker_a = me then s.b_recording_until else s.a_recording_until end;
  if partner is not null then
    select ct.alias, ct.avatar, ct.last_active_at into partner_alias, partner_avatar, partner_seen from public.contributors ct where ct.id = partner;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'turn_id', t.id, 'turn_no', t.turn_no, 'attempt', t.attempt, 'mine', t.speaker = me,
      'audio_path', t.audio_path, 'seconds', t.seconds, 'status', t.status, 'created_at', t.created_at,
      'heard_at', t.heard_at,
      'rating', (select jsonb_build_object('tone', r.tone, 'prompt_adherence', r.prompt_adherence, 'mood', r.mood, 'clarity', r.clarity, 'aggregate', r.aggregate) from public.pp_ratings r where r.turn_id = t.id limit 1)
    ) order by t.turn_no, t.attempt), '[]'::jsonb) into turns
  from public.pp_turns t where t.session_id = sid
    and t.attempt = (select max(attempt) from public.pp_turns u where u.session_id = sid and u.turn_no = t.turn_no);
  select t.* into latest_partner_turn from public.pp_turns t where t.session_id = sid and t.speaker <> me and t.status = 'recorded'
    and t.attempt = (select max(attempt) from public.pp_turns u where u.session_id = sid and u.turn_no = t.turn_no)
    order by t.turn_no desc limit 1;
  owe_rating := found and s.status in ('waiting','active') and not exists (select 1 from public.pp_ratings r where r.turn_id = latest_partner_turn.id and r.rater = me);
  select t.* into redo_turn from public.pp_turns t where t.session_id = sid and t.speaker = me and t.status = 'redo'
    and t.attempt = (select max(attempt) from public.pp_turns u where u.session_id = sid and u.turn_no = t.turn_no) order by t.turn_no desc limit 1;
  if found then next_no := redo_turn.turn_no; next_attempt := redo_turn.attempt + 1; else next_no := s.turn_count + 1; end if;
  return jsonb_build_object(
    'session_id', s.id, 'status', s.status, 'language', s.language, 'turn_count', s.turn_count, 'turns_target', s.turns_target,
    'card', jsonb_build_object('title', c.title, 'situation', c.situation, 'persona', case when s.speaker_a = me then c.persona_a else c.persona_b end, 'partner_persona', case when s.speaker_a = me then c.persona_b else c.persona_a end, 'audio_path', c.audio_path, 'domain', c.domain),
    'my_speaker_id', my_speaker,
    'my_alias', my_alias,
    'my_avatar', my_avatar,
    'partner_alias', partner_alias,
    'partner_avatar', partner_avatar,
    'i_am', case when s.speaker_a = me then 'a' else 'b' end,
    'has_partner', s.speaker_b is not null,
    'my_turn', (s.next_speaker = me and s.status in ('waiting','active') and (s.speaker_b is not null or s.turn_count = 0) and not owe_rating),
    'owe_rating', owe_rating,
    'rate_turn_id', case when owe_rating then latest_partner_turn.id else null end,
    'redo', redo_turn.id is not null,
    'next_turn_no', next_no, 'next_attempt', next_attempt,
    'max_turn_seconds', coalesce((public.game_setting('max_turn_seconds'))::int, 30),
    'due_at', s.due_at,
    'i_owe', (s.next_speaker = me),
    'abandoned_reason', s.abandoned_reason,
    'flags', to_jsonb(s.flags),
    'partner_recording', (partner is not null and s.status in ('waiting','active') and partner_until is not null and partner_until > now()),
    'partner_last_active_seconds', case when partner_seen is null then null else greatest(0, floor(extract(epoch from (now() - partner_seen)))::int) end,
    'recording_ttl_seconds', public.pp_recording_ttl_seconds(),
    'turns', turns
  );
end
$function$;
