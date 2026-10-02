-- Support-Faelle fuer das Admin-Dashboard.
-- Einmalig im Supabase SQL-Editor ausfuehren. Idempotent.

create table if not exists public.support_cases (
  id               uuid primary key default gen_random_uuid(),

  -- Herkunft im Postfach
  uid              integer not null,
  message_id       text,
  -- Wurzel des Threads: erste Message-ID. Darueber finden Folgemails ihren Fall.
  thread_key       text not null,

  -- Absender
  from_email       text not null,
  from_name        text,
  subject          text,
  received_at      timestamptz not null default now(),

  -- Einordnung
  kategorie        text not null default 'sonstiges',
  -- neu | plankorrektur | rettung_angeboten | gerettet | erstattung | erledigt
  status           text not null default 'neu',
  heikel           boolean not null default false,
  kurz             text,

  -- Inhalt
  entwurf          text,
  letzte_nachricht text,
  -- [{ mid, richtung: 'ein'|'aus', text, at }]
  verlauf          jsonb not null default '[]'::jsonb,

  -- Kundenkontext
  lead_id          uuid,
  dog_name         text,
  bezahlt          boolean,
  betrag_cent      integer,

  gesendet_at      timestamptz,
  erledigt_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Ein Fall je Thread: Folgemails aktualisieren, statt neue Faelle zu erzeugen.
create unique index if not exists support_cases_thread_key_uidx
  on public.support_cases (thread_key);

create index if not exists support_cases_status_idx
  on public.support_cases (status, received_at desc);

create index if not exists support_cases_from_idx
  on public.support_cases (from_email);

create index if not exists support_cases_received_idx
  on public.support_cases (received_at desc);

-- Zugriff ausschliesslich serverseitig ueber den Service-Role-Key.
alter table public.support_cases enable row level security;

create or replace function public.support_cases_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists support_cases_touch_trg on public.support_cases;
create trigger support_cases_touch_trg
  before update on public.support_cases
  for each row execute function public.support_cases_touch();
