-- Linguist earnings: a linguist is paid per hour of audio they verify or audit.
-- The data already lives in verifications (verified_by, verified_seconds) and
-- audits (auditor); this RPC reads it and calculates pay at the stored rate.

-- 1. Store the linguist rate alongside other game settings.
insert into public.game_config (key, value)
values ('linguist_rate_usd', '30'::jsonb)
on conflict (key) do nothing;

-- 2. RPC: my_linguist_earnings — returns the calling linguist's work and pay.
create or replace function public.my_linguist_earnings()
 returns jsonb
 language plpgsql
 security definer
 stable
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  rate numeric;
  v_lines jsonb;
  a_lines jsonb;
  v_secs numeric;
  a_secs numeric;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;

  rate := coalesce((public.game_setting('linguist_rate_usd'))::numeric, 30);

  -- Sessions this linguist verified
  select coalesce(jsonb_agg(jsonb_build_object(
    'session_id', v.session_id, 'title', c.title, 'language', s.language,
    'verified_seconds', v.verified_seconds, 'at', v.verified_at,
    'amount_usd', round(v.verified_seconds / 3600.0 * rate, 2), 'kind', 'verify'
  ) order by v.verified_at desc), '[]'::jsonb),
  coalesce(sum(v.verified_seconds), 0)
  into v_lines, v_secs
  from public.verifications v
  join public.pp_sessions s on s.id = v.session_id
  join public.scenario_cards c on c.id = s.card_id
  where v.verified_by = me and v.status = 'verified';

  -- Sessions this linguist audited (duration from the verification row)
  select coalesce(jsonb_agg(jsonb_build_object(
    'session_id', a.session_id, 'title', c.title, 'language', s.language,
    'verified_seconds', v.verified_seconds, 'at', a.created_at,
    'outcome', a.outcome,
    'amount_usd', round(v.verified_seconds / 3600.0 * rate, 2), 'kind', 'audit'
  ) order by a.created_at desc), '[]'::jsonb),
  coalesce(sum(v.verified_seconds), 0)
  into a_lines, a_secs
  from public.audits a
  join public.verifications v on v.session_id = a.session_id
  join public.pp_sessions s on s.id = a.session_id
  join public.scenario_cards c on c.id = s.card_id
  where a.auditor = me;

  return jsonb_build_object(
    'rate_usd', rate,
    'total_verified_seconds', v_secs,
    'total_audited_seconds', a_secs,
    'total_seconds', v_secs + a_secs,
    'total_hours', round((v_secs + a_secs) / 3600.0, 2),
    'total_earned_usd', round((v_secs + a_secs) / 3600.0 * rate, 2),
    'verified_count', jsonb_array_length(v_lines),
    'audited_count', jsonb_array_length(a_lines),
    'verified', v_lines,
    'audited', a_lines
  );
end $function$;
