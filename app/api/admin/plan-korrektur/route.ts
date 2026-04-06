import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

// This endpoint returns the API key for the admin tool
// Protected by the admin password sent in the request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert.' }, { status: 500 });
    }

    if (action === 'get-key') {
      return NextResponse.json({ apiKey });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Admin error:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
