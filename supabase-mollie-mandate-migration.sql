-- Mollie Mandate-based One-Click-Upsell
-- Speichert Customer-ID + Mandate-ID nach Erstkauf, damit Upsells ohne
-- zweiten Checkout-Redirect funktionieren (sequenceType='recurring').
--
-- Strikt additive Migration — bestehende Spalten unberuehrt.

ALTER TABLE wauwerk_leads
  ADD COLUMN IF NOT EXISTS mollie_customer_id text,
  ADD COLUMN IF NOT EXISTS mollie_mandate_id text,
  ADD COLUMN IF NOT EXISTS mollie_payment_method text;

-- Index fuer schnellen Lookup beim Upsell-Call (per email matchen)
CREATE INDEX IF NOT EXISTS idx_wauwerk_leads_email_mandate
  ON wauwerk_leads (email)
  WHERE mollie_mandate_id IS NOT NULL;

COMMENT ON COLUMN wauwerk_leads.mollie_customer_id IS
  'Mollie Customer-ID — wird beim Erstkauf via mollie.customers.create() erstellt.';
COMMENT ON COLUMN wauwerk_leads.mollie_mandate_id IS
  'Mollie Mandate-ID — wird beim Erstkauf via sequenceType=first erzeugt. Wenn vorhanden, kann fuer recurring charges genutzt werden (One-Click-Upsell).';
COMMENT ON COLUMN wauwerk_leads.mollie_payment_method IS
  'Methode des Erstkaufs (creditcard/paypal/sepadirectdebit/etc.). ApplePay/GooglePay/Klarna unterstuetzen kein recurring → kein Mandate.';
