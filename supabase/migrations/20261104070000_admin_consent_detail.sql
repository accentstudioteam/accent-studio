-- Admin consent detail.
--
-- The Studio's contributor screen now shows, and hands over, the signed consent record: a buyer
-- doing diligence asks how consent was obtained, and the answer was recorded but never surfaced.
-- The admin RPC's consent object therefore carries the whole record (legal name as typed, the
-- attestation, the initialled clauses with their exact wording, the signature method, the
-- agreement hash) plus the agreement_versions row for the version that was signed.
--
-- Admin-only by construction, and tightened rather than loosened:
--   * admin_contributor_json has no is_admin() guard of its own. Its three callers
--     (admin_contributor, admin_contributors, admin_contributor_set) all check is_admin() and all
--     run as SECURITY DEFINER, so they keep reaching it. It was nonetheless executable by PUBLIC,
--     anon and authenticated; that grant is revoked here, so the widened object is reachable only
--     through the guarded callers.
--   * account_json, my_onboarding and delivery_payload are untouched. A contributor and a buyer
--     still see the explicit, name-free field list; the column comment on legal_name says so.
--   * No row-level-security policy changes.

create or replace function public.admin_contributor_json(cid uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', c.id, 'speaker_id', c.speaker_id, 'full_name', a.full_name, 'email', u.email, 'languages', to_jsonb(c.languages), 'primary_language', c.primary_language,
    'country', c.country, 'city', a.city, 'created_at', c.created_at, 'last_active_at', c.last_active_at,
    'status', case when c.closed_at is not null then 'closed' when c.withdrawn_at is not null then 'withdrawn' when c.paused_until is not null and c.paused_until > now() then 'paused' else 'active' end,
    'paused_until', c.paused_until, 'paused_reason', c.paused_reason, 'closed_at', c.closed_at, 'closed_reason', c.closed_reason, 'withdrawn_at', c.withdrawn_at, 'admin_note', c.admin_note,
    'rallies', (select count(*) from public.pp_sessions s where c.id in (s.speaker_a, s.speaker_b) and s.status = 'complete' and s.mode = 'async'),
    'scenes', (select count(*) from public.pp_sessions s where c.id in (s.speaker_a, s.speaker_b) and s.status = 'complete' and s.mode = 'live'),
    'abandoned', (select count(*) from public.pp_sessions s where s.abandoned_by = c.id),
    'verified_seconds', (select coalesce(sum(e.verified_seconds), 0) from public.earnings e where e.contributor_id = c.id and e.kind = 'session'),
    'avg_quality', (select round(avg(e.quality_score), 2) from public.earnings e where e.contributor_id = c.id and e.kind = 'session'),
    'earned_usd', (select coalesce(sum(e.amount_usd), 0) from public.earnings e where e.contributor_id = c.id and e.status <> 'forfeited'),
    'paid_usd', (select coalesce(sum(e.amount_usd), 0) from public.earnings e where e.contributor_id = c.id and e.status = 'paid'),
    'held_usd', (select coalesce(sum(e.amount_usd), 0) from public.earnings e where e.contributor_id = c.id and e.status = 'held'),
    'cleared_usd', (select coalesce(sum(e.amount_usd), 0) from public.earnings e where e.contributor_id = c.id and e.status = 'cleared'),
    'arena_strikes', c.arena_strikes, 'arena_paused_until', c.arena_paused_until, 'quiet_count', c.quiet_count,
    'open_cases', (select count(*) from public.integrity_cases ic where ic.contributor_id = c.id and ic.status <> 'decided'),
    'confirmed_cases', (select count(*) from public.integrity_cases ic where ic.contributor_id = c.id and ic.decision in ('confirmed', 'confirmed_account_closed')),
    -- the signed record in full, admin-only (see the header). Still an explicit field list:
    -- ip_hash and record_json stay out, the fingerprint stands for the record.
    'consent', (select jsonb_build_object(
                  'agreement_version', r.agreement_version, 'signed_at', r.signed_at, 'withdrawn_at', r.withdrawn_at, 'record_sha256', r.record_sha256,
                  'agreement_sha256', r.agreement_sha256, 'signature_method', r.signature_method,
                  'accepted_terms', r.accepted_terms, 'biometric_consent', r.biometric_consent,
                  'legal_name', r.legal_name, 'legal_name_attested', r.legal_name_attested,
                  'clauses_initialled', coalesce(r.clauses_initialled, '[]'::jsonb),
                  'speaker_id', r.speaker_id, 'alias', c.alias,
                  'agreement', (select jsonb_build_object('document_id', v.document_id, 'sha256', v.sha256, 'url', v.url, 'effective_date', v.effective_date)
                                from public.agreement_versions v where v.version = r.agreement_version limit 1))
                from public.consent_records r where r.contributor_id = c.id order by r.signed_at desc limit 1),
    'identity_status', (select i.status from public.identity_checks i where i.contributor_id = c.id),
    'payout_rail', (select p.rail from public.payout_accounts p where p.contributor_id = c.id),
    'open_data_requests', (select count(*) from public.data_requests d where d.contributor_id = c.id and d.status = 'open')
  )
  from public.contributors c left join public.applications a on a.id = c.application_id left join auth.users u on u.id = c.id
  where c.id = cid;
$function$;

-- Only the guarded SECURITY DEFINER callers may reach the helper now.
revoke execute on function public.admin_contributor_json(uuid) from public, anon, authenticated;

comment on column public.consent_records.legal_name is
  'The legal name the signer typed at signing, pre-filled from their application and correctable. Identity data: never exposed on a contributor-facing or buyer-facing surface. account_json, my_onboarding and delivery_payload each build their consent object from an explicit field list that leaves this column out; do not add it to them. admin_contributor_json carries it for the Studio''s contributor screen only, and is executable solely through its is_admin()-guarded SECURITY DEFINER callers.';
