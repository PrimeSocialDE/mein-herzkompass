// Read-only IMAP-Zugriff auf das support@pfoten-plan.de-Postfach.
//
// Zweck: Der Support-Autoresponder (app/api/cron/support-autoresponder) muss
// eingehende Kundenmails LESEN. Wir nutzen dasselbe Google-App-Passwort wie
// google-smtp.ts (GOOGLE_SMTP_USER / GOOGLE_SMTP_PASS) — es funktioniert für
// SMTP UND IMAP. So kommt KEINE neue Credential und KEINE OAuth-Einrichtung dazu.
//
// Bewusst OHNE imap-Library: rohes IMAP über node:tls, exakt im Stil von
// google-smtp.ts (fragiles lokales node_modules + kleiner Serverless-Bundle).
// Wir öffnen die Mailbox mit EXAMINE (read-only) — es wird nichts als gelesen
// markiert, nichts verändert. Nur Node-Runtime (nicht Edge).

import "server-only";
import tls from "node:tls";

const IMAP_HOST = "imap.gmail.com";
const IMAP_PORT = 993;

const USER = process.env.GOOGLE_SMTP_USER || "";
const PASS = process.env.GOOGLE_SMTP_PASS || "";

export interface InboundMail {
  uid: number;
  fromRaw: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo: string;
  internalDate: string;
  /** Bereinigter, lesbarer Text (dekodiert, HTML gestrippt, Zitat gekürzt). */
  text: string;
}

export interface FetchResult {
  mails: InboundMail[];
  maxUid: number;
  uidValidity: number;
}

export function googleImapConfigured(): boolean {
  return !!USER && !!PASS;
}

// ---------------------------------------------------------------------------
// Minimaler IMAP-Client
// ---------------------------------------------------------------------------

interface ImapConn {
  send: (tag: string, cmd: string) => Promise<string>;
  close: () => void;
}

function connect(): Promise<ImapConn> {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(IMAP_PORT, IMAP_HOST, { servername: IMAP_HOST });
    sock.setEncoding("utf8");
    let buf = "";
    let settledOpen = false;
    let onData: (() => void) | null = null;

    const fail = (e: Error) => {
      if (!settledOpen) {
        settledOpen = true;
        reject(e);
      }
      try { sock.destroy(); } catch {}
    };

    sock.setTimeout(25000, () => fail(new Error("imap_timeout")));
    sock.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));

    sock.on("data", (d: string) => {
      buf += d;
      if (onData) onData();
    });

    // Auf Server-Greeting (* OK ...) warten.
    const waitGreeting = () => {
      const nl = buf.indexOf("\r\n");
      if (nl === -1) return;
      buf = buf.slice(nl + 2);
      onData = null;
      settledOpen = true;
      resolve({ send, close: () => { try { sock.end(); } catch {} } });
    };
    onData = waitGreeting;
    waitGreeting();

    // Liest die vollständige Antwort auf ein Kommando (literal-bewusst) bis zur
    // getaggten Abschlusszeile "<tag> OK|NO|BAD ...".
    function send(tag: string, cmd: string): Promise<string> {
      return new Promise((res, rej) => {
        const check = () => {
          let i = 0;
          while (true) {
            const nl = buf.indexOf("\r\n", i);
            if (nl === -1) return; // mehr Daten nötig
            const line = buf.slice(i, nl);
            const lit = line.match(/\{(\d+)\}$/);
            if (lit) {
              const litLen = parseInt(lit[1], 10);
              const litStart = nl + 2;
              if (buf.length < litStart + litLen) return; // Literal noch unvollständig
              i = litStart + litLen; // Literal überspringen, weiterscannen
              continue;
            }
            if (line.startsWith(tag + " ")) {
              const full = buf.slice(0, nl);
              buf = buf.slice(nl + 2);
              onData = null;
              if (/^\S+\s+OK/i.test(line)) res(full);
              else rej(new Error("imap_cmd_failed: " + line.slice(0, 200)));
              return;
            }
            i = nl + 2;
          }
        };
        onData = check;
        sock.write(tag + " " + cmd + "\r\n");
        check();
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Parsing-Helfer
// ---------------------------------------------------------------------------

/** Zieht die Literale ({n}\r\n<n bytes>) in Reihenfolge aus einer Antwort. */
function extractLiterals(resp: string): string[] {
  const out: string[] = [];
  const re = /\{(\d+)\}\r\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(resp)) !== null) {
    const len = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    out.push(resp.slice(start, start + len));
    re.lastIndex = start + len;
  }
  return out;
}

function headerField(headerBlock: string, name: string): string {
  // Header entfalten (Folding: Folgezeilen beginnen mit Space/Tab).
  const unfolded = headerBlock.replace(/\r\n[ \t]+/g, " ");
  const re = new RegExp("^" + name + ":\\s*(.*)$", "im");
  const m = unfolded.match(re);
  return m ? m[1].trim() : "";
}

/** RFC-2047-dekodierte Kopfzeile (=?UTF-8?B?..?= / =?..?Q?..?=). */
function decodeMimeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_all, cs, enc, txt) => {
    try {
      if (enc.toUpperCase() === "B") {
        return Buffer.from(txt, "base64").toString("utf8");
      }
      // Q-Encoding
      const bytes = txt.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) =>
        String.fromCharCode(parseInt(h, 16))
      );
      return Buffer.from(bytes, "binary").toString("utf8");
    } catch {
      return txt;
    }
  });
}

