// app/api/upsell-cron/route.ts
// Daily cron endpoint for sending upsell emails to paid leads
// Called by Make.com or Vercel Cron with ?secret=pfoten-cron-2024

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const maxDuration = 120;

const BREVO_API_KEY = process.env.BREVO_API_KEY!;

interface UpsellScheduleItem {
  day: number;
  type: string;
  subject: (dogName: string) => string;
  htmlContent: (dogName: string, email: string, leadId: string) => string;
}

// Active Schedule: only these 3 products until Zweithund & Abo are production-ready
const UPSELL_SCHEDULE: UpsellScheduleItem[] = [
  {
    day: 10,
    type: "ernaehrung",
    subject: (dogName) =>
      `Der richtige Ernaehrungsplan fuer ${dogName} - passend zu Rasse und Alter`,
    htmlContent: (dogName, email, leadId) => buildEmail({
      dogName,
      email,
      leadId,
      type: "ernaehrung",
      headline: `Der perfekte Ernaehrungsplan fuer ${dogName}`,
      intro: `Hallo! Wir hoffen, ${dogName} macht tolle Fortschritte mit dem Trainingsplan. Neben dem Training ist die richtige Ernaehrung einer der wichtigsten Bausteine fuer ein glueckliches Hundeleben.`,
      description: `Unser personalisierter Ernaehrungsplan ist genau auf ${dogName} abgestimmt - basierend auf Rasse, Alter und Aktivitaetslevel. Du erfaehrst, was ${dogName} wirklich braucht: die richtigen Fuetterungszeiten, optimale Mengen und gesunde Snacks fuer zwischendurch.`,
      benefits: [
        "Fuetterungsplan abgestimmt auf Rasse und Alter",
        "Optimale Mengen und Fuetterungszeiten",
        "Gesunde Snack-Alternativen",
        "Lebensmittel die dein Hund meiden sollte",
      ],
      price: "24,99",
      ctaText: "Ernaehrungsplan sichern",
      emoji: "\uD83E\uDD5B",
    }),
  },
  {
    day: 25,
    type: "reise",
    subject: (dogName) =>
      `Mit ${dogName} in den Urlaub? So klappt's stressfrei`,
    htmlContent: (dogName, email, leadId) => buildEmail({
      dogName,
      email,
      leadId,
      type: "reise",
      headline: `Stressfrei reisen mit ${dogName}`,
      intro: `Planst du den naechsten Urlaub und ${dogName} soll mit? Mit der richtigen Vorbereitung wird die Reise fuer euch beide entspannt und sicher.`,
      description: `Unser Reise-Guide deckt alles ab: Auto, Zug und Flugzeug - was du bei jeder Reiseart beachten musst. Dazu eine komplette Packliste, Tipps zur Unterkunftssuche mit Hund und wichtige Notfall-Nummern im Ausland.`,
      benefits: [
        "Tipps fuer Auto, Zug und Flugzeug",
        "Komplette Packliste fuer den Urlaub",
        "Hundefreundliche Unterkuenfte finden",
        "Notfall-Nummern fuer das Ausland",
      ],
      price: "19,99",
      ctaText: "Reise-Guide sichern",
      emoji: "\u2708\uFE0F",
    }),
  },
  {
    day: 45,
    type: "erstehilfe",
    subject: () => "Erste-Hilfe fuer Hunde - was du wissen musst",
    htmlContent: (dogName, email, leadId) => buildEmail({
      dogName,
      email,
      leadId,
      type: "erstehilfe",
      headline: "Erste-Hilfe fuer Hunde",
      intro: `Wir hoffen, ${dogName} geht es immer gut! Aber im Notfall zaehlt jede Sekunde. Mit unserem Erste-Hilfe Guide bist du auf alles vorbereitet.`,
      description: `Die wichtigsten Erste-Hilfe-Massnahmen fuer Hunde auf einen Blick: Was tun bei Vergiftung, Hitzschlag, Verletzungen oder Insektenstichen? Klare Schritt-fuer-Schritt Anleitungen, die im Ernstfall Leben retten koennen.`,
      benefits: [
        "Sofort-Massnahmen bei Vergiftung",
        "Hitzschlag erkennen und handeln",
        "Wundversorgung und Verband-Techniken",
        "Insektenstiche und allergische Reaktionen",
      ],
      price: "14,99",
      ctaText: "Erste-Hilfe Guide sichern",
      emoji: "\u26D1\uFE0F",
    }),
  },
];

