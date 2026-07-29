# Upsell-System Setup-Anleitung

## 1. Datenbank-Tabelle erstellen

Die SQL-Datei `scripts/create-upsell-tracking.sql` muss manuell im **Supabase SQL Editor** ausgeführt werden.

1. Supabase Dashboard öffnen
2. SQL Editor aufrufen
3. Inhalt von `create-upsell-tracking.sql` einfügen und ausführen
4. Prüfen, ob die Tabelle `upsell_tracking` erstellt wurde

## 2. Vercel Cron einrichten

In `vercel.json` muss der Cron-Job hinzugefügt werden:

```json
{
  "crons": [
    {
      "path": "/api/upsell-cron?secret=pfoten-cron-2024",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Der Cron läuft täglich um 06:00 UTC und prüft, welche Kunden Upsell-Emails bekommen sollen.

## 3. Stripe Webhook erweitern

Die bestehende Stripe-Webhook-Route (`app/api/stripe/webhook/route.ts`) benötigt einen neuen Case für Upsell-Produkt-Käufe:

```typescript
// Im payment_intent.succeeded Handler:
if (metadata.type === 'upsell_product') {
  // Upsell-Purchase-Handler aufrufen
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.pfoten-plan.de'}/api/upsell-product-purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentIntentId: paymentIntent.id,
      type: metadata.product,
      email: metadata.email,
      leadId: metadata.lead_id,
      dogName: metadata.dog_name
    })
  });
}
```

## 4. Umgebungsvariablen

Folgende Umgebungsvariablen werden benötigt (sollten bereits gesetzt sein):

- `STRIPE_SECRET_KEY` - Stripe Secret Key
- `BREVO_API_KEY` - Brevo (Sendinblue) API Key für Email-Versand
- `ANTHROPIC_API_KEY` - Anthropic API Key für Claude Content-Generierung
- `SUPABASE_URL` - Supabase Projekt-URL
- `SUPABASE_SERVICE_ROLE` - Supabase Service Role Key

## 5. Testen

### Cron manuell testen
Direkt im Browser aufrufen:
```
https://www.pfoten-plan.de/api/upsell-cron?secret=pfoten-cron-2024
```

### Landing Pages testen
```
https://www.pfoten-plan.de/upsell-ernaehrung.html?email=test@example.com&lead_id=xxx
https://www.pfoten-plan.de/upsell-zweithund.html?email=test@example.com&lead_id=xxx
https://www.pfoten-plan.de/upsell-abo.html?email=test@example.com&lead_id=xxx
https://www.pfoten-plan.de/upsell-reise.html?email=test@example.com&lead_id=xxx
https://www.pfoten-plan.de/upsell-erstehilfe.html?email=test@example.com&lead_id=xxx
```

### Purchase Handler testen
```bash
curl -X POST https://www.pfoten-plan.de/api/upsell-product-purchase \
  -H "Content-Type: application/json" \
  -d '{"type":"erstehilfe","email":"test@example.com","leadId":"xxx","dogName":"Luna"}'
```

## 6. Upsell-Zeitplan

| Tag nach Kauf | Produkt      | Preis      |
|---------------|-------------|------------|
| Tag 10        | Ernährungsplan | €24,99    |
| Tag 21        | Zweithund-Guide | €19,99   |
| Tag 30        | Jahreszeiten-Abo | €9,99/Mo |
| Tag 45        | Reise-Guide  | €19,99     |
| Tag 60        | Erste-Hilfe Guide | €14,99  |

## 7. Dateien-Übersicht

- `scripts/create-upsell-tracking.sql` - SQL für die Tracking-Tabelle
- `app/api/upsell-cron/route.ts` - Täglicher Cron für Upsell-Emails
- `app/api/upsell-product-checkout/route.ts` - Stripe PaymentIntent erstellen
- `app/api/upsell-product-purchase/route.ts` - Nach Kauf: Content generieren & senden
- `public/upsell-ernaehrung.html` - Landing Page Ernährungsplan
- `public/upsell-zweithund.html` - Landing Page Zweithund-Guide
- `public/upsell-abo.html` - Landing Page Jahreszeiten-Abo
- `public/upsell-reise.html` - Landing Page Reise-Guide
- `public/upsell-erstehilfe.html` - Landing Page Erste-Hilfe Guide
