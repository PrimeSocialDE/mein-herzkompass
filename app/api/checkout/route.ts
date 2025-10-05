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
      } else if (photo instanceof File || photo.buffer) {
        // File object or buffer
        fileBuffer = photo.buffer || Buffer.from(await photo.arrayBuffer());
        fileName = `${orderId}/photo_${i + 1}_${photo.name || 'upload.jpg'}`;
      } else {
        console.warn(`Skipping invalid photo format at index ${i}`);
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

    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();
    const answers = isPlainObject(body.answers) ? body.answers : {};
    const answers_raw = isPlainObject(body.answers_raw) ? body.answers_raw : {};
    const photos = Array.isArray(body.photos) ? body.photos : [];

    if (!process.env.STRIPE_PRICE_ID || !process.env.STRIPE_SUCCESS_URL || !process.env.STRIPE_CANCEL_URL) {
      throw new Error("Stripe-ENV unvollständig");
    }

    // Process and upload photos to Supabase Storage
    let photoUrls: string[] = [];
    if (photos.length > 0) {
      try {
        photoUrls = await processPhotos(photos);
        console.log(`Successfully uploaded ${photoUrls.length} photos`);
      } catch (photoError) {
        console.error("Photo processing error:", photoError);
        // Continue with order creation even if photo upload fails
      }
    }

    // E-Mail aus step8.html zu answers hinzufügen (bleibt erhalten)
    const enhancedAnswers = {
      ...answers,
      user_provided_email: email, // Original E-Mail von step8.html
      email_collected_at: new Date().toISOString(),
      email_source: 'step8_form'
    };

    // Order anlegen (queued) - E-Mail aus step8.html wird separat gespeichert
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        email: email || null, // Wird möglicherweise von Stripe überschrieben
        user_email: email || null, // Original E-Mail aus step8.html (bleibt erhalten)
        name: name || null,
        status: "queued",
        answers: enhancedAnswers, // Enthält auch user_provided_email als Backup
        answers_raw,
        photo_urls: photoUrls,
        photo_count: photoUrls.length,
        due_at: isoIn(10),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const orderId = order.id as string;

    let checkoutUrl: string | null = null;

    if (stripe) {
      // --- HIER: Session-Params aufbauen
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        client_reference_id: orderId,
        metadata: { 
          order_id: orderId, 
          name: name || "",
          user_email: email || "", // Original E-Mail in Metadaten
          photo_count: photoUrls.length.toString()
        },
        payment_intent_data: { metadata: { order_id: orderId, user_email: email || "" } },
        success_url: `${process.env.STRIPE_SUCCESS_URL}?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.STRIPE_CANCEL_URL!,
        customer_creation: "always",
      };

      // Nur echte E-Mails vorbefüllen – sonst Stripe eintippen lassen
      const isRealEmail =
        !!email && email !== "kunde@test.de" && /.+@.+\..+/.test(email);
      if (isRealEmail) {
        params.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(params);
      checkoutUrl = session.url ?? null;

      // Session-ID + pending speichern
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id, status: "pending" })
        .eq("id", orderId);
    }

    return NextResponse.json({ 
      ok: true, 
      orderId, 
      url: checkoutUrl,
      photosUploaded: photoUrls.length,
      userEmail: email // Bestätigung der gespeicherten E-Mail
    }, { status: 200 });

  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);
    return NextResponse.json({ 
      error: err?.message || "Fehler beim Checkout",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}