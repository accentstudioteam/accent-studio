-- The global default rate, used for any contributor whose project has no rate
-- of its own, moves from $16 to $20 a verified hour to match the Pidgin
-- corpus. Scarce stays at $25. Applied to production by hand on 2026-11-08;
-- this is the record, and it is safe to run again.
update public.game_config
   set value = jsonb_set(value, '{standard}', '20'::jsonb)
 where key = 'base_rates_usd';
