// app/api/upsell-checkout/route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const moduleNames: Record<string, string> = {
    anxiety: 'Trennungsangst Prävention',
    pulling: 'Leinenführigkeit Basics',
    barking: 'Anti-Bell Training',
    aggression: 'Aggressions-Kontrolle',
    recall: 'Rückruf-Training',
    jumping: 'Anti-Anspring Training',
    energy: 'Energie-Management',
    destructive: 'Anti-Zerstörungs Training',
    mouthing: 'Anti-Aufnehm Training'
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const module = body.module as string | undefined;
        const leadId = body.leadId as string | undefined;
        const email = body.email as string | undefined;
        const dogName = body.dogName as string | undefined;
        const bundle = body.bundle as boolean | undefined;
        const price = body.price as number | undefined;

        if (!module || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Premium erkennen
        const isPremium = module === 'premium';
        
        // Bundle erkennen (z.B. "pulling+anxiety")
        const isBundle = bundle || module.includes('+');
        
        // Preis: Premium = 249,99€, Bundle = 25€, Einzelmodul = 14,99€
        let amount: number;
        if (price) {
            amount = price;
        } else if (isPremium) {
            amount = 24999; // €249,99
        } else if (isBundle) {
            amount = 2499; // €24,99
        } else {
            amount = 1499; // €14,99
        }

        // Modul-Name generieren
        let moduleName: string;
        if (isPremium) {
            moduleName = 'Pfoten-Plan Premium - Alle Module + 3 Monate Support';
        } else if (isBundle) {
            const mainModule = module.split('+')[0];
            moduleName = 'Komplett-Paket: ' + (moduleNames[mainModule] || mainModule) + ' + Prävention';
        } else {
            moduleName = moduleNames[module] || 'Zusatz-Modul';
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                type: isPremium ? 'premium' : 'upsell',
                module: module,
                module_name: moduleName,
                lead_id: leadId || '',
                dog_name: dogName || '',
                email: email,
                is_bundle: isBundle ? 'true' : 'false',
                is_premium: isPremium ? 'true' : 'false'
            },
            receipt_email: email,
            description: 'Pfoten-Plan ' + moduleName + ' für ' + (dogName || 'Hund')
        });

        return NextResponse.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch {
        return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
    }
}