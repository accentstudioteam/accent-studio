-- Home and Money told a contributor the global default rate ("$16 per verified
-- hour"), while the project they are on had been set to $20. The number a
-- person sees should be the one their rallies are actually priced at:
-- base_rate_for(their language, their project), which is exactly what
-- post_earnings uses when a rally is verified. my_earnings now returns it as
-- my_rate_usd; base_rates stays for anything still reading it.
create or replace function public.my_earnings()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  rails jsonb := coalesce(public.game_setting('payout_rails'), '[]'::jsonb);
  my_rail text;
  lines jsonb;
  pays jsonb;
  cleared numeric; held numeric; requested numeric; paid numeric; forfeited numeric;
  rail_min numeric;
  my_rate numeric;
begin
  select payout_rail::text into my_rail from public.profiles where id = me;
  select public.base_rate_for(c.primary_language, c.project_id) into my_rate from public.contributors c where c.id = me;
  select coalesce(sum(amount_usd) filter (where status = 'cleared'), 0), coalesce(sum(amount_usd) filter (where status = 'held'), 0),
         coalesce(sum(amount_usd) filter (where status = 'requested'), 0), coalesce(sum(amount_usd) filter (where status = 'paid'), 0),
         coalesce(sum(amount_usd) filter (where status = 'forfeited'), 0)
    into cleared, held, requested, paid, forfeited from public.earnings where contributor_id = me;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'session_id', e.session_id, 'title', c.title, 'date', e.created_at, 'language', e.language,
      'verified_seconds', e.verified_seconds, 'quality_tier', e.quality_tier, 'multiplier', e.multiplier, 'base_rate_usd', e.base_rate_usd,
      'amount_usd', e.amount_usd, 'status', e.status, 'month', to_char(e.created_at, 'YYYY-MM')) order by e.created_at desc), '[]'::jsonb)
    into lines from public.earnings e join public.pp_sessions s on s.id = e.session_id join public.scenario_cards c on c.id = s.card_id where e.contributor_id = me;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'requested_at', p.created_at, 'rail', p.rail, 'amount_usd', p.amount_usd, 'status', p.status,
      'paid_at', p.paid_at, 'reference', p.reference) order by p.created_at desc), '[]'::jsonb)
    into pays from public.payouts p where p.contributor_id = me;
  select (r->>'min')::numeric into rail_min from jsonb_array_elements(rails) r where r->>'key' = my_rail limit 1;
  return jsonb_build_object('cleared_usd', cleared, 'held_usd', held, 'requested_usd', requested, 'paid_usd', paid, 'forfeited_usd', forfeited,
    'ap_per_usd', coalesce((public.game_setting('ap_per_usd'))::numeric, 1000), 'payout_days', coalesce((public.game_setting('payout_days'))::int, 14),
    'base_rates', public.game_setting('base_rates_usd'), 'my_rate_usd', my_rate, 'rails', rails, 'my_rail', my_rail, 'rail_min', rail_min,
    'open_request', exists (select 1 from public.payouts where contributor_id = me and status = 'requested'),
    'lines', lines, 'payouts', pays);
end $function$;
