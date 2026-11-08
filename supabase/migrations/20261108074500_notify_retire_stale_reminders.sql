-- A reply reminder is queued while the rally is waiting on someone, then held by
-- quiet hours until morning. By morning the rally may have moved on: they
-- replied, it completed, or it was abandoned. The sender never looked again, so
-- on 2026-11-04 the founder got the "last call" for Clinic Visit four hours
-- after that rally had already ended. Now, right before claiming a batch, any
-- reply_due whose rally is no longer active, no longer waiting on that person,
-- or waiting with a different deadline than the one in the ref, is retired
-- unsent. Same for a scene reminder whose booking is no longer paired.
create or replace function public.notify_claim(lim integer default 50)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  out_ jsonb;
  last_month text := to_char((now() at time zone 'Africa/Lagos') - interval '1 month', 'YYYY-MM');
  w int := coalesce((public.game_setting('reply_window_hours'))::int, 24);
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'admins only'; end if;

  -- Touch one: a reply landed. Fifteen minutes after their turn opened, not the instant it
  -- did, so a burst of activity does not become a burst of mail.
  insert into public.notifications (contributor_id, kind, ref, detail)
  select s.next_speaker, 'reply_due', s.id::text || ':' || to_char(s.due_at, 'YYYYMMDDHH24MI') || ':new',
    jsonb_build_object('session_id', s.id, 'title', c.title, 'due_at', s.due_at, 'language', s.language, 'touch', 'new',
      'partner', (select alias from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end),
      'partner_avatar', (select avatar from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end))
  from public.pp_sessions s join public.scenario_cards c on c.id = s.card_id
  where s.mode = 'async' and s.status = 'active' and s.next_speaker is not null
    and now() >= s.due_at - make_interval(hours => w) + interval '15 minutes'
    and now() <  s.due_at - make_interval(hours => w) + interval '2 hours'
  on conflict (kind, ref) do nothing;

  -- Touch two: halfway through the window.
  insert into public.notifications (contributor_id, kind, ref, detail)
  select s.next_speaker, 'reply_due', s.id::text || ':' || to_char(s.due_at, 'YYYYMMDDHH24MI') || ':mid',
    jsonb_build_object('session_id', s.id, 'title', c.title, 'due_at', s.due_at, 'language', s.language, 'touch', 'mid',
      'partner', (select alias from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end),
      'partner_avatar', (select avatar from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end))
  from public.pp_sessions s join public.scenario_cards c on c.id = s.card_id
  where s.mode = 'async' and s.status = 'active' and s.next_speaker is not null
    and now() >= s.due_at - make_interval(hours => w / 2)
    and now() <  s.due_at - interval '4 hours'
  on conflict (kind, ref) do nothing;

  -- Touch three: last call, four hours out. This is the reminder that already existed.
  insert into public.notifications (contributor_id, kind, ref, detail)
  select s.next_speaker, 'reply_due', s.id::text || ':' || to_char(s.due_at, 'YYYYMMDDHH24MI') || ':last',
    jsonb_build_object('session_id', s.id, 'title', c.title, 'due_at', s.due_at, 'language', s.language, 'touch', 'last',
      'partner', (select alias from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end),
      'partner_avatar', (select avatar from public.contributors where id = case when s.next_speaker = s.speaker_a then s.speaker_b else s.speaker_a end))
  from public.pp_sessions s join public.scenario_cards c on c.id = s.card_id
  where s.mode = 'async' and s.status = 'active' and s.next_speaker is not null
    and s.due_at between now() and now() + interval '4 hours'
  on conflict (kind, ref) do nothing;

  -- a booked scene starting in about an hour
  insert into public.notifications (contributor_id, kind, ref, detail)
  select b.contributor_id, 'booking_soon', b.id::text,
    jsonb_build_object('slot_id', b.id, 'session_id', b.session_id, 'starts_at', b.starts_at, 'language', b.language,
      'partner', (select alias from public.contributors where id = (select o.contributor_id from public.arena_slots o where o.session_id = b.session_id and o.id <> b.id limit 1)),
      'partner_avatar', (select avatar from public.contributors where id = (select o.contributor_id from public.arena_slots o where o.session_id = b.session_id and o.id <> b.id limit 1)))
  from public.arena_slots b
  where b.status = 'paired' and b.starts_at between now() + interval '40 minutes' and now() + interval '75 minutes'
  on conflict (kind, ref) do nothing;

  -- a clause 15 response window closing within a day
  insert into public.notifications (contributor_id, kind, ref, detail)
  select ic.contributor_id, 'case_window_closing', ic.id::text, jsonb_build_object('case_id', ic.id, 'respond_by', ic.respond_by, 'reason', ic.reason)
  from public.integrity_cases ic
  where ic.status = 'notice_sent' and ic.respond_by between now() and now() + interval '24 hours'
  on conflict (kind, ref) do nothing;

  -- a payout marked paid in the last week
  insert into public.notifications (contributor_id, kind, ref, detail)
  select p.contributor_id, 'payout_paid', p.id::text, jsonb_build_object('payout_id', p.id, 'rail', p.rail, 'amount_usd', p.amount_usd, 'paid_at', p.paid_at, 'reference', p.reference)
  from public.payouts p
  where p.status = 'paid' and p.paid_at > now() - interval '7 days'
  on conflict (kind, ref) do nothing;

  -- the month-end statement, for everyone with lines or payouts last month (Lagos time), once the month has turned
  insert into public.notifications (contributor_id, kind, ref, detail)
  select x.cid, 'statement', x.cid::text || ':' || last_month, public.statement_json(x.cid, last_month)
  from (select e.contributor_id as cid from public.earnings e where to_char(e.created_at at time zone 'Africa/Lagos', 'YYYY-MM') = last_month
        union select p.contributor_id from public.payouts p where to_char(coalesce(p.paid_at, p.created_at) at time zone 'Africa/Lagos', 'YYYY-MM') = last_month) x
  join public.contributors c on c.id = x.cid and c.closed_at is null
  on conflict (kind, ref) do nothing;

  -- Quiet hours hold mail overnight, so two touches for one rally can end up queued together
  -- and land as two messages at breakfast. Keep the most recent and retire the rest unsent.
  update public.notifications n set sent_at = now(), claimed_at = now(), error = 'not sent: a later touch for the same rally was queued'
  where n.kind = 'reply_due' and n.sent_at is null
    and exists (
      select 1 from public.notifications m
      where m.kind = 'reply_due' and m.sent_at is null
        and split_part(m.ref, ':', 1) = split_part(n.ref, ':', 1)
        and m.created_at > n.created_at
    );

  -- The rally may have moved on while the reminder waited: they replied (the turn is no
  -- longer theirs, or the deadline in the ref is not the current one), it completed, or
  -- it was abandoned. A reminder for a rally that is not waiting on them is retired unsent.
  update public.notifications n set sent_at = now(), claimed_at = now(), error = 'not sent: the rally was no longer waiting on them'
  where n.kind = 'reply_due' and n.sent_at is null
    and not exists (
      select 1 from public.pp_sessions s
      where s.id::text = split_part(n.ref, ':', 1)
        and s.status = 'active'
        and s.next_speaker = n.contributor_id
        and to_char(s.due_at, 'YYYYMMDDHH24MI') = split_part(n.ref, ':', 2)
    );

  -- Likewise a scene reminder for a booking that is no longer paired.
  update public.notifications n set sent_at = now(), claimed_at = now(), error = 'not sent: the booking was no longer paired'
  where n.kind = 'booking_soon' and n.sent_at is null
    and not exists (select 1 from public.arena_slots b where b.id::text = n.ref and b.status = 'paired' and b.contributor_id = n.contributor_id);

  -- claim a batch: unsent, tried fewer than three times, not claimed in the last ten minutes.
  -- A closing clause 15 window is a legal deadline and ignores quiet hours; nothing else here
  -- is urgent enough to wake someone.
  with picked as (
    select n.id from public.notifications n
    where n.sent_at is null and n.attempts < 3 and (n.claimed_at is null or n.claimed_at < now() - interval '10 minutes')
      and (n.kind = 'case_window_closing' or public.notify_waking_now())
    order by n.created_at limit lim for update skip locked
  ), upd as (
    update public.notifications n set claimed_at = now(), attempts = n.attempts + 1 from picked where n.id = picked.id returning n.*
  )
  -- alias/avatar are the recipient's own: the kinds with no partner (a payout, a statement,
  -- a clause 15 notice) still get a face, and it is the one they see in the app.
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'ref', u.ref, 'detail', u.detail, 'contributor_id', u.contributor_id, 'attempt', u.attempts,
    'email', (select email from auth.users where id = u.contributor_id),
    'speaker_id', (select speaker_id from public.contributors where id = u.contributor_id),
    'alias', (select alias from public.contributors where id = u.contributor_id),
    'avatar', (select avatar from public.contributors where id = u.contributor_id)) order by u.id), '[]'::jsonb)
  into out_ from upd u;
  return out_;
end
$function$;
