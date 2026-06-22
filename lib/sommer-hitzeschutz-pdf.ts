// 18-Seiten Sommer-Sicherheits-Plan (Hitzeschutz), rasse-personalisiert.
// Stil 1:1 wie Anti-Giftköder. KEIN medizinischer Content - Disclaimer je Seite.
// Export: buildSommerHitzeschutzPDF({ dogName, breed, age }) -> Uint8Array

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const A4_W = 595.28, A4_H = 841.89, MARGIN = 50, CONTENT_W = A4_W - 2 * MARGIN;
const GOLD = rgb(196/255,165/255,118/255), DARK_BROWN = rgb(139/255,115/255,85/255);
const TEXT_DARK = rgb(26/255,26/255,26/255), TEXT_MEDIUM = rgb(100/255,100/255,100/255), TEXT_LIGHT = rgb(150/255,150/255,150/255);
const WHITE = rgb(1,1,1), BG_LIGHT = rgb(250/255,248/255,245/255), BG_WARM = rgb(254/255,249/255,243/255), BORDER_LIGHT = rgb(232/255,220/255,200/255);
const RED = rgb(196/255,54/255,26/255);
const G_GREEN = rgb(0.90,0.96,0.90), G_YEL = rgb(0.995,0.97,0.84), G_ORG = rgb(0.99,0.92,0.81), G_RED = rgb(0.98,0.88,0.86);
const TOTAL = 18;
const DISCLAIMER = "Dieser Plan dient der Vorsorge und ersetzt keinen Tierarzt. Bei Verdacht auf Hitzschlag (starkes Hecheln, Taumeln, Erbrechen) sofort einen Tierarzt aufsuchen.";

const S = (s: any) => String(s == null ? "" : s).replace(/[→←⇒▶]/g,"-").replace(/[≥]/g,"ab ").replace(/[≤]/g,"bis ").replace(/[\u{1F000}-\u{1FAFF}☀-➿️✂]/gu,"").replace(/…/g,"...");

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; }

function normalizeBreedDisplay(breed?: string | null): string {
  if (!breed) return "Mischling";
  const s = String(breed).trim();
  if (!s || /unknown/i.test(s)) return "Mischling";
  return s;
}
function ageLabel(age?: string | null): string {
  const a = (age || "").toLowerCase();
  if (a === "puppy" || a === "welpe") return "Welpe";
  if (a === "young" || a === "junghund") return "Junghund";
  if (a === "senior") return "Senior";
  return "Erwachsen";
}
function breedFileName(k: string): string {
  const m: Record<string,string> = {
    labrador:"Labrador-Retriever.jpg","labrador retriever":"Labrador-Retriever.jpg",
    "golden retriever":"Golden-Retriever.jpg","deutscher schäferhund":"German-Shepard.jpg",
    schäferhund:"German-Shepard.jpg","german shepherd":"German-Shepard.jpg",
    "australian shepherd":"Australian-Shepherd.jpg",aussie:"Australian-Shepherd.jpg",
    "border collie":"Border-Collie.jpg",dackel:"Dackel.jpg",goldendoodle:"Goldendoodle.jpg",
    havaneser:"Havanese.jpg",havanese:"Havanese.jpg",mischling:"Mischling.jpg",
  };
  return m[k] || "Allgemein.jpg";
}

// Rasse-Hitzeprofil - steuert die personalisierten Textstellen
interface Profile { coatPhrase: string; ampelStricter: boolean; stricterReason: string; lovesWater: boolean; weightProne: boolean; riskClass: string; }
function breedProfile(breedKey: string): Profile {
  const k = breedKey.trim().toLowerCase();
  const has = (...arr: string[]) => arr.some(a => k.includes(a));
  const brachy = has("mops","pug","bulldog","bulldogge","boxer","pekinese","pekingese","shih","französische","englische");
  const doubleCoat = has("labrador","golden","retriever","schäferhund","shepherd","collie","husky","berner","sennen","spitz","samojede","chow","aussie","goldendoodle","schweizer");
  const small = has("dackel","chihuahua","yorkshire","malteser","havan","zwerg","pinscher","spitz");
  const water = has("labrador","golden","retriever","neufund","wasser","spaniel");
  const weight = has("labrador","golden","beagle","mops","dackel");
  if (brachy) return { coatPhrase:"eine kurze Nase (brachycephal), wodurch das Kühlen durch Hecheln kaum funktioniert", ampelStricter:true, stricterReason:"kurznasige Rassen können sich kaum durch Hecheln abkühlen", lovesWater:water, weightProne:weight, riskClass:"sehr hoch" };
  if (doubleCoat) return { coatPhrase:"ein dichtes Doppelfell, das im Sommer die Körperwärme speichert", ampelStricter:true, stricterReason:"dichtes Fell und kräftige Statur stauen die Wärme", lovesWater:water, weightProne:weight, riskClass:"erhöht" };
  if (small) return { coatPhrase:"einen kleinen Körper nah am heißen Boden, der schnell dehydriert", ampelStricter:false, stricterReason:"", lovesWater:water, weightProne:weight, riskClass:"mittel" };
  return { coatPhrase:"ein Fell, das im Sommer Wärme speichern kann", ampelStricter:weight, stricterReason:weight?"Übergewicht erhöht das Hitze-Risiko":"", lovesWater:water, weightProne:weight, riskClass:"mittel" };
}

