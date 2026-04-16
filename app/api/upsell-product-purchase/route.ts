// app/api/upsell-product-purchase/route.ts
// Handles post-purchase: updates tracking, generates content via Claude, sends via Brevo

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const maxDuration = 120;

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const PRODUCT_NAMES: Record<string, string> = {
  ernaehrung: "Ernährungsplan",
  zweithund: "Zweithund-Guide",
  abo: "Jahreszeiten-Abo",
  reise: "Reise-Guide für Hundebesitzer",
  erstehilfe: "Erste-Hilfe Guide für Hunde",
};

function buildClaudePrompt(
  type: string,
  dogName: string,
  breed: string,
  age: string,
  weight: string = '',
  activity: string = '',
  allergy: string = ''
): string {
  const actLabels: Record<string, string> = { wenig: 'wenig aktiv', normal: 'normal aktiv', sehr: 'sehr aktiv' };
  const actDisplay = actLabels[activity] || activity || 'normal aktiv';
  const weightDisplay = weight || 'unbekannt';
  const allergyDisplay = allergy && allergy !== 'Keine bekannt' ? `Allergie/Unverträglichkeit: ${allergy}` : 'Keine bekannten Allergien';

  const prompts: Record<string, string> = {
    ernaehrung: `Erstelle einen personalisierten Ernährungsplan für ${dogName} (${breed}, Alter: ${age}, Gewicht: ${weightDisplay}, Aktivität: ${actDisplay}, ${allergyDisplay}). Enthält: Tagesplan für Fütterung mit konkreten Grammangaben passend zum Gewicht, empfohlene Futtermengen, gesunde Snacks, was der Hund nicht essen darf, Fütterungszeiten. Berücksichtige die Aktivität und Allergien bei den Empfehlungen. Alles auf Deutsch, praktisch und direkt umsetzbar. Keine Markdown-Formatierung.`,
    zweithund: `Erstelle einen Guide für Hundebesitzer die einen zweiten Hund aufnehmen möchten. Der erste Hund heißt ${dogName} (${breed}). Enthält: Welche Rassen passen, Eingewöhnung Schritt für Schritt, häufige Fehler, Ressourcen-Aufteilung, Timeline für die ersten 4 Wochen.`,
    abo: `Erstelle saisonale Trainingstipps und Übungen für den aktuellen Monat für ${dogName}. Enthält: 4 saisonale Übungen, Gesundheitstipps für die Jahreszeit, Aktivitäts-Ideen.`,
    reise: `Erstelle einen Reise-Guide für Hundebesitzer mit ${dogName}. Enthält: Vorbereitung, Packliste, Auto/Zug/Flugzeug Tipps, Unterkunft mit Hund, Notfall-Nummern, Einreisebestimmungen EU.`,
    erstehilfe: `Erstelle einen Erste-Hilfe Guide für Hundebesitzer von ${dogName}. Enthält: Die 10 wichtigsten Notfälle (Vergiftung, Hitzschlag, Verletzung, Insektenstich, Verschlucken, Durchfall, Erbrechen, Zeckenbiss, Pfotenverletzung, Schock), jeweils mit Sofort-Maßnahmen in 3-5 Schritten. Wann zum Tierarzt. Notfall-Apotheke für Hunde.`,
  };

  return prompts[type] || prompts["erstehilfe"];
}

function buildSystemPrompt(type: string): string {
  const systemPrompts: Record<string, string> = {
    ernaehrung:
      "Du bist ein erfahrener Hunde-Ernährungsberater. Erstelle praktische, direkt umsetzbare Ernährungspläne auf Deutsch. Verwende Du-Form. Strukturiere den Plan mit klaren Überschriften und Absätzen. Keine Markdown-Formatierung, sondern einfachen Text mit Zeilenumbrüchen.",
    zweithund:
      "Du bist ein erfahrener Hundetrainer und Verhaltensberater. Erstelle einen praktischen Guide für die Aufnahme eines zweiten Hundes. Verwende Du-Form, schreibe auf Deutsch. Strukturiere mit klaren Überschriften und praktischen Tipps. Keine Markdown-Formatierung.",
    abo: "Du bist ein erfahrener Hundetrainer. Erstelle saisonale Trainingstipps und Übungen passend zur aktuellen Jahreszeit. Verwende Du-Form, schreibe auf Deutsch. Praktisch und direkt umsetzbar. Keine Markdown-Formatierung.",
    reise:
      "Du bist ein Experte für Reisen mit Hund. Erstelle einen umfassenden, praktischen Reise-Guide auf Deutsch. Verwende Du-Form. Strukturiere mit klaren Abschnitten. Keine Markdown-Formatierung.",
    erstehilfe:
      "Du bist ein Tierarzt und Erste-Hilfe-Experte für Hunde. Erstelle einen lebensrettenden Erste-Hilfe Guide auf Deutsch. Verwende Du-Form. Klare Schritt-für-Schritt Anleitungen. Keine Markdown-Formatierung.",
  };

  return systemPrompts[type] || systemPrompts["erstehilfe"];
}

