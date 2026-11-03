-- Read receipts, rung one: a record of a take having been *heard*.
--
-- pp_turns already carries rated_at, which is a genuine read receipt — rating
-- is enforced before a partner may reply, so it cannot be given without
-- listening. But it arrives late. heard_at closes the anxious window between
-- "stored" and "rated": the partner has opened the rally and played the take.
--
-- Nothing is widened here. pp_turns keeps its single read policy (participants
-- and admins); the write goes through a SECURITY DEFINER rpc that checks both
-- that the caller is in the rally and that the take is not their own.

alter table public.pp_turns
  add column if not exists heard_at timestamptz;

comment on column public.pp_turns.heard_at is
  'When the OTHER speaker actually played this take. Set once by pp_mark_heard(); never moved.';

-- A rated take was necessarily heard. Backfill so the thread does not show a
-- take as rated-but-never-heard.
update public.pp_turns
   set heard_at = rated_at
 where rated_at is not null and heard_at is null;

-- Mark a turn heard. Only the person who did NOT record it, only in a rally
-- they are in, idempotent, and never moves backwards once set.
create or replace function public.pp_mark_heard(tid uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  t public.pp_turns;
begin
  if me is null then raise exception 'sign in first'; end if;
  perform public.pp_heartbeat();

  select * into t from public.pp_turns where id = tid;
  if not found then raise exception 'no such turn'; end if;

  -- in the rally, and not the speaker of this take
  if not exists (
    select 1 from public.pp_sessions s
     where s.id = t.session_id and (s.speaker_a = me or s.speaker_b = me)
  ) then
    raise exception 'not your rally';
  end if;
  if t.speaker = me then raise exception 'you cannot mark your own take heard'; end if;

  -- the `heard_at is null` guard is what makes this idempotent and monotonic
  update public.pp_turns set heard_at = now()
   where id = tid and heard_at is null
   returning * into t;
  if not found then
    select * into t from public.pp_turns where id = tid;
  end if;

  return jsonb_build_object('ok', true, 'heard_at', t.heard_at);
end
$function$;

grant execute on function public.pp_mark_heard(uuid) to authenticated;
