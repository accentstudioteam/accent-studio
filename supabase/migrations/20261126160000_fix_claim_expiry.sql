-- Fix: refresh the claim timer every time the editor saves a turn.
-- Without this, a claim expires after 30 minutes even if the editor
-- is actively working, because vq_save_turn never touched claimed_at.

create or replace function public.vq_save_turn(
  tid uuid,
  verified_text text default null,
  english_gloss text default null,
  emotion text default null,
  confidence numeric default null,
  issues text[] default '{}',
  verified_seconds numeric default null,
  rating_check text default null,
  alignments jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  t public.pp_turns;
  v public.verifications;
  a jsonb := coalesce(vq_save_turn.alignments, '[]'::jsonb);
  el jsonb;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into t from public.pp_turns where id = tid;
  if not found then raise exception 'no such turn'; end if;
  select * into v from public.verifications where session_id = t.session_id;
  if not found or v.status <> 'in_progress' or (v.claimed_by <> me and not public.is_admin()) then
    raise exception 'claim the rally first';
  end if;
  if verified_seconds is not null and (verified_seconds < 0 or verified_seconds > t.seconds + 1) then
    raise exception 'verified seconds cannot exceed the recording';
  end if;
  if jsonb_typeof(a) <> 'array' then raise exception 'alignments must be a list'; end if;
  for el in select * from jsonb_array_elements(a) loop
    if jsonb_typeof(el) <> 'object' or not (el->>'type') = any (array['direct','lexical','aspect_shift','serial_verb','copula_substitution','null_particle','null_source','numeric_expansion','emphatic_particle','honorific_addition','discourse_marker']) then
      raise exception 'unknown alignment type %', el->>'type';
    end if;
    if (el->>'confidence')::numeric not between 0 and 1 then raise exception 'alignment confidence must be 0 to 1'; end if;
    if coalesce(jsonb_typeof(el->'src'), 'null') <> 'object' and coalesce(jsonb_typeof(el->'tgt'), 'null') <> 'object' then
      raise exception 'an alignment needs a span on at least one side';
    end if;
  end loop;

  -- Refresh the claim timer so active work keeps the hold alive
  update public.verifications set claimed_at = now() where session_id = t.session_id;

  insert into public.turn_verifications as tv (turn_id, session_id, verified_text, english_gloss, emotion_label, confidence, issues, verified_seconds, rating_check, editor, updated_at, alignments, aligned_at, aligner)
  values (tid, t.session_id, nullif(btrim(verified_text), ''), nullif(btrim(english_gloss), ''), nullif(emotion, ''), confidence, coalesce(issues, '{}'), verified_seconds, nullif(rating_check, ''), me, now(),
          a, case when jsonb_array_length(a) > 0 then now() else null end, case when jsonb_array_length(a) > 0 then public.editor_id_for(me) else null end)
  on conflict (turn_id) do update set verified_text = excluded.verified_text, english_gloss = excluded.english_gloss, emotion_label = excluded.emotion_label,
    confidence = excluded.confidence, issues = excluded.issues, verified_seconds = excluded.verified_seconds, rating_check = excluded.rating_check, editor = me, updated_at = now(),
    alignments = excluded.alignments, aligned_at = excluded.aligned_at, aligner = excluded.aligner;
  return jsonb_build_object('ok', true, 'links', jsonb_array_length(a));
end
$function$;