// Safety cap: never send more than this per cron run (guards against unexpected backlogs)
const MAX_SENDS_PER_RUN = 300;

interface BuildEmailParams {
  dogName: string;
  email: string;
  leadId: string;
  type: string;
  headline: string;
  intro: string;
  description: string;
  benefits: string[];
  price: string;
  priceInfo?: string;
  ctaText: string;
  emoji: string;
}

function buildEmail(params: BuildEmailParams): string {
  const productUrl = `https://www.pfoten-plan.de/upsell-${params.type}.html?email=${encodeURIComponent(params.email)}&lead_id=${encodeURIComponent(params.leadId)}`;
  const benefitsHtml = params.benefits
    .map(
      (b) =>
        `<tr><td style="padding:4px 8px 4px 0;vertical-align:top;color:#22C55E;font-size:16px;">&#10003;</td><td style="padding:4px 0;font-size:14px;color:#444;">${b}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#1a1a1a;">

    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;margin-bottom:12px;">${params.emoji}</div>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#1a1a1a;">${params.headline}</h1>
    </div>

    <div style="background:white;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;">
      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">${params.intro}</p>
      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">${params.description}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${benefitsHtml}
      </table>

      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:28px;font-weight:800;color:#C4A576;">&euro;${params.price}</span>
        ${params.priceInfo ? `<br><span style="font-size:13px;color:#888;">${params.priceInfo}</span>` : '<br><span style="font-size:13px;color:#888;">Einmalzahlung</span>'}
      </div>

      <div style="text-align:center;">
        <a href="${productUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#C4A576,#8B7355);color:white;text-decoration:none;border-radius:10px;font-size:16px;font-weight:700;">${params.ctaText}</a>
      </div>

      <p style="text-align:center;font-size:12px;color:#166534;margin:12px 0 0;font-weight:500;">30 Tage Geld-zurueck-Garantie</p>
    </div>

    <p style="font-size:13px;color:#999;text-align:center;line-height:1.5;">
      Fragen? Schreib uns an <a href="mailto:support@pfoten-plan.de" style="color:#C4A576;">support@pfoten-plan.de</a><br>
      Liebe Gruesse, dein Pfoten-Plan Team
    </p>
  </div>
</body>
</html>`;
}

function getDogNameFromLead(lead: any): string {
  // Try dog_name field first
  if (lead.dog_name) return lead.dog_name;
  // Try answers JSON
  if (lead.answers && typeof lead.answers === "object") {
    if (lead.answers.dog_name) return lead.answers.dog_name;
    if (lead.answers.dogName) return lead.answers.dogName;
    if (lead.answers.name) return lead.answers.name;
  }
  return "deinen Hund";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "pfoten-cron-2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch schedule entries — only leads that are explicitly enrolled
    // upsell_start_date <= today means they're eligible for processing
    const todayStr = new Date().toISOString().slice(0, 10);
    const schedules: Array<{ lead_id: string; user_email: string; upsell_start_date: string }> = [];
    let sPage = 0;
    while (true) {
      const { data, error } = await supabase
        .from("upsell_schedule")
        .select("lead_id, user_email, upsell_start_date")
        .lte("upsell_start_date", todayStr)
        .order("upsell_start_date", { ascending: true })  // oldest schedules first
        .range(sPage * 1000, (sPage + 1) * 1000 - 1);
      if (error) {
        console.error("Error fetching upsell_schedule:", error);
        return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      schedules.push(...data);
      if (data.length < 1000) break;
      sPage++;
    }

    if (schedules.length === 0) {
      return NextResponse.json({ message: "No scheduled leads eligible today", sent: 0 });
    }

    // 2. Fetch lead details for these schedule entries
    const leadIds = [...new Set(schedules.map((s) => s.lead_id))];
    const leadMap = new Map<string, any>();
    for (let i = 0; i < leadIds.length; i += 200) {
      const chunk = leadIds.slice(i, i + 200);
      const { data } = await supabase
        .from("wauwerk_leads")
        .select("id, email, dog_name, answers, status")
        .in("id", chunk);
      (data || []).forEach((l: any) => leadMap.set(l.id, l));
    }

    // 3. Fetch all existing upsell tracking records to avoid duplicates
    const sentSet = new Set<string>();
    let tPage = 0;
    while (true) {
      const { data, error } = await supabase
        .from("upsell_tracking")
        .select("user_email, upsell_type")
        .range(tPage * 1000, (tPage + 1) * 1000 - 1);
      if (error) {
        console.error("Error fetching tracking:", error);
        return NextResponse.json({ error: "Failed to fetch tracking" }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      data.forEach((t: any) => sentSet.add(`${t.user_email}::${t.upsell_type}`));
      if (data.length < 1000) break;
      tPage++;
    }

    // 4. Build send queue — capped at MAX_SENDS_PER_RUN
    const now = new Date();
    const queue: Array<{ schedule: any; lead: any; item: UpsellScheduleItem }> = [];
    for (const schedule of schedules) {
      const lead = leadMap.get(schedule.lead_id);
      if (!lead || !lead.email) continue;
      // Skip if lead status is no longer paid (e.g. refunded)
      if (!["paid", "plan_sent"].includes(lead.status)) continue;

      const startDate = new Date(schedule.upsell_start_date + "T00:00:00Z");
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      for (const item of UPSELL_SCHEDULE) {
        if (daysSinceStart < item.day) continue;
        const key = `${lead.email}::${item.type}`;
        if (sentSet.has(key)) continue;
        queue.push({ schedule, lead, item });
        if (queue.length >= MAX_SENDS_PER_RUN) break;
      }
      if (queue.length >= MAX_SENDS_PER_RUN) break;
    }

    console.log(`Queued ${queue.length} emails (cap: ${MAX_SENDS_PER_RUN})`);

    // 5. Send emails
    let totalSent = 0;
    const errors: string[] = [];
    for (const { lead, item } of queue) {
      const email = lead.email;
      const dogName = getDogNameFromLead(lead);
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Pfoten-Plan", email: "support@pfoten-plan.de" },
            to: [{ email }],
            subject: item.subject(dogName),
            htmlContent: item.htmlContent(dogName, email, lead.id),
          }),
        });

        if (!brevoRes.ok) {
          const errText = await brevoRes.text();
          console.error(`Brevo error for ${email} (${item.type}):`, brevoRes.status, errText);
          errors.push(`${email}:${item.type} - Brevo ${brevoRes.status}`);
          continue;
        }

        const { error: insertError } = await supabase.from("upsell_tracking").insert({
          user_email: email,
          lead_id: lead.id,
          upsell_type: item.type,
          email_sent_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error(`Tracking insert error for ${email} (${item.type}):`, insertError);
          errors.push(`${email}:${item.type} - DB insert failed`);
        } else {
          sentSet.add(`${email}::${item.type}`);
          totalSent++;
          console.log(`Upsell sent: ${email} -> ${item.type}`);
        }
      } catch (err) {
        console.error(`Error sending to ${email} (${item.type}):`, err);
        errors.push(`${email}:${item.type} - ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      leadsScheduled: schedules.length,
      queuedToday: queue.length,
      emailsSent: totalSent,
      cappedAt: MAX_SENDS_PER_RUN,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Upsell cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
