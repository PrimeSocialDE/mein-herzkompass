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
--   2. Bei <<<WORKER_TOKEN_HIER>>> deinen WORKER_TOKEN aus Vercel
--      einsetzen (gleicher Wert wie in .env.local)
--   3. Run
--
-- DANACH funktioniert:
--   UPDATE wauwerk_leads SET status='paid' WHERE id='...';
--   ⇒ Plan wird automatisch erstellt + Mail rausgeschickt
--
-- IDEMPOTENZ: pg_net feuert auch wenn der Plan schon existiert. Der
-- Endpoint /plan/generate skipped dann mit "skipped_existing". Kein
-- Schaden, keine doppelten Mails.
-- ════════════════════════════════════════════════════════════════════

-- pg_net Extension aktivieren (Supabase hat sie vorinstalliert)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger-Funktion: feuert HTTP-POST an /plan/generate
CREATE OR REPLACE FUNCTION public.fn_trigger_plan_gen_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_worker_token TEXT := '<<<WORKER_TOKEN_HIER>>>';  -- EINSETZEN!
  v_api_url TEXT := 'https://www.pfoten-plan.de/api/mitglieder/plan/generate';
BEGIN
  -- Nur feuern wenn status FRISCH auf 'paid' geht
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    -- Email ist Pflicht damit /plan/generate ueberhaupt was tun kann
    IF NEW.email IS NULL OR NEW.email = '' THEN
      RAISE NOTICE '[paid-trigger] lead % hat keine email — skip', NEW.id;
      RETURN NEW;
    END IF;

    -- Fire-and-forget HTTP-Call (pg_net laeuft async im Hintergrund)
    PERFORM extensions.http_post(
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
    );

    RAISE NOTICE '[paid-trigger] plan-gen fired for lead % (%)', NEW.id, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- Alten Trigger droppen falls er existiert (idempotente Migration)
DROP TRIGGER IF EXISTS trg_lead_paid_to_plan_gen ON public.wauwerk_leads;

-- Trigger registrieren
CREATE TRIGGER trg_lead_paid_to_plan_gen
  AFTER UPDATE OF status ON public.wauwerk_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_plan_gen_on_paid();

-- Auch fuer INSERT (falls jemand direkt einen paid-Lead anlegt)
DROP TRIGGER IF EXISTS trg_lead_insert_paid_to_plan_gen ON public.wauwerk_leads;
CREATE TRIGGER trg_lead_insert_paid_to_plan_gen
  AFTER INSERT ON public.wauwerk_leads
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.fn_trigger_plan_gen_on_paid();

-- ════════════════════════════════════════════════════════════════════
-- Test (optional): einen Lead bewusst auf paid setzen → in pg_net
-- Logs sollte ein Eintrag erscheinen.
--
--   SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 5;
--   SELECT * FROM net._http_response ORDER BY id DESC LIMIT 5;
-- ════════════════════════════════════════════════════════════════════
