# Mitglieder-Auth Email-Setup

Damit der Login mit der schönen Pfoten-Plan-Mail funktioniert
(statt der englischen Default-Supabase-Mail) und der Magic-Link
zuverlässig auf JEDEM Gerät klappt — auch wenn der User die Mail
auf dem Handy öffnet aber sich am PC angemeldet hat.

## Architektur (kurz)

1. User trägt E-Mail auf `/mitglieder/login` ein
2. Browser ruft `supabase.auth.signInWithOtp({ email })` auf
3. **Statt der Default-Mail** ruft Supabase unseren Hook auf:
   `/api/mitglieder/auth-hook/send-email`
4. Hook baut die schöne Pfoten-Plan-Mail und sendet via Brevo
5. Mail enthält:
   - Magic-Link zu unserer eigenen Callback-URL
     (mit `token_hash` — kein PKCE nötig)
   - 6-stelligen Code als Alternative
6. User klickt Link oder gibt Code auf der Login-Page ein
7. Callback verifiziert server-seitig via `verifyOtp` →
   Session-Cookies werden gesetzt → User landet im Mitgliederbereich

**Wichtig:** Der Magic-Link geht direkt auf
`pfoten-plan.de/mitglieder/callback?token_hash=...&type=...&next=...`
und NICHT auf den Supabase-Verify-Endpoint. Dadurch funktioniert er
auch cross-device, weil server-seitig verifiziert wird.

## Was du in Supabase tun musst

### 1. Hook-Secret generieren

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
2. Sidebar: **Authentication** → **Hooks**
3. Klick **"Add a new hook"** unter **"Send Email Hook"**
4. **Type:** HTTPS
5. **URL:** `https://www.pfoten-plan.de/api/mitglieder/auth-hook/send-email`
   - Achtung: Production-Domain. Wenn du lokal testest: ngrok-Tunnel.
6. **Secret:** das Secret aus Schritt 1
   - Format `v1,whsec_<value>` ODER direkt `<value>` — Code akzeptiert beides
7. **Enable hook**
8. Speichern

### 4. Kontrolle

1. Auf `/mitglieder/login` neue E-Mail eingeben + abschicken
2. **Vercel-Logs** → suche `[auth-hook]`:
   - `[auth-hook] magiclink mail OK an X@Y.com` → läuft
   - `[auth-hook] FEHLT: ...` → Env-Var fehlt
   - `[auth-hook] Signatur-Verifikation FEHLGESCHLAGEN` → Secret stimmt nicht
3. Mail muss als **Pfoten-Plan-Mail** ankommen (mit Logo, deutsch).
   Wenn englische Default-Mail kommt → Hook ist nicht aktiv.

## Was der Hook bei aktivierter Konfiguration macht

Empfängt Payload von Supabase mit `email_data.token_hash` etc.,
baut eine URL der Form:

```
https://www.pfoten-plan.de/mitglieder/callback
  ?token_hash=<HASH>
  &type=magiclink
  &next=/mitglieder
```

Plus den 6-stelligen `token` als Code-Alternative — beides in der Mail.

## Was der Callback macht

Empfängt entweder:
- `?token_hash=&type=` → `verifyOtp({ token_hash, type })` — neuer Pfad,
  cross-device-tauglich
- `?code=` → `exchangeCodeForSession(code)` — alter PKCE-Pfad als
  Fallback (z.B. wenn Default-Supabase-Mail genutzt wird)

Bei Erfolg: Profil sicherstellen, Cookies setzen, Redirect zu `next`.
Bei Fehler: Redirect zu `/mitglieder/login?error=<grund>` mit
verständlicher Fehlermeldung in der Login-UI.

## Common Issues

### Default-Englische-Mail kommt weiterhin

→ Hook in Supabase Dashboard ist nicht aktiviert. Pruefe Step 3
  oben. In Vercel-Logs taucht KEIN `[auth-hook]`-Eintrag auf.

### Hook gibt 401 / "invalid_signature"

→ Secret stimmt nicht. Vergleiche Supabase-Dashboard mit
  `SUPABASE_AUTH_HOOK_SECRET` in Vercel. Praefix `v1,whsec_` wird
  automatisch toleriert.

### Magic-Link funktioniert nicht (User landet wieder auf Login)

Mit dem neuen Code SOLLTE das nicht mehr passieren. Falls doch:
- Schau in Vercel-Logs nach `[mitglieder/callback]` Eintraegen
- Pruefe ob in der Mail die URL korrekt mit `token_hash=...` gebaut ist
- Falls Token abgelaufen ist (>1h): User soll neuen Link anfordern.
  Login-Page zeigt jetzt klare Fehlermeldung.

### Mail landet im Spam

Brevo-Sender muss verifiziert sein:
1. Brevo: **Senders & IP** → Domain `pfoten-plan.de` verifiziert
2. **DNS** sollte SPF/DKIM-Records von Brevo haben
3. Test: https://www.mail-tester.com (Score >7 anstreben)

## Was sich kuerzlich geaendert hat

- **Magic-Link nutzt jetzt token_hash auf unsere eigene Callback-URL**
  (statt Supabase's verify-Endpoint mit PKCE) → cross-device-tauglich,
  funktioniert auch wenn Mail auf anderem Geraet geoeffnet wird
- **Callback unterstuetzt beide Flows** (token_hash + code) damit auch
  Default-Supabase-Mails noch funktionieren falls Hook mal nicht greift
- **Login-Page zeigt deutsche Fehlermeldungen** wenn Callback einen
  Error meldet (`?error=link_abgelaufen` etc.)
