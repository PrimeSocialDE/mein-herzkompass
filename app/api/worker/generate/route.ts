// /app/api/worker/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { makeAnalysisPdf } from "@/lib/makePdf";
import { buildBlocksFromAnswers } from "@/lib/analysis";
import { sendAnalysisMail } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const authHeader = req.headers.get("authorization") || "";
    const sentToken = (authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || authHeader).trim();
    const expected = (process.env.WORKER_TOKEN || "").trim();
    if (!expected || sentToken !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Body lesen & orderId extrahieren ---
    const body = await req.json().catch(() => ({} as any));
    console.log("RAW BODY:", body);
    const orderId: string = String(body?.orderId ?? body?.order_id ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId fehlt" }, { status: 400 });
    }
    console.log("STAGE 1: orderId", orderId);

    // --- Order laden ---
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      throw new Error(`Order nicht gefunden: ${orderErr?.message || "keine Daten"}`);
    }
    console.log("STAGE 2: order geladen", order.email);

    // --- Blocks bauen ---
    const blocks =
      (order as any).blocks ??
      ((order as any).answers ? buildBlocksFromAnswers((order as any).answers) : {});
    console.log("STAGE 3: blocks gebaut", !!blocks);

    // --- PDF erzeugen ---
const pdfBytes = await makeAnalysisPdf({
    orderId,
    name: (order as any).name ?? "",
    email: (order as any).email ?? "",
    blocks,
  });
  console.log("STAGE 4: pdf bytes", pdfBytes?.length);
  
  // SAFEGUARD
  if (!(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
    throw new Error("Ungültige PDF-Bytes aus makeAnalysisPdf");
  }
  
  // --- Upload ---
  const fileName = `${orderId}.pdf`;
  const nodeBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const { error: upErr } = await supabase.storage
    .from("analysen")
    .upload(fileName, nodeBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);

    // --- Order aktualisieren ---
    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: "generated", delivered_at: new Date().toISOString() })
      .eq("id", orderId);
    if (updErr) throw new Error(`Order-Update fehlgeschlagen: ${updErr.message}`);
    console.log("STAGE 6: order updated");

    // --- Mail (Fehler hier nicht fatal) ---
    try {
      await sendAnalysisMail({
        to: (order as any).email,
        name: (order as any).name,
        orderId,
      });
      console.log("STAGE 7: mail ok");
    } catch (mailErr: any) {
      console.error("MAIL_ERROR:", mailErr?.message || mailErr);
    }

    return NextResponse.json({ ok: true, orderId, file: fileName });
  } catch (err: any) {
    console.error("WORKER_UNCAUGHT_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error", stack: String(err?.stack || "") },
      { status: 500 }
    );
  }
}