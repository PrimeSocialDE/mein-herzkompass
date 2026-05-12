// Router-Modul fuer PDF-Generierung.
//
// Es gibt zwei Generator-Modi:
//
// 1) buildPlanPdfFromContent({plan, dogName, ...}) — RENDERT den
//    KI-personalisierten Plan-JSON (TrainingPlanContent). Echte
//    Personalisierung: Übungen sind individuell pro Hund/Problem.
//    Wird in der Produktiv-Mail-Pipeline verwendet.
//
// 2) buildPlanPdf({dogName, planLengthMonths, ...}) — rendert den
//    HARDCODED Yuna/Bruno-Content (1M/3M/6M). Nur Name + Problem-Label
//    werden personalisiert. Wird für Sample-Mails / CLI-Tests benutzt.

// Statische Imports der .mjs-Generators. TypeScript akzeptiert das
// dank moduleResolution: "bundler" und Next.js' ESM-Handling.
import { buildPdf as buildPdf1Month } from "../generate-monatsplan-pdf.mjs";
import { buildPdf as buildPdf3Month } from "../generate-3monatsplan-pdf.mjs";
import { buildPdf as buildPdf6Month } from "../generate-6monatsplan-pdf.mjs";
import { buildPdfFromContent as buildFromContentRaw } from "../generate-plan-from-content.mjs";

import type { TrainingPlanContent } from "./member-plan-content";

interface PlanPdfParams {
  dogName: string;
  dogBreed?: string;
  dogAge?: string;
  mainProblem: string;
  planLengthMonths: 1 | 3 | 6;
  verbose?: boolean;
}

interface PlanPdfFromContentParams extends PlanPdfParams {
  plan: TrainingPlanContent;
}

// ECHTE PERSONALISIERUNG: rendert den AI-erzeugten Plan-JSON.
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

// HARDCODED-FALLBACK: nur fuer Sample-Mails / CLI / wenn kein Plan-JSON da.
export async function buildPlanPdf(
  params: PlanPdfParams
): Promise<Uint8Array> {
  const { planLengthMonths } = params;
  const genParams = {
    dogName: params.dogName,
    dogBreed: params.dogBreed || "Mischling",
    dogAge: params.dogAge || "—",
    mainProblem: params.mainProblem,
    verbose: params.verbose !== false,
  };

  if (planLengthMonths === 1) return await buildPdf1Month(genParams);
  if (planLengthMonths === 3) return await buildPdf3Month(genParams);
  if (planLengthMonths === 6) return await buildPdf6Month(genParams);

  throw new Error(
    `Ungültige planLengthMonths: ${planLengthMonths} (nur 1, 3, 6 erlaubt)`
  );
}

// Filename-Helper fuer den Mail-Anhang.
export function planPdfFilename(dogName: string, months: 1 | 3 | 6): string {
  const safeName = (dogName || "Hund").replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "");
  return `Pfoten-Plan-${safeName}-${months}M.pdf`;
}
