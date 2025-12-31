// app/api/upsell-checkout/route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type ModuleKey = 'anxiety' | 'pulling' | 'barking' | 'aggression' | 'recall' | 'jumping' | 'energy' | 'destructive';

const moduleNames: Record<ModuleKey, string> = {
    anxiety: 'Trennungsangst Prävention',
    pulling: 'Leinenführigkeit Basics',
    barking: 'Anti-Bell Training',
    aggression: 'Aggressions-Kontrolle',
    recall: 'Rückruf-Training',
    jumping: 'Anti-Anspring Training',
    energy: 'Energie-Management',
    destructive: 'Anti-Zerstörungs Training'
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const module = body.module as ModuleKey | undefined;
        const leadId = body.leadId as string | undefined;
        const email = body.email as string | undefined;
        const dogName = body.dogName as string | undefined;

        if (!module || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const moduleName = moduleNames[module] || 'Zusatz-Modul';

        // PaymentIntent erstellen (nicht Checkout Session)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1900, // €19.00 in cents
            currency: 'eur',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                type: 'upsell',
                module: module,
                module_name: moduleName,
                lead_id: leadId || '',
                dog_name: dogName || '',
                email: email
            },
            receipt_email: email,
            description: 'WauWerk ' + moduleName + ' für ' + (dogName || 'Hund')
        });

        return NextResponse.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch {
        return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
    }
}