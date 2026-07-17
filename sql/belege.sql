-- ============================================================
-- Beleg-System (Kleinbetragsrechnungen) für DE-Verkäufe
-- Einmal in Supabase → SQL Editor ausführen.
-- Erzeugt: Tabelle belege, Zähler beleg_counter, Funktion create_beleg().
-- ============================================================

-- 1) Beleg-Tabelle
create table if not exists public.belege (
  id               uuid primary key default gen_random_uuid(),
  belegnummer      text not null unique,             -- z.B. "2026-000123"
  seq              bigint not null,                  -- fortlaufend pro Jahr
  jahr             int  not null,
  mollie_payment_id text unique,                     -- Idempotenz: 1 Beleg je Zahlung
  lead_id          uuid,
  email            text,
  beschreibung     text not null,                    -- "Personalisierter Hundetrainingsplan (3 Monate)"
  brutto_cents     int  not null,                    -- tatsächlich gezahlt (inkl. evtl. Order-Bump)
  ust_cents        int  not null,
  netto_cents      int  not null,
  ust_satz         int  not null default 19,
  markt            text not null default 'DE',
  waehrung         text not null default 'EUR',
  leistungsdatum   timestamptz not null,             -- = paid_at (Rechnungs-/Leistungsdatum)
  storno_von       uuid references public.belege(id),-- für Gutschriften/Storno
  created_at       timestamptz not null default now()
);

create index if not exists belege_lead_idx  on public.belege(lead_id);
create index if not exists belege_email_idx on public.belege(email);

-- 2) Lückenloser Zähler (pro Jahr)
create table if not exists public.beleg_counter (
  jahr     int primary key,
  last_seq bigint not null default 0
);

-- 3) Atomare, lückenlose Belegnummer + Insert (idempotent gegen Mehrfach-Webhooks)
create or replace function public.create_beleg(
  p_mollie_payment_id text,
  p_lead_id           uuid,
  p_email             text,
  p_beschreibung      text,
  p_brutto_cents      int,
  p_leistungsdatum    timestamptz,
  p_ust_satz          int  default 19,
  p_markt             text default 'DE',
  p_waehrung          text default 'EUR'
) returns public.belege
language plpgsql
security definer
as $$
declare
  v_jahr   int := extract(year from p_leistungsdatum)::int;
  v_seq    bigint;
  v_nummer text;
  v_netto  int;
  v_ust    int;
  v_row    public.belege;
begin
  -- Pro Zahlung serialisieren (Mollie feuert mehrfach) -> kein Duplikat, keine Lücke
  perform pg_advisory_xact_lock(hashtext(coalesce(p_mollie_payment_id, gen_random_uuid()::text)));

  -- Idempotenz: existiert schon ein Beleg für diese Zahlung? -> zurückgeben
  select * into v_row from public.belege where mollie_payment_id = p_mollie_payment_id;
  if found then
    return v_row;
  end if;

  -- Zähler atomar hochzählen (lückenlos)
  insert into public.beleg_counter(jahr, last_seq) values (v_jahr, 0)
    on conflict (jahr) do nothing;
  update public.beleg_counter set last_seq = last_seq + 1
    where jahr = v_jahr
    returning last_seq into v_seq;

  v_nummer := v_jahr::text || '-' || lpad(v_seq::text, 6, '0');

  -- USt aus Brutto herausrechnen (19% inklusive)
  v_netto := round(p_brutto_cents::numeric / (1 + p_ust_satz::numeric / 100));
  v_ust   := p_brutto_cents - v_netto;

  insert into public.belege(
    belegnummer, seq, jahr, mollie_payment_id, lead_id, email, beschreibung,
    brutto_cents, ust_cents, netto_cents, ust_satz, markt, waehrung, leistungsdatum
  ) values (
    v_nummer, v_seq, v_jahr, p_mollie_payment_id, p_lead_id, p_email, p_beschreibung,
    p_brutto_cents, v_ust, v_netto, p_ust_satz, p_markt, p_waehrung, p_leistungsdatum
  )
  returning * into v_row;

  return v_row;
end;
$$;
