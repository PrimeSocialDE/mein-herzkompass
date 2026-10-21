// Check-in der Plan-Verlängerung (public/weiter.html).
//
// GET  ?lead_id=&email=  -> Hundename, Frist, ob schon bestellt
// POST { lead_id, email, klappt, klappt_nicht, neu } -> speichert answers.verl_checkin
//
// lead_id UND email müssen zusammenpassen (beides steht im Link der Mail),
// sonst 404. answers wird frisch gelesen und gemergt, nie ersetzt.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ladeLead(leadId: string, email: string) {
  if (!leadId || !email) return null;
  const { data } = await supabase
    .from("wauwerk_leads")
    .select("id, email, dog_name, answers")
    .eq("id", leadId)
    .maybeSingle();
  if (!data || String(data.email || "").trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return data as { id: string; email: string; dog_name: string | null; answers: Record<string, any> | null };
}

const kap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const feld = (v: any, max: number) => String(v || "").replace(/[<>]/g, "").trim().slice(0, max);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lead = await ladeLead(searchParams.get("lead_id") || "", searchParams.get("email") || "");
  if (!lead) return NextResponse.json({ ok: false }, { status: 404 });
  const a = lead.answers || {};
  return NextResponse.json({
    ok: true,
    dog: kap(String(lead.dog_name || a.dog_name || "").trim()) || null,
    gender: a.dog_gender || null,
    frist: a.verl_frist || null,
    up_frist: a.verl_up_frist || null,
    checkin_da: !!a.verl_checkin,
    bestellt: !!a.verl_bestellt,
  });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const lead = await ladeLead(String(body.lead_id || ""), String(body.email || ""));
  if (!lead) return NextResponse.json({ ok: false }, { status: 404 });
  const checkin = {
    klappt: feld(body.klappt, 600),
    klappt_nicht: feld(body.klappt_nicht, 1200),
    neu: feld(body.neu, 600),
    at: new Date().toISOString(),
  };
  if (checkin.klappt_nicht.length < 5) {
    return NextResponse.json({ ok: false, error: "klappt_nicht fehlt" }, { status: 400 });
  }
  const { data: frisch } = await supabase.from("wauwerk_leads").select("answers").eq("id", lead.id).maybeSingle();
  const { error } = await supabase
    .from("wauwerk_leads")
    .update({ answers: { ...((frisch?.answers as any) || lead.answers || {}), verl_checkin: checkin } })
    .eq("id", lead.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
