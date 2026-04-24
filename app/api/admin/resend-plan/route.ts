import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Re-Send durch Status-Flip: pending → (1,5 s warten) → paid.
// Das simuliert eine frische paid-Transition und löst alle Downstream-Listener
// (Make-Webhook, Supabase-Trigger etc.) erneut aus — analog zum initialen Kauf.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from('wauwerk_leads')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Kein Lead mit dieser E-Mail gefunden' }, { status: 404 });
    }

    // Schritt 1: Status auf pending setzen
    const { error: pendingErr } = await supabase
      .from('wauwerk_leads')
      .update({ status: 'pending' })
      .eq('id', lead.id);
    if (pendingErr) {
      return NextResponse.json({ error: `Status→pending fehlgeschlagen: ${pendingErr.message}` }, { status: 500 });
    }

    // Schritt 2: 1,5 s warten, damit Downstream die Transition sauber mitbekommt
    await new Promise((r) => setTimeout(r, 1500));

    // Schritt 3: Zurück auf paid mit frischem paid_at
    const { error: paidErr } = await supabase
      .from('wauwerk_leads')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', lead.id);
    if (paidErr) {
      return NextResponse.json({ error: `Status→paid fehlgeschlagen: ${paidErr.message}` }, { status: 500 });
    }

    console.log(`Admin: Status-Flip für ${email} (Lead ${lead.id}) durchgeführt`);

    return NextResponse.json({
      message: `Status-Flip ausgeführt für ${email} (Lead: ${lead.id}, Plan: ${lead.selected_plan || 'unbekannt'}, Hund: ${lead.dog_name || 'unbekannt'}). Re-Trigger gesetzt.`
    });

  } catch (error: unknown) {
    console.error('Resend error:', error);
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