function parseFromEmail(fromRaw: string): { email: string; name: string } {
  const dec = decodeMimeWords(fromRaw);
  const angle = dec.match(/<([^>]+)>/);
  const email = (angle ? angle[1] : dec).trim().toLowerCase();
  let name = angle ? dec.slice(0, dec.indexOf("<")).trim() : "";
  name = name.replace(/^"|"$/g, "").trim();
  return { email, name };
}

function decodeQuotedPrintable(s: string): string {
  const bytes = s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  try { return Buffer.from(bytes, "binary").toString("utf8"); } catch { return bytes; }
}

function looksBase64(s: string): boolean {
  const t = s.replace(/\s+/g, "");
  return t.length > 24 && /^[A-Za-z0-9+/=]+$/.test(t);
}

/** Rohen Body in lesbaren Text verwandeln (dekodieren, HTML strippen, Zitat kürzen). */
function cleanBody(rawText: string, cte: string, contentType: string): string {
  let body = rawText;

  // Bei multipart: ersten text/plain-Teil grob herausschneiden.
  if (/multipart\//i.test(contentType)) {
    const bMatch = contentType.match(/boundary="?([^";]+)"?/i);
    if (bMatch) {
      const parts = body.split("--" + bMatch[1]);
      const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
      const chosen = plain || parts.find((p) => /content-type:\s*text\/html/i.test(p)) || "";
      if (chosen) {
        const sep = chosen.indexOf("\r\n\r\n");
        const partCte = (chosen.match(/content-transfer-encoding:\s*(\S+)/i) || [])[1] || "";
        body = sep >= 0 ? chosen.slice(sep + 4) : chosen;
        cte = partCte || cte;
        if (/text\/html/i.test(chosen) && !plain) contentType = "text/html";
      }
    }
  }

  const enc = (cte || "").toLowerCase();
  if (enc.includes("base64") || (!enc && looksBase64(body))) {
    try { body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch {}
  } else if (enc.includes("quoted-printable")) {
    body = decodeQuotedPrintable(body);
  }

  if (/text\/html/i.test(contentType) || /<[a-z][\s\S]*>/i.test(body)) {
    body = body
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"');
  }

  // Zitierten Original-Verlauf abschneiden (typische Marker).
  const cutMarkers = [
    /\r?\n>+\s/, // >-Zitat
    /\r?\n[^\n]*schrieb[^\n]*:\s*\r?\n/i,
    /\r?\nAm .* um .* schrieb/i,
    /\r?\n-{2,} ?Original/i,
    /\r?\nVon:\s/i,
    /\r?\nGesendet mit der GMX/i,
  ];
  let cutAt = body.length;
  for (const re of cutMarkers) {
    const m = body.match(re);
    if (m && m.index !== undefined && m.index < cutAt && m.index > 20) cutAt = m.index;
  }
  body = body.slice(0, cutAt);

  return body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2500);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Holt neue eingehende Mails aus dem INBOX von support@.
 * @param sinceDays  Zeitfenster für die IMAP-Suche (SINCE), z.B. 2.
 * @param lastUid    Nur UIDs größer als dieser Wert zurückgeben (0 = alle im Fenster).
 * Gibt bereinigte Mails + die höchste gesehene UID + UIDVALIDITY zurück.
 */
