-- Give the STT pipeline rally context: prior transcripts prime Whisper's
-- vocabulary and let the gloss model read the conversation so far.
-- Also upgrade the default gloss model from Haiku to Sonnet.

-- 1. stt_queue now returns prior done transcripts for the same session.
create or replace function public.stt_queue(sid uuid, retry boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.pp_sessions;
  c public.scenario_cards;
  items jsonb;
  prior jsonb;
  routing jsonb := public.game_setting('stt_routing');
begin
  if not (public.is_staff() or coalesce(auth.role(), '') = 'service_role') then raise exception 'staff only'; end if;
  select * into s from public.pp_sessions where id = sid;
  if not found then raise exception 'no such rally'; end if;
  select * into c from public.scenario_cards where id = s.card_id;

  insert into public.stt_drafts (turn_id, session_id, language)
    select lt.id, sid, s.language from public.pp_latest_turns(sid) lt
  on conflict (turn_id) do update
    set status = case when retry and public.stt_drafts.status in ('failed','skipped') then 'pending' else public.stt_drafts.status end,
        updated_at = now();

  update public.stt_drafts set status = 'pending'
  where session_id = sid and status = 'running' and updated_at < now() - interval '5 minutes';

  -- Pending items to process
  select coalesce(jsonb_agg(jsonb_build_object(
    'turn_id', d.turn_id, 'audio_path', t.audio_path, 'language', d.language, 'seconds', t.seconds,
    'persona', case when t.speaker = s.speaker_a then c.persona_a else c.persona_b end
  ) order by t.turn_no), '[]'::jsonb)
  into items
  from public.stt_drafts d
  join public.pp_turns t on t.id = d.turn_id
  where d.session_id = sid and d.status = 'pending';

  update public.stt_drafts set status = 'running', updated_at = now()
  where session_id = sid and status = 'pending';

  -- Already-done transcripts for context
  select coalesce(jsonb_agg(jsonb_build_object(
    'turn_no', t.turn_no,
    'persona', case when t.speaker = s.speaker_a then c.persona_a else c.persona_b end,
    'text', d.text,
    'gloss', d.gloss
  ) order by t.turn_no), '[]'::jsonb)
  into prior
  from public.stt_drafts d
  join public.pp_turns t on t.id = d.turn_id
  where d.session_id = sid and d.status = 'done' and d.text is not null and length(d.text) > 0;

  return jsonb_build_object(
    'language', s.language,
    'route', coalesce(routing -> s.language, '{"engine":"none"}'::jsonb),
    'gloss', public.game_setting('gloss_model'),
    'card', jsonb_build_object('title', c.title, 'situation', c.situation, 'english_note', c.english_note),
    'items', items,
    'prior', prior
  );
end $function$;

-- 2. stt_turn_context now returns prior turns for the re-gloss path.
create or replace function public.stt_turn_context(tid uuid)
 returns jsonb
 language sql
 security definer
 stable
 set search_path to 'public'
as $function$
  select case when public.is_staff() then jsonb_build_object(
    'language', s.language, 'gloss', public.game_setting('gloss_model'),
    'card', jsonb_build_object('title', c.title, 'situation', c.situation, 'english_note', c.english_note),
    'persona', case when t.speaker = s.speaker_a then c.persona_a else c.persona_b end,
    'prior', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'turn_no', pt.turn_no,
        'persona', case when pt.speaker = s.speaker_a then c.persona_a else c.persona_b end,
        'text', pd.text,
        'gloss', pd.gloss
      ) order by pt.turn_no), '[]'::jsonb)
      from public.stt_drafts pd
      join public.pp_turns pt on pt.id = pd.turn_id
      where pd.session_id = t.session_id and pd.status = 'done'
        and pd.text is not null and length(pd.text) > 0
        and pt.turn_no < t.turn_no
    ))
  else null end
  from public.pp_turns t
  join public.pp_sessions s on s.id = t.session_id
  join public.scenario_cards c on c.id = s.card_id
  where t.id = tid
$function$;

-- 3. Upgrade default gloss model to Sonnet.
update public.game_config
set value = '{"engine":"anthropic","model":"claude-sonnet-4-20250514"}'::jsonb
where key = 'gloss_model';
