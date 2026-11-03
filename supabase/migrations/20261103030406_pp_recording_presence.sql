-- Presence, rung two: "your partner is recording right now."
--
-- Kept on pp_sessions rather than in a new table on purpose. Recording
-- presence only means anything *inside one rally*, the two seats are already
-- modelled as speaker_a / speaker_b, and pp_sessions already has exactly the
-- read policy this needs (participants and admins). So no new table, no new
-- policy, nothing widened.
--
-- The flag is stored as the instant it STOPS being true, not as a boolean.
-- That is the time-to-live: a crashed tab, a killed app or a lost network can
-- never leave it stuck on, because nothing has to arrive to clear it — the
-- value simply stops being in the future. No sweeper, no cron.

alter table public.pp_sessions
  add column if not exists a_recording_until timestamptz,
  add column if not exists b_recording_until timestamptz;

comment on column public.pp_sessions.a_recording_until is
  'Speaker A is recording until this instant (self-expiring presence TTL). Null or past = not recording.';
comment on column public.pp_sessions.b_recording_until is
  'Speaker B is recording until this instant (self-expiring presence TTL). Null or past = not recording.';

-- A turn is capped at max_turn_seconds (120 today), and the mic permission
-- prompt sits in front of that, so one minute of headroom on the cap is the
-- whole honest lifetime of a "recording" flag. Floor of 90 s so a small cap
-- cannot make the flag flicker off mid-take.
create or replace function public.pp_recording_ttl_seconds()
returns int
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(90, coalesce((public.game_setting('max_turn_seconds'))::int, 30) + 60);
$function$;

-- Set or clear "I am recording" for one rally I am in.
-- Deliberately does NOT touch pp_sessions.updated_at: that column orders the
-- rally list and means "something happened in this rally". Presence is
-- ephemeral and must not reshuffle the list or look like a new reply.
create or replace function public.pp_set_recording(sid uuid, recording boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  s public.pp_sessions;
  ttl int := public.pp_recording_ttl_seconds();
  until_at timestamptz;
begin
  if me is null then raise exception 'sign in first'; end if;
  perform public.pp_heartbeat();

  select * into s from public.pp_sessions
   where id = sid and (speaker_a = me or speaker_b = me)
   for update;
  if not found then raise exception 'not your rally'; end if;

  if recording and s.status not in ('waiting', 'active') then
    raise exception 'rally is closed';
  end if;

  until_at := case when recording then now() + make_interval(secs => ttl) else null end;

  if s.speaker_a = me then
    update public.pp_sessions set a_recording_until = until_at where id = sid;
  else
    update public.pp_sessions set b_recording_until = until_at where id = sid;
  end if;

  return jsonb_build_object('ok', true, 'recording', recording, 'ttl_seconds', ttl);
end
$function$;

grant execute on function public.pp_recording_ttl_seconds() to authenticated;
grant execute on function public.pp_set_recording(uuid, boolean) to authenticated;
