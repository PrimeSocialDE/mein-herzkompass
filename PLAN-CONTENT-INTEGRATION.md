# Plan-Content-Integration (Make.com → Mitgliederbereich)

Bisher schickt Make.com nur die fertige PDF per E-Mail raus.
Damit der **Inhalt auch in der App** unter `/mitglieder/modul/[slug]`
sichtbar wird (für das Plan-Coaching), muss Make.com die strukturierte
JSON, die ohnehin schon für die PDF-Generierung erzeugt wird, **zusätzlich**
an einen App-Endpoint pushen.

## Was ist passiert (Code)

1. Neue Tabelle `member_plan_content` (siehe `supabase-plan-content-migration.sql`):
   - **Append-only** — jeder Push legt eine neue Zeile an
   - Alte Versionen bleiben auf ewig erhalten (Audit, Rollback)
   - RLS: User darf nur LESEN, niemals UPDATE/DELETE
2. Neuer Endpoint `POST /api/mitglieder/plan-content/save`
3. Neue Komponente `PlanContentRenderer` rendert die JSON als HTML
4. `/mitglieder/modul/[slug]` zeigt den Plan-Content wenn vorhanden,
   sonst Hinweis "wird per E-Mail geschickt"

## Was du in Supabase tun musst

```sql
-- Migration ausführen:
\i supabase-plan-content-migration.sql
```

Tabelle `member_plan_content` mit RLS wird angelegt. Bestehende Daten
werden nicht angefasst.

## Was du in Make.com hinzufügen musst

**An welcher Stelle:** in jedem Make-Szenario das einen Plan generiert
und per E-Mail verschickt — direkt **NACH** der PDF-Erzeugung,
**VOR** dem Scenario-Ende.

**Neuer Schritt: HTTP POST**

| Feld | Wert |
|------|------|
| URL | `https://pfoten-plan.de/api/mitglieder/plan-content/save` |
| Method | POST |
| Header | `Authorization: Bearer {{WORKER_TOKEN}}` (env var) |
| Header | `Content-Type: application/json` |
| Body | siehe unten |

**Body-Schema (JSON):**

```json
{
  "email": "{{kunde_email}}",
  "plan_slug": "ernaehrung",
  "plan_title": "Ernährungsplan für {{dog_name}}",
  "content": { ...claude_json_aus_dem_generator... },
  "pdf_url": "https://...supabase.co/.../{{order_id}}.pdf",
  "dog_name": "{{dog_name}}",
  "dog_breed": "{{dog_breed}}",
  "source": "make.com",
  "source_payment_id": "{{mollie_payment_id}}"
}
```

**Plan-Slugs (verwende EINE der folgenden):**
- `analyse` — Erstanalyse (worker/generate)
- `ernaehrung` — Ernährungsplan
- `monatsplan` — Monatsplan
- `reise` — Reise-Guide
- `erstehilfe` — Erste-Hilfe
- `notfall` — Notfall-Guide
- `tagebuch` — Trainings-Tagebuch
- `thema-leinen`, `thema-bellen`, `thema-aggression`, ... (für die 10 Themen-Module aus `lib/member-themen.ts`)

**Wichtig:**
- Slug muss eindeutig sein und mit dem Modul-Slug in der App übereinstimmen
- `content` ist **die komplette Claude-JSON**, NICHT bereinigt (alle Sections)
- Mehrfach-Pushes legen neue Zeilen an — das ist gewollt (Versionshistorie)

## Was du in den `generate-*.mjs` Scripts ergänzen musst

Direkt nach der Claude-JSON-Generation (vor dem PDF-Render):

```js
// Neu: JSON in die App-DB pushen damit es im Mitgliederbereich sichtbar ist
await fetch("https://pfoten-plan.de/api/mitglieder/plan-content/save", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.WORKER_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: customerEmail,
    plan_slug: "ernaehrung",
    plan_title: `Ernährungsplan für ${dogName}`,
    content: claudeData,  // <-- die komplette JSON-Antwort
    pdf_url: signedPdfUrl,  // optional
    dog_name: dogName,
    dog_breed: breed,
    source: "worker-generate",
    source_payment_id: payment_id,  // optional
  }),
});
```

## Was die App damit tut

- `/mitglieder/modul/ernaehrung` ruft `getLatestPlanContent(userId, email, "ernaehrung")` auf
- Holt die **neueste** Zeile aus `member_plan_content` (per `created_at DESC`)
- `PlanContentRenderer` rendert die JSON als HTML mit Sections für `intro`, `morgens/mittags/abends`, `naehrstoffe`, `snacks`, `rezepte`, `verboten`, `wochenplan`, `einkauf` etc.
- "PDF herunterladen"-Button wenn `pdf_url` gesetzt
- Personalisierungs-Hinweis: "für Buddy (Labrador) erstellt am ..."

## Was passiert bei Re-Generation

Wenn ein Kunde z.B. nach 3 Monaten ein Update bekommt:
- Make.com pusht erneut → neue Zeile in `member_plan_content`
- App zeigt automatisch die NEUESTE Zeile
- Alte Version bleibt in der DB (nicht überschrieben)

## Was passiert wenn ein User noch keinen Plan-Content hat

- Modul-Detail-Seite zeigt: "Dein personalisierter Inhalt wird per E-Mail
  ausgeliefert. Sobald er fertig ist, erscheint er auch hier auf der Seite."
- Sobald Make.com einmal pusht → Inhalt da, dauerhaft.

## Sicherheit

- Endpoint ist mit `WORKER_TOKEN` geschützt (gleicher Token wie `/api/worker/generate`)
- RLS auf der Tabelle: nur User selbst darf lesen
- Schreibender Zugriff nur über Service-Role (Make.com via Token)
- `ON DELETE SET NULL` für `user_id` — selbst User-Löschung verliert keinen Inhalt
