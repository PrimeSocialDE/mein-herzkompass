// /api/zusatzmodul/download?key=pulling
// Liefert das Zusatzmodul-PDF des eingeloggten Members fuer Re-Downloads
// im Dashboard. Auth-Check: der eingeloggte User muss das Modul auch
// wirklich gekauft haben (Lookup in wauwerk_leads.upsell_modules).

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member-auth-server";
import {
  listPurchasedZusatzmodule,
  TRAININGS_ZUSATZMODUL_LABELS,
  TRAININGS_ZUSATZMODUL_KEYS,
  type TrainingsZusatzmodulKey,
} from "@/lib/member-db";
import { createMemberAdminClient } from "@/lib/member-auth-server";

function isValidKey(k: string): k is TrainingsZusatzmodulKey {
  return (TRAININGS_ZUSATZMODUL_KEYS as readonly string[]).includes(k);
}

async function getDogNameForEmail(email: string): Promise<string> {
  const admin = createMemberAdminClient();
  // 1) member_users
  const { data: member } = await admin
    .from("member_users")
    .select("dog_name")
    .ilike("email", email)
    .maybeSingle();
  if (member?.dog_name) return member.dog_name;
  // 2) wauwerk_leads
  const { data: lead } = await admin
    .from("wauwerk_leads")
    .select("dog_name")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return lead?.dog_name || "deinen Hund";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key || !isValidKey(key)) {
    return NextResponse.json(
      { error: `Ungültiger Modul-Key: "${key}"` },
      { status: 400 }
    );
  }

  const user = await getCurrentMember();
  if (!user?.email) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // Auth-Check: hat der User dieses Modul wirklich gekauft?
  const purchased = await listPurchasedZusatzmodule(user.email);
  if (!purchased.includes(key)) {
    return NextResponse.json(
      { error: "Dieses Modul wurde nicht gekauft" },
      { status: 403 }
    );
  }

  const dogName = await getDogNameForEmail(user.email);
  const label = TRAININGS_ZUSATZMODUL_LABELS[key];

  // Sprache des Members (answers.lang) — PL nutzt den polnischen Generator.
  const admin = createMemberAdminClient();
  const { data: langLead } = await admin
    .from("wauwerk_leads")
    .select("answers")
    .ilike("email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isPL = String((langLead?.answers as any)?.lang || "").toLowerCase() === "pl";

  // PDF on-the-fly bauen
  // @ts-ignore — mjs ohne Types, aber zur Laufzeit erreichbar
  const { buildPdf } = isPL
    ? await import("@/generate-zusatzmodul-pdf.pl.mjs")
    : await import("@/generate-zusatzmodul-pdf.mjs");
  const pdfBytes: Uint8Array = await buildPdf({
    dogName,
    dogBreed: isPL ? "kundelek" : "Mischling",
    moduleKey: key,
    verbose: false,
  });

  const filename = `Pfoten-Plan-${label.replace(/[^a-zA-Z0-9-]/g, "-")}-${dogName.replace(/[^a-zA-Z0-9-]/g, "") || "Hund"}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
