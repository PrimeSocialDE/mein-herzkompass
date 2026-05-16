-- ════════════════════════════════════════════════════════════════════
-- Auto-Trigger: wauwerk_leads.status -> 'paid'  ⇒  /plan/generate
-- ════════════════════════════════════════════════════════════════════
--
-- WAS: Sobald in wauwerk_leads ein Lead von "pending" / "checkout_started" /
-- whatever auf "paid" gesetzt wird (egal ob Mollie-Webhook oder manuell
-- per Dashboard), ruft Postgres direkt unseren Plan-Generator auf.
--
-- WIE: pg_net Extension (in Supabase vorinstalliert) macht den HTTP-Call
-- aus dem Postgres-Server raus. Async/fire-and-forget — Update blockt
-- nicht.
--
-- SETUP (einmalig in Supabase SQL Editor ausfuehren):
--   1. Diese Datei komplett ins SQL Editor copy-paste
--   2. Run — WORKER_TOKEN ist schon eingesetzt
--
-- DANACH funktioniert:
--   UPDATE wauwerk_leads SET status='paid' WHERE id='...';
--   ⇒ Plan wird automatisch erstellt + Mail rausgeschickt
--
-- IDEMPOTENZ: pg_net feuert auch wenn der Plan schon existiert. Der
-- Endpoint /plan/generate skipped dann mit "skipped_existing". Kein
-- Schaden, keine doppelten Mails.
--
-- DIAGNOSE: Jeder Trigger-Aufruf wird in public.plan_gen_audit geloggt
-- (lead_id, email, ts, pg_net_request_id). Plus public.plan_gen_responses
-- (View auf net._http_response) zeigt was zurueckkam.
-- ════════════════════════════════════════════════════════════════════

-- pg_net Extension aktivieren (Supabase installiert in Schema "extensions",
-- die Funktionen leben aber im Schema "net")
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Audit-Tabelle: jeder Trigger-Fire wird hier festgehalten ────────
CREATE TABLE IF NOT EXISTS public.plan_gen_audit (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID,
  email TEXT,
  old_status TEXT,
  new_status TEXT,
  pg_net_request_id BIGINT,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_gen_audit_fired ON public.plan_gen_audit (fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_gen_audit_req ON public.plan_gen_audit (pg_net_request_id);

-- RLS an: Trigger-Function laeuft als SECURITY DEFINER (= owner-Rechte,
-- bypasst RLS), service_role bypasst RLS sowieso. Keine Policies =
-- anon/authenticated bekommt nichts zu sehen — Emails sind abgesichert.
ALTER TABLE public.plan_gen_audit ENABLE ROW LEVEL SECURITY;

-- ── Trigger-Funktion: feuert HTTP-POST an /plan/generate ────────────
CREATE OR REPLACE FUNCTION public.fn_trigger_plan_gen_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_worker_token TEXT := 'WlnFmq3JU1dvaTBu4XnTyWeac-uiH9SsYB2mC1sbguXewMoXCrhguOq8KNTeJ5XO';
  v_api_url TEXT := 'https://www.pfoten-plan.de/api/mitglieder/plan/generate';
  v_request_id BIGINT;
BEGIN
  -- Nur feuern wenn status FRISCH auf 'paid' geht
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    -- Email ist Pflicht damit /plan/generate ueberhaupt was tun kann
    IF NEW.email IS NULL OR NEW.email = '' THEN
      INSERT INTO public.plan_gen_audit (lead_id, email, old_status, new_status, note)
      VALUES (NEW.id, NEW.email, OLD.status, NEW.status, 'skip_no_email');
      RETURN NEW;
    END IF;

    -- Fire-and-forget HTTP-Call. pg_net laeuft async im Hintergrund.
    BEGIN
      SELECT net.http_post(
        url := v_api_url,
        body := jsonb_build_object(
          'lead_id', NEW.id::text,
          'email', NEW.email
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_worker_token
        ),
        timeout_milliseconds := 60000
      ) INTO v_request_id;

      INSERT INTO public.plan_gen_audit (lead_id, email, old_status, new_status, pg_net_request_id, note)
      VALUES (NEW.id, NEW.email, OLD.status, NEW.status, v_request_id, 'fired');
    EXCEPTION WHEN OTHERS THEN
      -- pg_net failed — protokollieren aber Update nicht blocken
      INSERT INTO public.plan_gen_audit (lead_id, email, old_status, new_status, note)
      VALUES (NEW.id, NEW.email, OLD.status, NEW.status, 'pg_net_exception: ' || SQLERRM);
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger neu anlegen (idempotent)
DROP TRIGGER IF EXISTS trg_lead_paid_to_plan_gen ON public.wauwerk_leads;
CREATE TRIGGER trg_lead_paid_to_plan_gen
  AFTER UPDATE OF status ON public.wauwerk_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_plan_gen_on_paid();

DROP TRIGGER IF EXISTS trg_lead_insert_paid_to_plan_gen ON public.wauwerk_leads;
CREATE TRIGGER trg_lead_insert_paid_to_plan_gen
  AFTER INSERT ON public.wauwerk_leads
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.fn_trigger_plan_gen_on_paid();

-- ════════════════════════════════════════════════════════════════════
-- DIAG-VIEWS: lesen net._http_response durch eine public-View
-- (sonst kommt die JS-REST-API nicht ans net-Schema)
-- ════════════════════════════════════════════════════════════════════

-- View auf die letzten Responses (joined mit Audit-Log)
CREATE OR REPLACE VIEW public.plan_gen_responses AS
SELECT
  a.id            AS audit_id,
  a.lead_id,
  a.email,
  a.fired_at,
  a.note          AS audit_note,
  a.pg_net_request_id,
  r.status_code,
  r.content       AS response_body,
  r.error_msg     AS response_error,
  r.created       AS response_at
FROM public.plan_gen_audit a
LEFT JOIN net._http_response r ON r.id = a.pg_net_request_id
ORDER BY a.fired_at DESC;

-- Read-only Grant fuer service_role (damit die JS-Client das lesen kann)
GRANT SELECT ON public.plan_gen_audit TO service_role;
GRANT SELECT ON public.plan_gen_responses TO service_role;

-- ════════════════════════════════════════════════════════════════════
-- Verifizieren nach Setup:
--
--   -- 1) Trigger existiert?
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname LIKE 'trg_lead_%paid%';
--
--   -- 2) Letzte Trigger-Fires?
--   SELECT * FROM public.plan_gen_audit ORDER BY fired_at DESC LIMIT 10;
--
--   -- 3) Was kam zurueck?
--   SELECT audit_id, email, fired_at, status_code, audit_note,
--          LEFT(response_body::text, 200) AS body_preview
--   FROM public.plan_gen_responses LIMIT 10;
--
-- TEST-FIRE (sicher — Lead hat bereits Plan, fired skipped_existing):
--   UPDATE wauwerk_leads SET status='pending' WHERE email='conny.spe@web.de';
--   UPDATE wauwerk_leads SET status='paid'    WHERE email='conny.spe@web.de';
--   -- Dann nach ~5s: SELECT * FROM plan_gen_responses LIMIT 1;
-- ════════════════════════════════════════════════════════════════════
