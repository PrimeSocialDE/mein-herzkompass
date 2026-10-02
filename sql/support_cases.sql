-- ===========================================================================
-- Support-Faelle fuer das Admin-Dashboard (/admin-plan.html, Reiter "Support")
-- ---------------------------------------------------------------------------
-- Einmalig im Supabase SQL-Editor ausfuehren. Vollstaendig idempotent:
-- mehrfaches Ausfuehren aendert nichts und loescht nichts.
--
-- Es gibt bewusst KEIN "drop" in dieser Datei. Der Trigger wird ueber eine
-- Existenzpruefung angelegt statt ueber "drop trigger if exists" — damit
-- schlaegt der SQL-Editor nicht mehr wegen destruktiver Operationen an.
--
-- Beruehrte Objekte: ausschliesslich support_cases und support_cases_touch.
-- Keine bestehende Tabelle wird angefasst.
-- ===========================================================================

-- --- Tabelle ---------------------------------------------------------------
create table if not exists public.support_cases (
  id               uuid primary key default gen_random_uuid(),

  -- Herkunft im Postfach
  uid              integer not null,
  message_id       text,
  -- Wurzel des Threads: darueber finden Folgemails ihren Fall wieder.
  thread_key       text not null,

  -- Absender
  from_email       text not null,
  from_name        text,
  subject          text,
  received_at      timestamptz not null default now(),

  -- Einordnung durch die Triage
  -- kategorie: widerruf | plankorrektur | plan_fehlt | frage | rechnung | sonstiges
  kategorie        text not null default 'sonstiges',
  -- status: neu | plankorrektur | rettung_angeboten | gerettet | erstattung | erledigt
  status           text not null default 'neu',
  heikel           boolean not null default false,
  kurz             text,

  -- Inhalt
  entwurf          text,
  letzte_nachricht text,
  -- [{ mid, richtung: 'ein'|'aus', text, at }]
  verlauf          jsonb not null default '[]'::jsonb,

  -- Kundenkontext aus wauwerk_leads (nur kopiert, keine Fremdschluessel —
  -- ein geloeschter Lead soll den Supportfall nicht mitreissen)
  lead_id          uuid,
  dog_name         text,
  bezahlt          boolean,
  betrag_cent      integer,

  gesendet_at      timestamptz,
  erledigt_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- --- Indizes ---------------------------------------------------------------
-- Ein Fall je Thread: Folgemails aktualisieren den Fall, statt neue anzulegen.
create unique index if not exists support_cases_thread_key_uidx
  on public.support_cases (thread_key);

-- Dashboard-Liste: nach Zustand gefiltert, nach Eingang sortiert.
create index if not exists support_cases_status_idx
  on public.support_cases (status, received_at desc);

-- Fall ueber die Absenderadresse finden (Fallback, wenn der Thread reisst).
create index if not exists support_cases_from_idx
  on public.support_cases (from_email);

create index if not exists support_cases_received_idx
  on public.support_cases (received_at desc);

-- --- Zugriff ---------------------------------------------------------------
-- RLS an, bewusst OHNE Policies: damit kommt weder der anon- noch der
-- authenticated-Schluessel an die Daten. Serverseitig laeuft alles ueber
-- SUPABASE_SERVICE_ROLE (lib/db.ts), und der umgeht RLS.
alter table public.support_cases enable row level security;

-- --- updated_at automatisch pflegen ----------------------------------------
create or replace function public.support_cases_touch()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end
$fn$;

do $do$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'support_cases_touch_trg'
      and tgrelid = 'public.support_cases'::regclass
  ) then
    create trigger support_cases_touch_trg
      before update on public.support_cases
      for each row
      execute function public.support_cases_touch();
  end if;
end
$do$;

-- --- Kontrolle -------------------------------------------------------------
-- Gibt eine Zeile zurueck, wenn alles steht.
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'support_cases')      as tabelle,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'support_cases')         as indizes,
  (select count(*) from pg_trigger
     where tgname = 'support_cases_touch_trg')                            as trigger,
  (select relrowsecurity from pg_class
     where oid = 'public.support_cases'::regclass)                        as rls_an;
