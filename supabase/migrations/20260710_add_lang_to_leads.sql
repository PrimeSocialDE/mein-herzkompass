-- Mehrsprachigkeit (PL): additive Sprach-Spalte auf wauwerk_leads.
-- REIN ADDITIV: Default 'de' -> alle bestehenden Zeilen und das deutsche
-- Verhalten bleiben unveraendert. Keine DE-Zeile wird geaendert.
--
-- STATUS: NOCH NICHT AUSGEFUEHRT. Wird erst gegen Supabase laufen, wenn
-- der PL-Flow (Phase 1) bereit ist und der User es freigibt.

alter table public.wauwerk_leads
  add column if not exists lang text not null default 'de';

-- Optional fuer schnelle Segmentierung nach Markt:
create index if not exists wauwerk_leads_lang_idx on public.wauwerk_leads (lang);
