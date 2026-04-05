import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const PROBLEM_LABELS: Record<string, string> = {
  pulling: 'Leinenziehen',
  barking: 'Bellen',
  aggression: 'Aggression',
  anxiety: 'Trennungsangst',
  recall: 'Rückruf',
  jumping: 'Anspringen',
  energy: 'Überaktivität',
  destructive: 'Zerstörerisches Verhalten',
  mouthing: 'Beißen / Mouthing',
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const pdfFile = formData.get('pdf') as File | null;
    const complaint = formData.get('complaint') as string | null;
    const customerName = formData.get('customerName') as string | null;
    const dogName = formData.get('dogName') as string | null;
    const dogProblem = formData.get('dogProblem') as string | null;

    if (!pdfFile) {
      return NextResponse.json({ error: 'Keine PDF-Datei hochgeladen.' }, { status: 400 });
    }
    if (!complaint) {
      return NextResponse.json({ error: 'Keine Beschwerde angegeben.' }, { status: 400 });
    }

    // Convert PDF to base64
    const arrayBuffer = await pdfFile.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // Build context string
    let context = '';
    if (customerName) context += `Kundenname: ${customerName}\n`;
    if (dogName) context += `Hundename: ${dogName}\n`;
    if (dogProblem && PROBLEM_LABELS[dogProblem]) {
      context += `Hundeproblem: ${PROBLEM_LABELS[dogProblem]}\n`;
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `Du bist ein erfahrener Hundetrainer-Assistent. Deine Aufgabe ist es, Trainingsplaene fuer Hunde zu korrigieren.

Du erhaeltst:
1. Einen bestehenden Trainingsplan als PDF
2. Eine Beschwerde/Korrekturanweisung vom Admin
3. Optional: Zusatzinformationen zum Kunden und Hund

Deine Aufgabe:
- Analysiere den hochgeladenen Trainingsplan gruendlich
- Verstehe, was der Kunde bemaengelt / was korrigiert werden muss
- Erstelle eine KORRIGIERTE Version des Plans, die das Problem behebt
- Behalte die gleiche Struktur und das gleiche Format des Originalplans bei
- Alle Uebungen und Anweisungen muessen spezifisch und praxisnah sein
- Der gesamte Output muss auf Deutsch sein
- Gib NUR den korrigierten Plan aus, keine Erklaerungen drumherum
- Wenn der Originalplan Wochen/Tage/Phasen hat, behalte diese Struktur bei`;

    let userMessage = '';
    if (context) {
      userMessage += `ZUSATZINFORMATIONEN:\n${context}\n`;
    }
    userMessage += `BESCHWERDE / KORREKTURANWEISUNG:\n${complaint}\n\nBitte analysiere den angehaengten Trainingsplan und erstelle eine korrigierte Version, die die oben genannte Beschwerde/Anweisung beruecksichtigt.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: userMessage,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const correctedPlan = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return NextResponse.json({ correctedPlan });
  } catch (error: unknown) {
    console.error('Plan correction error:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
