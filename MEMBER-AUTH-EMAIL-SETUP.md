# Mitglieder-Auth Email-Setup (Magic-Link via Brevo)

Damit User die schöne Pfoten-Plan-Mail kriegen statt der trockenen
Default-Supabase-Mail muss der **Send Email Hook** in Supabase aktiviert
und auf unseren Endpoint verweisen.

## Was passieren soll

1. User trägt E-Mail auf `/mitglieder/login` ein
2. Supabase erzeugt Magic-Link-Token
3. **Statt** seine Default-Mail zu senden, ruft Supabase unseren Endpoint
   `/api/mitglieder/auth-hook/send-email` auf
4. Wir bauen die Pfoten-Plan-Mail (mit Logo, warmer Tonalität) und schicken
   sie via Brevo

## Setup in Supabase

### 1. Hook-Secret generieren

Generiere einen sicheren Random-String, z.B.:
```
openssl rand -base64 32
```

### 2. Secret als Env-Var hinterlegen

In **Vercel** (Production + Preview + Development):
```
SUPABASE_AUTH_HOOK_SECRET=<dein-secret>
```

In **`.env.local`** lokal:
```
SUPABASE_AUTH_HOOK_SECRET=<dein-secret>
```

### 3. Hook in Supabase Dashboard registrieren

1. Gehe zu **Supabase Dashboard** → dein Projekt
2. Sidebar: **Authentication** → **Hooks** (NICHT Email Templates!)
3. Klick **"Add a new hook"** unter "Send Email Hook"
4. Wähle **Type: HTTPS**
5. **URL:** `https://www.pfoten-plan.de/api/mitglieder/auth-hook/send-email`
   - Achtung: Production-Domain, NICHT localhost
   - Wenn du lokal testen willst, nutze ngrok o.ä.
6. **Secret:** Paste das Secret aus Schritt 1
   - Supabase erlaubt Format `v1,whsec_<value>` oder direkt `<value>` —
     unser Code akzeptiert beides
7. **Enabled:** auf an
8. Speichern

### 4. Testen

1. Auf `/mitglieder/login` E-Mail eingeben + abschicken
2. **In Vercel-Logs** (Production): suche nach `[auth-hook]`
   - `[auth-hook] magiclink mail OK an X@Y.com` → alles top
   - `[auth-hook] FEHLT: ...` → Env-Var fehlt
   - `[auth-hook] Signatur-Verifikation FEHLGESCHLAGEN` → Secret stimmt nicht
   - `[auth-hook] Brevo failed: ...` → Brevo-Konfig pruefen
3. Mail sollte als **Pfoten-Plan-Branded-Mail** ankommen, nicht als
   Default-Supabase-Mail

## Common Issues

### Ich kriege weiter die alte Supabase-Mail

→ Hook ist im Dashboard nicht aktiviert, oder URL stimmt nicht. In den
  Vercel-Logs taucht KEIN `[auth-hook]`-Eintrag auf wenn du dich
  einloggst. Pruefe Step 3 im Setup.

### Hook gibt 401 / "invalid_signature"

→ Secret stimmt nicht. Hol dir das Secret aus dem Supabase-Dashboard
  und vergleich es mit `SUPABASE_AUTH_HOOK_SECRET` in Vercel. Code
  toleriert das Praefix `v1,whsec_` automatisch.

### Mail kommt an, Login-Link funktioniert nicht (404 oder "no_code")

→ Magic-Link-URL falsch. Pruefe ob `NEXT_PUBLIC_SUPABASE_URL` in Vercel
  gesetzt ist und auf deine Supabase-Project-URL zeigt
  (z.B. `https://abc.supabase.co`). Die URL muss `/auth/v1/verify`
  drauf bekommen — wir bauen das selbst aus dem Env-Var.

### Mail landet im Spam

Brevo-Sender muss verifiziert sein:
1. In Brevo: **Senders & IP** → Domain `pfoten-plan.de` als verifiziert
2. **DNS** sollte SPF/DKIM-Records von Brevo enthalten
3. Pruefe mit https://www.mail-tester.com (Score sollte >7 sein)

## Was sich kuerzlich geaendert hat

- **URL-Bug fix:** Magic-Link-URL nutzt jetzt `SUPABASE_URL`
  (Project-URL) statt `site_url` (App-URL). Vorher hat der Link
  auf `pfoten-plan.de/auth/v1/verify` gezeigt → 404. Jetzt korrekt
  auf `<projekt>.supabase.co/auth/v1/verify`.
- **Email-Design polished:** Logo-Header, schoene Card mit Schatten,
  3-Schritte-Erklaerung, Plain-Text-Link-Fallback wenn Button kaputt.
- **Bessere Logs:** Jeder Fehlerpfad logged jetzt klar was schief
  laeuft, mit Hint zur Behebung.