export async function fetchInbound(sinceDays: number, lastUid: number): Promise<FetchResult> {
  if (!googleImapConfigured()) throw new Error("google_imap_not_configured");

  const conn = await connect();
  try {
    await conn.send("a1", `LOGIN "${USER}" "${PASS.replace(/"/g, '\\"')}"`);
    const examine = await conn.send("a2", "EXAMINE INBOX");
    const uvMatch = examine.match(/UIDVALIDITY (\d+)/i);
    const uidValidity = uvMatch ? parseInt(uvMatch[1], 10) : 0;

    // Datum für SINCE (IMAP-Format: DD-Mon-YYYY, englischsprachige Monate).
    const d = new Date(Date.now() - sinceDays * 86_400_000);
    const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
    const sinceStr = `${d.getUTCDate()}-${mon}-${d.getUTCFullYear()}`;

    const searchResp = await conn.send("a3", `UID SEARCH SINCE ${sinceStr}`);
    const searchLine = searchResp.split("\r\n").find((l) => /^\*\s+SEARCH/i.test(l)) || "";
    const uids = (searchLine.match(/\d+/g) || [])
      .map((n) => parseInt(n, 10))
      .filter((u) => u > lastUid)
      .sort((a, b) => a - b)
      .slice(-40); // Sicherheitslimit pro Lauf

    const mails: InboundMail[] = [];
    let maxUid = lastUid;

    for (const uid of uids) {
      if (uid > maxUid) maxUid = uid;
      const resp = await conn.send(
        "a" + (100 + uid),
        `UID FETCH ${uid} (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT])`
      );
      const lits = extractLiterals(resp);
      if (lits.length < 1) continue;
      const headerBlock = lits[0];
      const rawText = lits[1] || "";
      const idate = (resp.match(/INTERNALDATE "([^"]+)"/) || [])[1] || "";

      const fromRaw = headerField(headerBlock, "From");
      const { email, name } = parseFromEmail(fromRaw);
      const contentType = headerField(headerBlock, "Content-Type");
      const cte = headerField(headerBlock, "Content-Transfer-Encoding");

      mails.push({
        uid,
        fromRaw,
        fromEmail: email,
        fromName: decodeMimeWords(name),
        to: decodeMimeWords(headerField(headerBlock, "To")),
        subject: decodeMimeWords(headerField(headerBlock, "Subject")),
        date: headerField(headerBlock, "Date"),
        messageId: headerField(headerBlock, "Message-ID"),
        inReplyTo: headerField(headerBlock, "In-Reply-To"),
        internalDate: idate,
        text: cleanBody(rawText, cte, contentType),
      });
    }

    return { mails, maxUid, uidValidity };
  } finally {
    conn.close();
  }
}

/**
 * UIDs im INBOX, die aktuell mit \Flagged (Stern in Gmail) markiert sind.
 * Dient als manuelles Veto: markiert Max eine Kundenmail mit Stern, wird der
 * geplante Auto-Versand für diesen Fall übersprungen.
 */
export async function fetchFlaggedUids(sinceDays: number): Promise<Set<number>> {
  if (!googleImapConfigured()) return new Set();
  const conn = await connect();
  try {
    await conn.send("b1", `LOGIN "${USER}" "${PASS.replace(/"/g, '\\"')}"`);
    await conn.send("b2", "EXAMINE INBOX");
    const d = new Date(Date.now() - sinceDays * 86_400_000);
    const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
    const sinceStr = `${d.getUTCDate()}-${mon}-${d.getUTCFullYear()}`;
    const resp = await conn.send("b3", `UID SEARCH FLAGGED SINCE ${sinceStr}`);
    const line = resp.split("\r\n").find((l) => /^\*\s+SEARCH/i.test(l)) || "";
    return new Set((line.match(/\d+/g) || []).map((n) => parseInt(n, 10)));
  } catch {
    return new Set();
  } finally {
    conn.close();
  }
}
