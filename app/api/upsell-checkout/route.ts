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
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mein-wauwerk.de';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: email,
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'WauWerk ' + moduleName,
                            description: 'Zusatz-Modul für ' + (dogName || 'deinen Hund'),
                        },
                        unit_amount: 1900,
                    },
                    quantity: 1,
                }
            ],
            metadata: {
                type: 'upsell',
                module: module,
                lead_id: leadId || '',
                dog_name: dogName || ''
            },
            success_url: baseUrl + '/danke-zusatz.html?session_id={CHECKOUT_SESSION_ID}&module=' + module,
            cancel_url: baseUrl + '/danke.html',
        });

        return NextResponse.json({ url: session.url });

    } catch {
        return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
    }
}