// ───────── Zeichen-Helfer ─────────
function wrap(t: string, f: PDFFont, s: number, mw: number): string[] { const ws=S(t).split(" "); const ls:string[]=[]; let c=""; for(const w of ws){const x=c?c+" "+w:w; if(f.widthOfTextAtSize(x,s)>mw&&c){ls.push(c);c=w;}else c=x;} if(c)ls.push(c); return ls; }
function rrect(p: PDFPage,x:number,y:number,w:number,h:number,r:number,color:any){ p.drawRectangle({x:x+r,y,width:w-2*r,height:h,color}); p.drawRectangle({x,y:y+r,width:w,height:h-2*r,color}); for(const[cx,cy]of[[x+r,y+r],[x+w-r,y+r],[x+r,y+h-r],[x+w-r,y+h-r]])p.drawCircle({x:cx,y:cy,size:r,color}); }

export async function buildSommerHitzeschutzPDF(input: { dogName?: string|null; breed?: string|null; age?: string|null; }): Promise<Uint8Array> {
  const DOG = S(input.dogName || "dein Hund").slice(0,40) || "dein Hund";
  const breedKey = (input.breed || "").trim().toLowerCase();
  const BREED = normalizeBreedDisplay(input.breed);
  const AGE = ageLabel(input.age);
  const prof = breedProfile(breedKey);

  const doc = await PDFDocument.create();
  const F: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold), italic: await doc.embedFont(StandardFonts.HelveticaOblique) };

  const newPage = () => { const p=doc.addPage([A4_W,A4_H]); p.drawRectangle({x:0,y:0,width:A4_W,height:A4_H,color:WHITE}); p.drawRectangle({x:0,y:A4_H-6,width:A4_W,height:6,color:GOLD}); return p; };
  const footer = (p:PDFPage,n:number)=>{ const dl=wrap(DISCLAIMER,F.italic,7.5,CONTENT_W); let dy=32+dl.length*9; for(const line of dl){const w=F.italic.widthOfTextAtSize(line,7.5); p.drawText(line,{x:(A4_W-w)/2,y:dy,size:7.5,font:F.italic,color:TEXT_LIGHT}); dy-=9;} const meta=`Pfoten-Plan · Sommer-Sicherheit · Seite ${n}/${TOTAL}`; const mw=F.regular.widthOfTextAtSize(meta,8); p.drawText(meta,{x:(A4_W-mw)/2,y:18,size:8,font:F.regular,color:TEXT_LIGHT}); p.drawRectangle({x:0,y:0,width:A4_W,height:3,color:GOLD}); };
  const header = (p:PDFPage,pill:string,title:string):number=>{ let y=A4_H-60; const pw=F.bold.widthOfTextAtSize(pill,9)+18; rrect(p,MARGIN,y-18,pw,22,4,GOLD); p.drawText(S(pill),{x:MARGIN+9,y:y-12,size:9,font:F.bold,color:WHITE}); y-=56; for(const line of wrap(title,F.bold,21,CONTENT_W)){p.drawText(line,{x:MARGIN,y,size:21,font:F.bold,color:TEXT_DARK}); y-=27;} y-=10; p.drawRectangle({x:MARGIN,y,width:CONTENT_W,height:1,color:BORDER_LIGHT}); return y-24; };
  const para = (p:PDFPage,t:string,y:number,o:any={}):number=>{ const size=o.size??11,color=o.color??TEXT_DARK,font=o.font??F.regular,gap=o.gap??7; for(const line of wrap(t,font,size,CONTENT_W)){p.drawText(line,{x:MARGIN,y,size,font,color}); y-=size+gap;} return y-5; };
  const subhead = (p:PDFPage,t:string,y:number):number=>{ p.drawText(S(t),{x:MARGIN,y,size:13,font:F.bold,color:DARK_BROWN}); return y-21; };
  const bullet = (p:PDFPage,t:string,y:number):number=>{ p.drawCircle({x:MARGIN+4,y:y+3,size:2.2,color:GOLD}); const ls=wrap(t,F.regular,10.5,CONTENT_W-20); for(const[i,line]of ls.entries())p.drawText(line,{x:MARGIN+16,y:y-i*15,size:10.5,font:F.regular,color:TEXT_MEDIUM}); return y-(ls.length*15)-6; };
  const step = (p:PDFPage,n:number,title:string,desc:string,y:number):number=>{ p.drawCircle({x:MARGIN+11,y:y-1,size:11,color:DARK_BROWN}); const nw=F.bold.widthOfTextAtSize(String(n),11); p.drawText(String(n),{x:MARGIN+11-nw/2,y:y-4,size:11,font:F.bold,color:WHITE}); p.drawText(S(title),{x:MARGIN+30,y:y-1,size:12,font:F.bold,color:TEXT_DARK}); y-=18; for(const line of wrap(desc,F.regular,10,CONTENT_W-30)){p.drawText(line,{x:MARGIN+30,y,size:10,font:F.regular,color:TEXT_MEDIUM}); y-=13;} return y-12; };
  const dayStep = (p:PDFPage,label:string,desc:string,y:number):number=>{ const lw=F.bold.widthOfTextAtSize(label,10)+14; rrect(p,MARGIN,y-13,lw,18,4,DARK_BROWN); p.drawText(S(label),{x:MARGIN+7,y:y-9,size:10,font:F.bold,color:WHITE}); const ls=wrap(desc,F.regular,10.5,CONTENT_W-lw-20); for(const[i,line]of ls.entries())p.drawText(line,{x:MARGIN+lw+12,y:y-i*14,size:10.5,font:F.regular,color:TEXT_MEDIUM}); return y-Math.max(22,ls.length*14+8); };
  const tip = (p:PDFPage,t:string,y:number):number=>{ y-=18; const ls=wrap(t,F.regular,10,CONTENT_W-32); const bh=44+ls.length*14; rrect(p,MARGIN,y-bh+14,CONTENT_W,bh,6,BG_LIGHT); p.drawRectangle({x:MARGIN,y:y-bh+14,width:3,height:bh,color:GOLD}); p.drawText("Trainer-Tipp",{x:MARGIN+14,y:y-4,size:10,font:F.bold,color:DARK_BROWN}); y-=24; for(const line of ls){p.drawText(line,{x:MARGIN+14,y,size:10,font:F.regular,color:TEXT_MEDIUM}); y-=14;} return y-16; };
  const warnBox = (p:PDFPage,t:string,y:number):number=>{ y-=6; const ls=wrap(t,F.bold,10,CONTENT_W-32); const bh=24+ls.length*13; rrect(p,MARGIN,y-bh+10,CONTENT_W,bh,6,rgb(253/255,236/255,234/255)); p.drawRectangle({x:MARGIN,y:y-bh+10,width:3,height:bh,color:RED}); y-=6; for(const line of ls){p.drawText(line,{x:MARGIN+14,y,size:10,font:F.bold,color:RED}); y-=13;} return y-14; };
  const checklist = (p:PDFPage,items:string[],y:number):number=>{ for(const it of items){p.drawRectangle({x:MARGIN,y:y-2,width:12,height:12,borderColor:DARK_BROWN,borderWidth:1.2,color:WHITE}); const ls=wrap(it,F.regular,10.5,CONTENT_W-28); for(const[i,line]of ls.entries())p.drawText(line,{x:MARGIN+22,y:y-1-i*14,size:10.5,font:F.regular,color:TEXT_MEDIUM}); y-=Math.max(21,ls.length*14+7);} return y; };
  const table = (p:PDFPage,x:number,topY:number,colW:number[],headers:string[],rows:{cells:string[];bg?:any}[]):number=>{ const pad=6,fs=9.5,lh=12.5,tw=colW.reduce((a,b)=>a+b,0); let y=topY; const hH=22; p.drawRectangle({x,y:y-hH,width:tw,height:hH,color:DARK_BROWN}); let cx=x; for(let i=0;i<headers.length;i++){p.drawText(S(headers[i]),{x:cx+pad,y:y-15,size:9.5,font:F.bold,color:WHITE}); cx+=colW[i];} y-=hH; for(const row of rows){ const wr=row.cells.map((c,i)=>wrap(c,F.regular,fs,colW[i]-2*pad)); const nl=Math.max(...wr.map(w=>w.length)); const rh=nl*lh+9; if(row.bg)p.drawRectangle({x,y:y-rh,width:tw,height:rh,color:row.bg}); cx=x; for(let i=0;i<wr.length;i++){let ty=y-13; for(const line of wr[i]){p.drawText(line,{x:cx+pad,y:ty,size:fs,font:i===0?F.bold:F.regular,color:TEXT_DARK}); ty-=lh;} cx+=colW[i];} p.drawRectangle({x,y:y-rh,width:tw,height:0.5,color:BORDER_LIGHT}); y-=rh;} return y-6; };
  const dashedBorder = (p:PDFPage,x:number,y:number,w:number,h:number)=>{ const seg=5,gp=4,col=rgb(.6,.6,.6),th=0.8; for(let i=x;i<x+w;i+=seg+gp){const len=Math.min(seg,x+w-i); p.drawRectangle({x:i,y,width:len,height:th,color:col}); p.drawRectangle({x:i,y:y+h,width:len,height:th,color:col});} for(let j=y;j<y+h;j+=seg+gp){const len=Math.min(seg,y+h-j); p.drawRectangle({x,y:j,width:th,height:len,color:col}); p.drawRectangle({x:x+w,y:j,width:th,height:len,color:col});} };

  // 1 Cover
  { const p=newPage(); const pill="SOMMER-SICHERHEIT"; const pw=F.bold.widthOfTextAtSize(pill,9)+18; rrect(p,MARGIN,A4_H-95,pw,22,4,GOLD); p.drawText(pill,{x:MARGIN+9,y:A4_H-89,size:9,font:F.bold,color:WHITE});
    p.drawText("Sommer-Sicherheits-Plan",{x:MARGIN,y:A4_H-140,size:30,font:F.bold,color:TEXT_DARK}); p.drawText(`für ${DOG}`,{x:MARGIN,y:A4_H-172,size:20,font:F.bold,color:DARK_BROWN}); p.drawText(`${BREED} · ${AGE}`,{x:MARGIN,y:A4_H-196,size:12,font:F.regular,color:TEXT_MEDIUM});
    let imgY=A4_H-470; try{ const ip=join(process.cwd(),"public","breeds",breedFileName(breedKey)); if(existsSync(ip)){ const img=await doc.embedJpg(readFileSync(ip)); const iw=CONTENT_W,ih=(img.height/img.width)*iw; imgY=A4_H-230-ih; p.drawImage(img,{x:MARGIN,y:imgY,width:iw,height:ih}); } }catch{}
    let y=imgY-30; y=para(p,`Dieser Plan ist auf das Hitze-Risiko von ${BREED}-Hunden abgestimmt - mit konkreten Handlungs-Vorlagen: Hitze-Ampel, Wochenplan, Abkühl-Rezepten, Packliste und einer Notfall-Karte zum Ausschneiden.`,y,{color:TEXT_MEDIUM});
    y-=4; y=subhead(p,"So nutzt du diesen Plan",y);
    y=para(p,"1. Seite 3 (Hitze-Ampel) sagt dir bei jeder Temperatur genau, was zu tun ist.",y,{size:10.5,color:TEXT_MEDIUM,gap:5});
    y=para(p,"2. Seite 4 und 5 (Hitzschlag erkennen & Erste Hilfe) JETZT lesen, nicht erst im Notfall.",y,{size:10.5,color:TEXT_MEDIUM,gap:5});
    y=para(p,"3. Die Notfall-Karte auf Seite 18 ausschneiden oder aufs Handy speichern.",y,{size:10.5,color:TEXT_MEDIUM,gap:5}); footer(p,1); }

  // 2 Rasse
  { const p=newPage(); let y=header(p,"DEINE RASSE",`Wie gefährdet ist ${DOG} im Sommer?`);
    y=para(p,`${BREED} haben ${prof.coatPhrase}. ${DOG} überhitzt dadurch schneller, als viele denken - das Hitze-Risiko ist ${prof.riskClass}.`,y);
    y=para(p,`${prof.weightProne?`Achte außerdem aufs Gewicht: jedes Kilo zu viel erhöht das Hitzschlag-Risiko. `:""}Viele Hunde laufen bei Hitze aus Freude einfach weiter und zeigen Erschöpfung erst spät - DU musst die Pausen vorgeben, nicht ${DOG}.`,y);
    y=subhead(p,"Generell höheres Risiko bei:",y);
    y=bullet(p,"Kurznasen (Mops, Bulldogge, Boxer) - können kaum durch Hecheln kühlen",y);
    y=bullet(p,"Dichtem oder dunklem Fell - speichert Wärme",y);
    y=bullet(p,"Übergewicht, Senioren, Welpen und Hunden mit Herz-/Atemproblemen",y);
    y=tip(p,`Verlass dich nicht darauf, dass ${DOG} zeigt, wenn es zu viel wird. Mach es zur Regel: ab 25 Grad Schatten-Modus - kürzere Runden, mehr Pausen, mittags Ruhe. Lieber einen Tag "unterfordert" als ein Hitzschlag. Als Ausgleich abends, wenn es abkühlt, eine längere Runde.`,y); footer(p,2); }

  // 3 Hitze-Ampel
  { const p=newPage(); let y=header(p,"HITZE-AMPEL","So viel Gassi bei welcher Temperatur");
    y=para(p,`Diese Ampel macht aus dem Thermometer eine klare Anweisung. Schau morgens aufs Wetter und richte den Tag danach.`,y,{gap:6});
    y=table(p,MARGIN,y,[78,118,108,191],["Temperatur","Gassi-Dauer","Beste Zeit","Aktivität"],[
      {cells:["bis 20°C","Normal lang","Ganztags ok","Alles möglich"],bg:G_GREEN},
      {cells:["20-25°C","Normal","Mittag meiden","Normale Runden, Schatten suchen"],bg:G_GREEN},
      {cells:["25-28°C","20-30 Min","Früh / spät","Tempo runter, schattige Wege"],bg:G_YEL},
      {cells:["28-32°C","10-15 Min","Nur früh/spät","Nur Lösen; Auslastung drinnen (Nasenarbeit)"],bg:G_ORG},
      {cells:["über 32°C","Nur kurz lösen","Morgen/Nacht","Keine Belastung, drinnen kühl halten"],bg:G_RED},
    ]);
    const ampelTip = prof.ampelStricter ? `Für ${DOG} gilt jeweils EINE Stufe strenger (${prof.stricterReason}) - bei 26 Grad also schon wie "28-32" behandeln.` : `Beobachte ${DOG} genau und geh im Zweifel eine Stufe strenger vor.`;
    y=tip(p,`${ampelTip} Und: Luftfeuchtigkeit verschärft alles, weil Hecheln dann schlechter kühlt - an schwülen Tagen extra vorsichtig sein.`,y); footer(p,3); }

  // 4 Hitzschlag erkennen
  { const p=newPage(); let y=header(p,"NOTFALL-WISSEN","Hitzschlag erkennen - die Warnzeichen");
    y=para(p,`Ein Hitzschlag entwickelt sich schnell und kann lebensbedrohlich werden. Je früher du die Zeichen erkennst, desto besser stehen ${DOG}s Chancen.`,y);
    y=subhead(p,"Achte auf diese Signale:",y);
    y=bullet(p,"Sehr starkes, schnelles Hecheln, das nicht aufhört",y);
    y=bullet(p,"Vermehrtes Speicheln, zäher Schaum",y);
    y=bullet(p,"Dunkelrote, später bläuliche Zunge und Zahnfleisch",y);
    y=bullet(p,"Taumeln, Schwäche, Koordinationsprobleme",y);
    y=bullet(p,"Erbrechen oder Durchfall, evtl. mit Blut",y);
    y=bullet(p,"Teilnahmslosigkeit bis Bewusstlosigkeit / Kollaps",y);
    y=warnBox(p,"Ab einer Körpertemperatur von 41 Grad C wird es lebensgefährlich. Bei mehreren dieser Zeichen: sofort handeln (Seite 5) und Tierarzt rufen.",y); footer(p,4); }

  // 5 Erste Hilfe
  { const p=newPage(); let y=header(p,"NOTFALL-WISSEN","Erste Hilfe bei Hitzschlag");
    y=para(p,`Wenn du einen Hitzschlag vermutest, zählt jede Minute. Geh so vor:`,y);
    y=step(p,1,"Raus aus der Hitze",`Bring ${DOG} sofort in den Schatten oder einen kühlen Raum.`,y);
    y=step(p,2,"Langsam kühlen",`Kühles - NICHT eiskaltes - Wasser an Pfoten, Bauch und Innenschenkel. Eiskaltes Wasser verengt die Gefäße und kann einen Schock auslösen.`,y);
    y=step(p,3,"Trinken anbieten",`Biete kühles Wasser an, aber zwinge ${DOG} nicht zu trinken.`,y);
    y=step(p,4,"Sofort zum Tierarzt",`Auch wenn es besser geht - Organschäden zeigen sich oft erst Stunden später. Ruf unterwegs schon an.`,y);
    y=warnBox(p,"Nie mit Eis kühlen und den Hund nie luftdicht in nasse Tücher wickeln - das staut die Hitze.",y); footer(p,5); }

  // 6 Asphalt
  { const p=newPage(); let y=header(p,"PFOTENSCHUTZ","Der heiße Asphalt - Verbrennungsgefahr");
    y=para(p,`Asphalt heizt sich extrem auf - bei 30 Grad Luft kann der Boden über 50 Grad heiß werden und verbrennt Pfotenballen in Sekunden.`,y);
    y=subhead(p,"Der 7-Sekunden-Test",y);
    y=para(p,`Leg deinen Handrücken 7 Sekunden auf den Asphalt. Hältst du es nicht aus, ist es auch für ${DOG}s Pfoten zu heiß.`,y);
    y=tip(p,`Fällt der Test durch, musst du die Runde nicht streichen: Geh auf Wiese, Waldboden oder schattige Feldwege. An heißen Tagen reicht eine kurze Schnüffelrunde plus Suchspiel drinnen. Für unvermeidbare Stadt-Strecken gibt es Hundeschuhe - wie du ${DOG} in 7 Tagen daran gewöhnst, steht auf der nächsten Seite. Prüfe die Ballen abends auf Risse oder Blasen.`,y); footer(p,6); }

  // 7 Hundeschuh-Plan
  { const p=newPage(); let y=header(p,"SCHRITT FÜR SCHRITT","7-Tage-Plan: Hundeschuhe gewöhnen");
    y=para(p,`Schuhe schützen auf heißem Asphalt - aber nur, wenn ${DOG} sie akzeptiert. Zwingen führt zum berühmten "Storchengang". Mit diesem Plan klappt es entspannt.`,y);
    y=dayStep(p,"Tag 1-2",`Schuhe nur zeigen und beschnuppern lassen, dabei Leckerli geben. Einen Schuh kurz (Sekunden) über die Pfote halten, sofort belohnen.`,y);
    y=dayStep(p,"Tag 3-4",`Schuhe anziehen und SOFORT spielen oder füttern - so verknüpft ${DOG} sie mit etwas Schönem. 1-2 Minuten drinnen.`,y);
    y=dayStep(p,"Tag 5",`Mit Schuhen kurz durch Wohnung oder Garten laufen. Lob für jeden normalen Schritt.`,y);
    y=dayStep(p,"Tag 6-7",`Erste kurze echte Runde draußen mit Schuhen. Steigere die Dauer langsam.`,y);
    y=tip(p,`Nie zwingen und nie schimpfen, wenn er komisch läuft - das ist normal am Anfang. Immer mit Leckerli und Spiel verknüpfen, lieber kürzer und öfter. Achte auf gute Passform: zu eng drückt, zu weit rutscht.`,y); footer(p,7); }

  // 8 Gassi-Zeiten
  { const p=newPage(); let y=header(p,"ALLTAG","Die richtigen Gassi-Zeiten & Regeln");
    y=para(p,`Im Hochsommer entscheidet die Uhrzeit über die Sicherheit. Verlege die Hauptrunden in den frühen Morgen und späten Abend.`,y);
    y=subhead(p,"Deine Sommer-Regeln:",y);
    y=bullet(p,"Lange Runden nur früh morgens oder spät abends",y);
    y=bullet(p,"Die Mittagshitze (ca. 11 bis 18 Uhr) komplett meiden",y);
    y=bullet(p,"Schatten-Routen wählen, Tempo deutlich reduzieren",y);
    y=bullet(p,"Immer Wasser mitnehmen, regelmäßige Trinkpausen",y);
    y=tip(p,`Statt langer Runden bei Hitze: Kopfarbeit. 10 Minuten Nasenarbeit - Leckerlis im schattigen Gras suchen, Schnüffelteppich, Karton-Suchspiel - ermüden ${DOG} mehr als eine Stunde Laufen, ohne Hitzestress. Eine fertige Beispielwoche dafür findest du auf der nächsten Seite.`,y); footer(p,8); }

  // 9 Wochenplan
  { const p=newPage(); let y=header(p,"DEIN SYSTEM","Beispiel-Woche im Hochsommer");
    y=para(p,`So könnte eine heiße Woche für ${DOG} aussehen - als Vorlage. Bewegung in die kühlen Stunden, mittags Ruhe, Kopfarbeit als Ausgleich.`,y,{gap:6});
    y=table(p,MARGIN,y,[42,168,120,165],["Tag","Morgens (kühl)","Mittags","Abends"],[
      {cells:["Mo","Lange Schnüffel-Runde","Ruhe + Kühlmatte","Kurze Runde + Schuh-Übung"]},
      {cells:["Di","Normale Runde","Ruhe; Kong-Eis","Nasenspiel drinnen"],bg:BG_LIGHT},
      {cells:["Mi","Runde am Wasser","Ruhe","Kurze Abendrunde"]},
      {cells:["Do","Wald/Schatten-Tour","Ruhe + DIY-Eis","Kurze Trainingseinheit"],bg:BG_LIGHT},
      {cells:["Fr","Lange Runde","Ruhe","Planschbecken im Garten"]},
      {cells:["Sa","Früh: längere Tour","Ruhe (Hitze!)","Treffen mit Hundekumpel"],bg:BG_LIGHT},
      {cells:["So","Ruhiger Start","Ruhe","Entspannte Abendrunde"]},
    ]);
    y=tip(p,`Pass die Vorlage an die Hitze-Ampel (Seite 3) an: An Tagen über 32 Grad streichst du die langen Touren komplett und ersetzt sie durch Kopfarbeit drinnen. Druck dir die Woche aus und häng sie an den Kühlschrank.`,y); footer(p,9); }

  // 10 Auto/Wohnung/Garten
  { const p=newPage(); let y=header(p,"GEFAHRENZONEN","Auto, Wohnung & Garten - stille Fallen");
    y=subhead(p,"Das Auto - die größte Gefahr",y);
    y=para(p,`Ein geparktes Auto wird in der Sonne in Minuten zur tödlichen Falle - auch bei spaltbreit offenem Fenster und bei nur 20 Grad außen. Lass ${DOG} im Sommer NIE allein im Auto.`,y);
    y=subhead(p,"Wohnung & Garten",y);
    y=bullet(p,"Wohnung kühl halten: tagsüber Rollläden zu, nachts lüften",y);
    y=bullet(p,"Im Garten immer Schatten und frisches Wasser bereitstellen",y);
    y=bullet(p,"Nie in der prallen Sonne anleinen - kein Ausweichen möglich",y);
    y=warnBox(p,"Hund allein im heißen Auto gesehen? Notruf 112 - es ist ein Notfall.",y);
    y=tip(p,`Richte ${DOG} einen festen Kühl-Platz ein: schattig, mit Kühlmatte und Wasser in Reichweite. Fliesen im Flur oder Bad sind oft die kühlste Stelle der Wohnung und ein beliebter Rückzugsort.`,y); footer(p,10); }

  // 11 Abkühlung
  { const p=newPage(); let y=header(p,"ABKÜHLUNG","Abkühlung richtig gemacht");
    y=subhead(p,"Das hilft wirklich:",y);
    y=bullet(p,"Kühlmatte oder feuchtes Handtuch zum Liegen (nicht zudecken)",y);
    y=bullet(p,"Nasses Tuch an Bauch und Pfoten - dort kühlt es am besten",y);
    y=bullet(p,"Planschbecken oder flacher Bach zum Reinstehen",y);
    y=bullet(p,"Gefrorene Snacks (Rezepte auf der nächsten Seite)",y);
    y=subhead(p,"Zwei Irrtümer:",y);
    y=para(p,`1. Scheren hilft meist NICHT - dichtes Fell isoliert auch gegen Hitze und schützt vor Sonnenbrand. 2. Eiskaltes Wasser ist kontraproduktiv (Seite 5) - lauwarm bis kühl ist richtig.`,y,{color:TEXT_MEDIUM,gap:5});
    y=tip(p,`Damit ${DOG} mehr trinkt, stell mehrere Näpfe auf - Wohnung, Garten, Balkon. Eiswürfel oder ein Schuss laktosefreie Brühe machen Wasser interessanter. Für unterwegs: Trinkflasche mit Faltnapf, dazu ein gut ausgewrungenes nasses Halstuch.`,y); footer(p,11); }

  // 12 DIY-Rezepte
  { const p=newPage(); let y=header(p,"ZUM NACHMACHEN","4 DIY-Abkühl-Rezepte");
    y=para(p,`Schnell gemacht, hundesicher, hält ${DOG} an Hitzetagen lange beschäftigt.`,y,{gap:6});
    y=subhead(p,"1. Joghurt-Beeren-Eis",y); y=para(p,`200 g Naturjoghurt (laktosefrei) + eine Handvoll Heidelbeeren verrühren, in Eiswürfelform oder Kong füllen, ca. 4 Std. einfrieren.`,y,{size:10,color:TEXT_MEDIUM,gap:4});
    y=subhead(p,"2. Hühnerbrühe-Würfel",y); y=para(p,`250 ml ungesalzene, selbst gekochte Hühnerbrühe (ohne Zwiebel/Knoblauch) in Eiswürfelform einfrieren. Perfekt für den Napf.`,y,{size:10,color:TEXT_MEDIUM,gap:4});
    y=subhead(p,"3. Gurken-Karotten-Kong",y); y=para(p,`Kong mit geriebener Gurke + Karotte + 1 TL Frischkäse füllen, einfrieren. Kalorienarm - gut bei Übergewichts-Neigung.`,y,{size:10,color:TEXT_MEDIUM,gap:4});
    y=subhead(p,"4. Wassermelonen-Happen",y); y=para(p,`Entkernte Wassermelone (ohne Kerne und Schale) in mundgerechte Stücke schneiden und einfrieren. In Maßen - enthält Zucker.`,y,{size:10,color:TEXT_MEDIUM,gap:4});
    y=warnBox(p,"Tabu für Hunde: Zwiebel, Knoblauch, Weintrauben/Rosinen, Xylit (Süßstoff), Schokolade, Alkohol.",y); footer(p,12); }

  // 13 Wasser & Baden
  { const p=newPage(); let y=header(p,"WASSER & BADEN","Sicher baden im Sommer");
    y=para(p,`${prof.lovesWater?`${BREED} lieben Wasser`:"Viele Hunde lieben Wasser"} - aber genau das birgt eigene Gefahren.`,y);
    y=subhead(p,"Darauf musst du achten:",y);
    y=bullet(p,"Wasservergiftung: beim langen Apportieren zu viel geschlucktes Wasser. Zeichen: Erbrechen, Taumeln, aufgeblähter Bauch - Notfall.",y);
    y=bullet(p,"Überanstrengung: Schwimmen ist anstrengend, Pausen erzwingen",y);
    y=bullet(p,"Blaualgen: grünlich-trübes Wasser meiden, hochgiftig",y);
    y=bullet(p,"Nach dem Baden abtrocknen, besonders die Ohren",y);
    y=tip(p,`Begrenz das Apportieren aus dem Wasser auf kurze Einheiten mit Pausen - ${DOG} würde aus Freude über seine Grenze gehen. Besser als stundenlanges Bällchen: flaches Planschbecken oder kurze Schwimm-Einheiten mit Pause. Schluckt er beim Apportieren viel Wasser, sofort stoppen.`,y); footer(p,13); }

  // 14 Plagegeister
  { const p=newPage(); let y=header(p,"PLAGEGEISTER","Zecken, Stiche & Giftpflanzen");
    y=subhead(p,"Zecken & Grasmilben",y);
    y=para(p,`Nach jedem Spaziergang absuchen (Achseln, Ohren, zwischen den Zehen). Zecken früh entfernen senkt das Krankheitsrisiko.`,y);
    y=subhead(p,"Bienen- und Wespenstiche",y);
    y=warnBox(p,"Ein Stich im Maul oder Rachen kann die Atemwege zuschwellen lassen - Notfall, sofort zum Tierarzt.",y);
    y=tip(p,`Mach das Zecken-Absuchen zum Ritual beim abendlichen Streicheln - dann fühlt es sich für ${DOG} nicht wie Kontrolle an. Zeckenzange in jede Tasche und ins Auto. Giftpflanzen (Oleander, Engelstrompete, Eibe) lieber abzäunen oder entfernen, statt dauernd aufzupassen.`,y); footer(p,14); }

  // 15 Reise
  { const p=newPage(); let y=header(p,"UNTERWEGS",`Reise & Urlaub mit ${DOG}`);
    y=subhead(p,"Auto-Reise im Sommer",y);
    y=bullet(p,"Nie in der prallen Sonne parken, Sonnenschutz an die Scheiben",y);
    y=bullet(p,"Alle 2 Stunden Pause: Wasser, Schatten, kurze Bewegung",y);
    y=bullet(p,"Fahrten in kühle Tageszeiten legen",y);
    y=subhead(p,"Am Ziel",y);
    y=bullet(p,"Süßwasser zum Trinken anbieten (nicht Salz-/Seewasser)",y);
    y=bullet(p,"Heißer Sand verbrennt Pfoten - Schatten und Decke mitnehmen",y);
    y=tip(p,`Notier dir VOR der Abreise die nächste Tierklinik am Urlaubsort und speichere die Nummer im Handy - im Notfall zählt jede Minute. Die komplette Packliste zum Abhaken findest du auf der nächsten Seite.`,y); footer(p,15); }

  // 16 Packliste
  { const p=newPage(); let y=header(p,"ZUM ABHAKEN","Deine Sommer-Reise-Packliste");
    y=para(p,`Vor der Abfahrt durchgehen und abhaken - dann fehlt unterwegs nichts.`,y,{gap:6});
    y=checklist(p,["Wasser + faltbarer Napf","Kühlmatte","Nasses Halstuch / Kühltuch","Zeckenzange","Kleines Erste-Hilfe-Set","Hundedecke + Schattenspender","Futter + Napf","Impfpass / EU-Heimtierausweis","Leine + Geschirr (+ Ersatz)","Kotbeutel","Lieblingsspielzeug","Tierarzt-/Tierklinik-Nummer am Urlaubsort"],y); footer(p,16); }

  // 17 Sommer-Check
  { const p=newPage(); let y=header(p,"CHECKLISTE","Dein Sommer-Check vor jedem Gassi");
    y=para(p,`Kurz durchgehen, bevor ihr losgeht - besonders an heißen Tagen.`,y,{gap:6});
    y=checklist(p,["Wetter gecheckt + Hitze-Ampel (Seite 3) beachtet","7-Sekunden-Asphalt-Test gemacht","Wasser dabei","Kühle Tageszeit gewählt (nicht 11-18 Uhr)","Schatten-Route geplant","Bei Hitze: Kopfarbeit statt langer Runde"],y);
    y=tip(p,`Wenn auch nur ein Punkt nicht passt, plane um: spätere Uhrzeit, kürzere Runde oder Nasenarbeit drinnen. ${DOG} hat nichts davon, wenn die Runde ihn überhitzt - Sicherheit geht vor Programm.`,y); footer(p,17); }

  // 18 Notfall-Karte
  { const p=newPage(); let y=A4_H-70;
    const hint="Diese Karte ausschneiden und ins Portemonnaie legen - oder als Foto aufs Handy speichern.";
    for(const line of wrap(hint,F.italic,10,CONTENT_W)){const w=F.italic.widthOfTextAtSize(line,10); p.drawText(line,{x:(A4_W-w)/2,y,size:10,font:F.italic,color:TEXT_MEDIUM}); y-=15;}
    const cw=320,ch=420,cx=(A4_W-cw)/2,cyTop=y-20,cyBot=cyTop-ch;
    dashedBorder(p,cx-10,cyBot-10,cw+20,ch+20); rrect(p,cx,cyBot,cw,ch,12,BG_WARM);
    p.drawRectangle({x:cx,y:cyTop-52,width:cw,height:52,color:RED});
    p.drawText("BEI HITZSCHLAG",{x:cx+20,y:cyTop-28,size:17,font:F.bold,color:WHITE}); p.drawText("- jede Minute zählt -",{x:cx+20,y:cyTop-45,size:10,font:F.regular,color:rgb(1,0.9,0.88)});
    let yy=cyTop-78; const steps:[string,string][]=[["Schatten","Sofort in Schatten / kühlen Raum bringen"],["Kühlen","Kühles (NICHT eiskaltes) Wasser an Pfoten, Bauch, Innenschenkel"],["Trinken","Kühles Wasser anbieten, nicht zwingen"],["Tierarzt","SOFORT zum Tierarzt - auch wenn es besser wird"]];
    for(const[i,[t,d]]of steps.entries()){p.drawCircle({x:cx+30,y:yy-2,size:12,color:DARK_BROWN}); const nw=F.bold.widthOfTextAtSize(String(i+1),12); p.drawText(String(i+1),{x:cx+30-nw/2,y:yy-6,size:12,font:F.bold,color:WHITE}); p.drawText(S(t),{x:cx+50,y:yy-2,size:12,font:F.bold,color:TEXT_DARK}); yy-=17; for(const line of wrap(d,F.regular,9.5,cw-70)){p.drawText(line,{x:cx+50,y:yy,size:9.5,font:F.regular,color:TEXT_MEDIUM}); yy-=12.5;} yy-=8;}
    yy-=4; p.drawRectangle({x:cx+20,y:yy,width:cw-40,height:0.6,color:BORDER_LIGHT}); yy-=18;
    p.drawText("Mein Tierarzt:",{x:cx+20,y:yy,size:10,font:F.bold,color:DARK_BROWN}); p.drawLine({start:{x:cx+95,y:yy-2},end:{x:cx+cw-20,y:yy-2},thickness:0.8,color:BORDER_LIGHT}); yy-=22;
    p.drawText("Notdienst:",{x:cx+20,y:yy,size:10,font:F.bold,color:DARK_BROWN}); p.drawLine({start:{x:cx+95,y:yy-2},end:{x:cx+cw-20,y:yy-2},thickness:0.8,color:BORDER_LIGHT});
    const brand="Pfoten-Plan · Sommer-Sicherheit"; const bw=F.regular.widthOfTextAtSize(brand,8); p.drawText(brand,{x:cx+(cw-bw)/2,y:cyBot+14,size:8,font:F.regular,color:TEXT_LIGHT}); footer(p,18); }

  return await doc.save();
}
