import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// Helper function to process and upload photos
async function processPhotos(photos: any[]): Promise<string[]> {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const uploadedUrls: string[] = [];
  const orderId = crypto.randomUUID();

  for (let i = 0; i < photos.length; i++) {
    try {
      const photo = photos[i];
      let fileBuffer: Buffer;
      let fileName: string;

      // Handle different photo formats
      if (typeof photo === 'string' && photo.startsWith('data:image/')) {
        // Base64 image
        const base64Data = photo.split(',')[1];
        fileBuffer = Buffer.from(base64Data, 'base64');
        fileName = `${orderId}/photo_${i + 1}.jpg`;
      } else if (photo.data && typeof photo.data === 'string' && photo.data.startsWith('data:image/')) {
        // Photo object with data property (from temp_photo_data)
        const base64Data = photo.data.split(',')[1];
        fileBuffer = Buffer.from(base64Data, 'base64');
        fileName = `${orderId}/photo_${i + 1}_${photo.name || 'upload.jpg'}`;
      } else if (photo instanceof File || photo.buffer) {
        // File object or buffer
        fileBuffer = photo.buffer || Buffer.from(await photo.arrayBuffer());
        fileName = `${orderId}/photo_${i + 1}_${photo.name || 'upload.jpg'}`;
      } else {
        console.warn(`Skipping invalid photo format at index ${i}:`, typeof photo);
        continue;
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-photos')
        .upload(fileName, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error(`Photo upload error for ${fileName}:`, error);
        continue;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        uploadedUrls.push(publicUrlData.publicUrl);
        console.log(`Successfully uploaded photo ${i + 1}: ${publicUrlData.publicUrl}`);
      }

    } catch (photoError) {
      console.error(`Error processing photo ${i}:`, photoError);
    }
  }

  return uploadedUrls;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    
    console.log('=== CHECKOUT API RECEIVED ===');
    console.log('Body keys:', Object.keys(body));
    console.log('temp_photo_data vorhanden:', !!body.temp_photo_data);
    console.log('photo_urls vorhanden:', !!body.photo_urls);
    console.log('createStripeSession:', body.createStripeSession);

    // FOTOS EXTRAHIEREN - Erweiterte Logik für verschiedene Quellen
    let photos: any[] = [];
    
    // 1. Prüfe temp_photo_data (von step7.html)
    if (body.temp_photo_data) {
      try {
        const tempData = typeof body.temp_photo_data === 'string' 
          ? JSON.parse(body.temp_photo_data) 
          : body.temp_photo_data;
        
        if (Array.isArray(tempData)) {
          photos = tempData;
          console.log('Photos aus temp_photo_data extrahiert:', photos.length);
        }
      } catch (e) {
        console.error('Fehler beim Parsen von temp_photo_data:', e);
      }
    }
    
    // 2. Fallback zu body.photos
    if (photos.length === 0 && Array.isArray(body.photos)) {
      photos = body.photos;
      console.log('Photos aus body.photos extrahiert:', photos.length);
    }

    // ANDERE DATEN EXTRAHIEREN
    const answers = isPlainObject(body.answers) ? body.answers : {};
    const answers_raw = isPlainObject(body.answers_raw) ? body.answers_raw : {};
    
    // Erweiterte Datensammlung aus verschiedenen Quellen
    const allAnswers = {
      ...answers,
      ...body, // Alle body-Daten als Fallback
    };
    
    // Entferne große Datenfelder aus allAnswers um Speicher zu sparen
    delete allAnswers.temp_photo_data;
    delete allAnswers.photos;
    
    const email = String(
      body.email ?? 
      body.userEmail ?? 
      body.user_email ??
      answers['userEmail'] ?? 
      allAnswers['userEmail'] ??
      ""
    ).trim();
    const name = String(body.name ?? body.user_name ?? "").trim();

    if (!process.env.STRIPE_PRICE_ID || !process.env.STRIPE_SUCCESS_URL || !process.env.STRIPE_CANCEL_URL) {
      throw new Error("Stripe-ENV unvollständig");
    }

    // Process and upload photos to Supabase Storage
    let photoUrls: string[] = [];
    if (photos.length > 0) {
      try {
        console.log('Starte Foto-Upload für', photos.length, 'Fotos...');
        photoUrls = await processPhotos(photos);
        console.log(`Successfully uploaded ${photoUrls.length} photos to Supabase`);
      } catch (photoError) {
        console.error("Photo processing error:", photoError);
        // Continue with order creation even if photo upload fails
      }
    } else {
      console.log('Keine Fotos zum Upload gefunden');
    }

    // E-Mail zu answers hinzufügen
    const enhancedAnswers = {
      ...allAnswers,
      user_provided_email: email,
      email_collected_at: new Date().toISOString(),
      email_source: 'step8_form',
      photo_count: photoUrls.length,
      photos_uploaded_successfully: photoUrls.length > 0
    };

    console.log('Erstelle Order mit', photoUrls.length, 'Foto-URLs');

    // Order anlegen
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        email: email || null,
        user_email: email || null,
        name: name || null,
        status: "queued",
        answers: enhancedAnswers,
        answers_raw: allAnswers,
        photo_urls: photoUrls,
        photo_count: photoUrls.length,
        due_at: isoIn(10),
      })
      .select("id")
      .single();
      
    if (insertError) {
      console.error('Supabase Insert Error:', insertError);
      throw insertError;
    }

    const orderId = order.id as string;
    console.log('Order erstellt mit ID:', orderId);

    let checkoutUrl: string | null = null;

    // Prüfe ob Stripe Session erstellt werden soll
    const createStripeSession = body.createStripeSession !== false; // Default: true

    if (createStripeSession && stripe) {
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        client_reference_id: orderId,
        metadata: { 
          order_id: orderId, 
          name: name || "",
          user_email: email || "",
          photo_count: photoUrls.length.toString()
        },
        payment_intent_data: { metadata: { order_id: orderId, user_email: email || "" } },
        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL!,
        customer_creation: "always",
      };

      const isRealEmail = !!email && email !== "kunde@test.de" && /.+@.+\..+/.test(email);
      if (isRealEmail) {
        params.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(params);
      checkoutUrl = session.url ?? null;

      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
        
      console.log('Stripe Session erstellt:', session.id);
    } else {
      console.log('Stripe Session übersprungen - createStripeSession ist false');
      checkoutUrl = null;
    }

    return NextResponse.json({ 
      ok: true, 
      orderId, 
      url: checkoutUrl,
      photosUploaded: photoUrls.length,
      userEmail: email,
      photoUrls: photoUrls // Für Debugging
    }, { status: 200 });

  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json({ 
      error: err?.message || "Fehler beim Checkout",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}