async function generateContentWithClaude(
  type: string,
  dogName: string,
  breed: string,
  age: string,
  weight: string = '',
  activity: string = '',
  allergy: string = ''
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(type),
      messages: [
        {
          role: "user",
          content: buildClaudePrompt(type, dogName, breed, age, weight, activity, allergy),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API error:", response.status, errText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((c: any) => c.type === "text");
  return textBlock?.text || "Inhalt konnte nicht generiert werden.";
}

function textToHtml(text: string): string {
  // Convert plain text to nicely formatted HTML
  return text
    .split("\n\n")
    .map((paragraph: string) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";
      // Check if it looks like a heading (short, no period at end)
      if (
        trimmed.length < 80 &&
        !trimmed.endsWith(".") &&
        !trimmed.endsWith(":") &&
        !trimmed.includes("\n")
      ) {
        return `<h2 style="font-size:18px;font-weight:700;color:#2C2C2E;margin:24px 0 8px;border-bottom:2px solid #C4A576;padding-bottom:6px;">${trimmed}</h2>`;
      }
      // Regular paragraph - handle line breaks within
      const htmlContent = trimmed
        .split("\n")
        .map((line: string) => line.trim())
        .join("<br>");
      return `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 12px;">${htmlContent}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildDeliveryEmail(
  type: string,
  dogName: string,
  contentHtml: string
): string {
  const productName = PRODUCT_NAMES[type] || "Pfoten-Plan Produkt";
  const icons: Record<string, string> = {
    ernaehrung: "&#129367;",
    zweithund: "&#128054;",
    abo: "&#128197;",
    reise: "&#9992;&#65039;",
    erstehilfe: "&#127973;",
  };
  const icon = icons[type] || "&#128062;";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#2C2C2E;">

    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:40px;margin-bottom:12px;">${icon}</div>
      <h1 style="font-size:24px;font-weight:800;margin:0 0 8px;color:#2C2C2E;">${productName} f&uuml;r ${dogName}</h1>
      <p style="font-size:15px;color:#888;margin:0;">Dein personalisierter Inhalt ist fertig!</p>
    </div>

    <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;margin-bottom:24px;text-align:center;">
      <p style="font-size:14px;color:#166534;font-weight:600;margin:0;">&#10003; Zahlung erfolgreich &ndash; vielen Dank!</p>
    </div>

    <div style="background:white;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:24px;">
      ${contentHtml}
    </div>

    <div style="background:#FAFAFA;border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="font-size:13px;color:#666;margin:0 0 4px;"><strong>Tipp:</strong> Speichere diese Email oder drucke sie aus!</p>
      <p style="font-size:12px;color:#999;margin:0;">Du kannst jederzeit darauf zur&uuml;ckgreifen.</p>
    </div>

    <p style="font-size:13px;color:#999;text-align:center;line-height:1.5;">
      Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
      Liebe Gr&uuml;&szlig;e, dein Pfoten-Plan Team
    </p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      paymentIntentId,
      type,
      email,
      leadId,
      dogName: rawDogName,
      dogBreed: quizBreed,
      dogAge: quizAge,
      dogWeight,
      dogActivity,
      dogAllergy,
    } = body;

    if (!type || !email) {
      return NextResponse.json(
        { error: "Missing required fields (type, email)" },
        { status: 400 }
      );
    }

    const dogName = rawDogName || "deinen Hund";

    // 1. Update upsell_tracking
    const { error: updateError } = await supabase
      .from("upsell_tracking")
      .update({
        purchased: true,
        purchased_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntentId || null,
      })
      .eq("user_email", email)
      .eq("upsell_type", type);

    if (updateError) {
      console.error("Tracking update error:", updateError);
      // Don't fail the whole request, still generate and send content
    }

    // If no tracking row existed yet (e.g. direct purchase without cron email), insert one
    if (!updateError) {
      const { data: existingRows } = await supabase
        .from("upsell_tracking")
        .select("id")
        .eq("user_email", email)
        .eq("upsell_type", type)
        .limit(1);

      if (!existingRows || existingRows.length === 0) {
        await supabase.from("upsell_tracking").insert({
          user_email: email,
          lead_id: leadId || null,
          upsell_type: type,
          purchased: true,
          purchased_at: new Date().toISOString(),
          stripe_payment_intent: paymentIntentId || null,
        });
      }
    }

    // 2. Get lead data for personalization (Quiz-Daten haben Vorrang)
    let breed = quizBreed || "Hund";
    let age = quizAge || "unbekannt";

    if (leadId) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("dog_name, answers, breed")
        .eq("id", leadId)
        .single();

      if (lead) {
        if (!quizBreed) {
          if (lead.breed) breed = lead.breed;
          else if (lead.answers?.breed) breed = lead.answers.breed;
          else if (lead.answers?.dog_breed) breed = lead.answers.dog_breed;
        }

        if (!quizAge) {
          if (lead.answers?.age) age = lead.answers.age;
          else if (lead.answers?.dog_age) age = lead.answers.dog_age;
        }
      }
    }

    // 3. Generate content with Claude (mit Quiz-Daten!)
    console.log(
      `Generating ${type} content for ${dogName} (${breed}, ${age}, ${dogWeight || '?'}, ${dogActivity || '?'})...`
    );
    const generatedText = await generateContentWithClaude(
      type,
      dogName,
      breed,
      age,
      dogWeight,
      dogActivity,
      dogAllergy
    );

    // 4. Convert to HTML and send via Brevo
    const contentHtml = textToHtml(generatedText);
    const emailHtml = buildDeliveryEmail(type, dogName, contentHtml);
    const productName = PRODUCT_NAMES[type] || "Pfoten-Plan Produkt";

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject: `Dein ${productName} für ${dogName} ist fertig!`,
        htmlContent: emailHtml,
      }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error("Brevo delivery error:", brevoRes.status, errText);
      return NextResponse.json(
        { error: "Email konnte nicht gesendet werden", details: errText },
        { status: 500 }
      );
    }

    console.log(`${type} content sent to ${email} for ${dogName}`);

    return NextResponse.json({
      success: true,
      type,
      email,
      dogName,
      message: `${productName} wurde generiert und per Email gesendet.`,
    });
  } catch (err) {
    console.error("Upsell product purchase error:", err);
    return NextResponse.json(
      { error: "Verarbeitung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
