-- À exécuter dans le MÊME projet Supabase, après 005
alter table referrals add column if not exists paid boolean not null default false;
-- l'admin peut modifier les factures de tous ; chacun garde la main sur les siennes
drop policy if exists v_rw on invoices;
create policy v_own on invoices for all using(tech_id=auth.uid()) with check(tech_id=auth.uid());
create policy v_adm on invoices for all using(is_admin()) with check(is_admin());
