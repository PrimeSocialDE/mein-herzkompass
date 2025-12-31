import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '2');

    if (!BREVO_API_KEY) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const email = body.email as string;
        const leadId = body.leadId as string;
        const dogName = body.dogName as string;
        const dogProblemKey = body.dogProblemKey as string;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const problemLabels: Record<string, string> = {
            pulling: 'Leinenziehen',
            barking: 'Übermäßiges Bellen',
            aggression: 'Aggression',
            anxiety: 'Trennungsangst',
            jumping: 'Anspringen',
            recall: 'Kommt nicht zurück',
            energy: 'Übermäßige Energie',
            destructive: 'Zerstörerisches Verhalten',
            soiling: 'In die Wohnung machen'
        };

        const response = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                email,
                listIds: [BREVO_LIST_ID],
                updateEnabled: true,
                attributes: {
                    DOG_NAME: dogName || '',
                    DOG_PROBLEM: problemLabels[dogProblemKey] || 'Verhaltensproblem',
                    DOG_PROBLEM_KEY: dogProblemKey || '',
                    LEAD_ID: leadId || '',
                    SIGNUP_DATE: new Date().toISOString().split('T')[0]
                }
            })
        });

        if (response.ok) {
            return NextResponse.json({ success: true });
        } else {
            const errorData = await response.json();
            if (errorData.code === 'duplicate_parameter') {
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ error: errorData.message }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
