-- When a contributor books a live scene slot, two things should happen:
--
-- 1. If nobody else picked that time yet (slot stays open), every other active
--    contributor who speaks the language gets a "slot_booked" email: "Pearl
--    Reindeer wants to do a Pidgin scene at 8:45 PM -- book the same time to
--    join them."  This is the Calendly-like invitation the test users asked for.
--
-- 2. If the booking pairs them instantly (someone was already waiting), both
--    contributors get a "slot_paired" email: "You and Vibrant Macaw are paired
--    at 8:45 PM."
--
-- Both include an "Add to Google Calendar" link. When pairing happens, any
-- unsent slot_booked notifications for that slot are retired so people don't
-- get stale invitations.

-- Replace arena_book to insert notifications after the booking.
create or replace function public.arena_book(lang text, starts_at timestamptz)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  c public.contributors;
  why text;
  slot_id uuid;
  sid uuid;
  maxup int := coalesce((public.game_setting('arena_max_upcoming'))::int, 3);
begin
  select * into c from public.contributors where id = me;
  if not found or c.withdrawn_at is not null or c.closed_at is not null then raise exception 'not a contributor'; end if;
  if c.arena_paused_until is not null and c.arena_paused_until > now() then
    raise exception 'live bookings are paused until % after missed scenes', to_char(c.arena_paused_until at time zone 'Africa/Lagos', 'DD Mon HH24:MI');
  end if;
  if lang <> all(c.languages) then raise exception 'you are not signed up for that language'; end if;
  why := public.arena_slot_ok(arena_book.starts_at);
  if why <> 'ok' then raise exception '%', why; end if;
  if (select count(*) from public.arena_slots s where s.contributor_id = me and s.status in ('open','paired') and s.starts_at > now()) >= maxup then
    raise exception 'you already hold % bookings; play one first', maxup;
  end if;
  if exists (select 1 from public.arena_slots s where s.contributor_id = me and s.starts_at = arena_book.starts_at and s.status in ('open','paired')) then
    raise exception 'you already have that time';
  end if;
  insert into public.arena_slots (contributor_id, language, starts_at) values (me, lang, arena_book.starts_at)
    on conflict on constraint arena_slots_contributor_id_starts_at_key do update set status = 'open', language = excluded.language, session_id = null, created_at = now(), reschedule_count = 0
    returning id into slot_id;
  sid := public.arena_try_pair(slot_id);

  if sid is not null then
    -- Paired: notify both contributors with a "you're paired" email.
    -- Retire any unsent slot_booked notifications for this slot first.
    update public.notifications set sent_at = now(), claimed_at = now(), error = 'not sent: the slot was paired'
    where kind = 'slot_booked' and sent_at is null and ref like slot_id::text || ':%';

    with pair as (
      select speaker_a, speaker_b from public.pp_sessions where id = sid
    )
    insert into public.notifications (contributor_id, kind, ref, detail)
    select v.cid, 'slot_paired', sid::text || ':' || v.cid::text,
      jsonb_build_object('starts_at', arena_book.starts_at, 'language', lang, 'session_id', sid,
        'partner', (select alias from public.contributors where id = v.pid),
        'partner_avatar', (select avatar from public.contributors where id = v.pid))
    from pair, lateral (values (pair.speaker_a, pair.speaker_b), (pair.speaker_b, pair.speaker_a)) v(cid, pid)
    on conflict (kind, ref) do nothing;
  else
    -- Not paired: tell other eligible contributors someone is waiting.
    insert into public.notifications (contributor_id, kind, ref, detail)
    select k.id, 'slot_booked', slot_id::text || ':' || k.id::text,
      jsonb_build_object('starts_at', arena_book.starts_at, 'language', lang,
        'booker', c.alias, 'booker_avatar', c.avatar)
    from public.contributors k
    where k.id <> me and k.closed_at is null and k.withdrawn_at is null
      and lang = any(k.languages)
      and (k.arena_paused_until is null or k.arena_paused_until < now())
      and not exists (
        select 1 from public.arena_slots s
        where s.contributor_id = k.id and s.starts_at = arena_book.starts_at
          and s.status in ('open','paired')
      )
    on conflict (kind, ref) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'slot_id', slot_id, 'starts_at', arena_book.starts_at, 'paired', sid is not null, 'session_id', sid);
end $function$;

-- When a contributor cancels a booking, retire any unsent slot_booked
-- invitations that were sent for that slot so people don't get stale
-- "someone wants to play" emails.
create or replace function public.arena_cancel(slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  s public.arena_slots;
  cutoff int := coalesce((public.game_setting('arena_cancel_cutoff_hours'))::int, 2);
  late boolean;
begin
  select * into s from public.arena_slots where id = arena_cancel.slot_id and contributor_id = me for update;
  if not found or s.status not in ('open','paired') then raise exception 'no such booking'; end if;
  late := s.status = 'paired' and now() > s.starts_at - make_interval(hours => cutoff);
  perform public.arena_release(arena_cancel.slot_id);
  update public.arena_slots set status = case when late then 'late_cancel' else 'cancelled' end where id = arena_cancel.slot_id;
  if late then perform public.arena_strike(me, 'late cancel'); end if;

  update public.notifications set sent_at = now(), claimed_at = now(), error = 'not sent: the slot was cancelled'
  where kind = 'slot_booked' and sent_at is null and ref like arena_cancel.slot_id::text || ':%';

  return jsonb_build_object('ok', true, 'strike', late);
end $function$;
