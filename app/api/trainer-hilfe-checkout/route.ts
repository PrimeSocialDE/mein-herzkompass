import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Preis in Cent
const TRAINER_HILFE_PRICE = 7999; // €79,99

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { 
      dogName, 
      email,
      problem,
      videoUrl,
      videoFilename,
      videoSizeMb,
      leadId
    } = body;

    // 1. Anfrage in Supabase speichern
    const { data: anfrageData, error: anfrageError } = await supabase
      .from('trainer_hilfe_anfragen')
      .insert({
        email: email,
        dog_name: dogName,
        problem_description: problem,
        video_url: videoUrl || null,
        video_filename: videoFilename || null,
        video_size_mb: videoSizeMb || null,
        lead_id: leadId || null,
        status: 'pending',
        price: 79.99
      })
      .select()
      .single();

    if (anfrageError) {
      console.error("Supabase Error:", anfrageError);
      return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
    }

    const anfrageId = anfrageData.id;

    // 2. PaymentIntent erstellen
    const paymentIntent = await stripe.paymentIntents.create({
      amount: TRAINER_HILFE_PRICE,
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        anfrage_id: anfrageId,
        type: 'trainer_hilfe',
        email: email || '',
        dog_name: dogName || '',
        lead_id: leadId || '',
        has_video: videoUrl ? 'true' : 'false'
      },
      description: `WauWerk Trainingsanpassung für ${dogName || 'Hund'}`,
    });

    // 3. Payment Intent ID in Anfrage speichern
    await supabase
      .from('trainer_hilfe_anfragen')
      .update({ 
        stripe_payment_intent: paymentIntent.id
      })
      .eq('id', anfrageId);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      anfrageId: anfrageId
    });

  } catch (error: any) {
    console.error("Trainer-Hilfe Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout fehlgeschlagen" },
      { status: 500 }
    );
  }
}