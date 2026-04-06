import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 });
    }

    // Lead in Supabase suchen
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

    if (lead.status !== 'paid') {
      return NextResponse.json({ error: `Lead gefunden, aber Status ist "${lead.status}" (nicht "paid")` }, { status: 400 });
    }

    // Make-Webhook triggern
    const makeUrl = process.env.MAKE_WEBHOOK_URL;
    if (!makeUrl) {
      return NextResponse.json({ error: 'MAKE_WEBHOOK_URL nicht konfiguriert' }, { status: 500 });
    }

    await fetch(makeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: lead.id,
        source: 'admin_resend',
        table: 'wauwerk_leads',
        email: lead.email,
        name: lead.customer_name || null,
        dog_name: lead.dog_name || null,
        selected_plan: lead.selected_plan || null,
        stripe_payment_intent: lead.stripe_payment_intent || null,
      }),
    });

    console.log(`Admin: Plan-Versand für ${email} (Lead ${lead.id}) erneut getriggert`);

    return NextResponse.json({
      message: `Make-Webhook getriggert für ${email} (Lead: ${lead.id}, Plan: ${lead.selected_plan || 'unbekannt'}, Hund: ${lead.dog_name || 'unbekannt'})`
    });

  } catch (error: unknown) {
    console.error('Resend error:', error);
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
