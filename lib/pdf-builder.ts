// Router-Modul fuer PDF-Generierung im Produktiv-Pfad.
//
// Production verwendet ausschliesslich buildPlanPdfFromContent (rendert
// den AI-personalisierten Plan-JSON). Die hardcoded Generators
// generate-{1,3,6}monatsplan-pdf.mjs leben nur fuer CLI-Sample-Builds
// und werden NICHT in die Serverless-Bundles gepackt.

import type { TrainingPlanContent } from "./member-plan-content";

// Nur der content-driven Generator wird static importiert — die hardcoded
// Generators werden bewusst rausgehalten, sonst werden Serverless-Functions
// >50MB und der Vercel-Deploy schlaegt fehl.
import { buildPdfFromContent as buildFromContentRaw } from "../generate-plan-from-content.mjs";

interface PlanPdfFromContentParams {
  plan: TrainingPlanContent;
  dogName: string;
  dogBreed?: string;
  dogAge?: string;
  mainProblem: string;
  planLengthMonths: 1 | 3 | 6;
  verbose?: boolean;
}

// ECHTE PERSONALISIERUNG: rendert den AI-erzeugten Plan-JSON.
// Wird vom Produktiv-Pfad (sendPlanReadyEmail) verwendet.
export async function buildPlanPdfFromContent(
  params: PlanPdfFromContentParams
): Promise<Uint8Array> {
  return await buildFromContentRaw({
    plan: params.plan,
    dogName: params.dogName,
    dogBreed: params.dogBreed || "Mischling",
    dogAge: params.dogAge || "—",
    mainProblem: params.mainProblem,
    planLengthMonths: params.planLengthMonths,
    verbose: params.verbose !== false,
  });
}

// Filename-Helper fuer den Mail-Anhang.
export function planPdfFilename(dogName: string, months: 1 | 3 | 6): string {
  const safeName = (dogName || "Hund").replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "");
  return `Pfoten-Plan-${safeName}-${months}M.pdf`;
}
