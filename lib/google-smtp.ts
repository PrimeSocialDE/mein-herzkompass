// Transaktionaler Mailversand über Google Workspace SMTP (support@pfoten-plan.de).
//
// Warum: Brevos geteilte IPs haben bei deutschen Freemailern (web.de, GMX,
// t-online) eine schlechte Reputation — Plan- und Login-Mails landen dort oft
// gar nicht. Google ist bei diesen Providern vertraut. Wir routen deshalb die
// TRANSAKTIONALEN DE-Mails (Plan-Auslieferung, Login-Code, Beleg) über Google,
// Marketing bleibt auf Brevo. PL-Mails (pomoc@lapaplan.pl) bleiben ebenfalls auf
// Brevo — Google kann nur als support@pfoten-plan.de senden.
//
// Bewusst OHNE nodemailer: roher SMTP über node:tls, damit keine neue Dependency
// dazukommt (das lokale node_modules ist fragil) und der Serverless-Bundle klein
// bleibt. Nur im Node-Runtime nutzbar (nicht Edge).

import "server-only";
import tls from "node:tls";

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465; // implizites TLS

const GOOGLE_SMTP_USER = process.env.GOOGLE_SMTP_USER || "";
const GOOGLE_SMTP_PASS = process.env.GOOGLE_SMTP_PASS || "";

export interface GoogleSmtpMail {
  to: string;
  subject: string;
  html: string;
  /** Optionaler Plain-Text-Teil (multipart/alternative). */
  text?: string;
  attachments?: Array<{ name: string; contentBase64: string }>;
  cc?: string | string[];
  /** Anzeigename des Absenders. Default "Max von Pfoten-Plan". */
  fromName?: string;
  /** Reply-To. Default support@pfoten-plan.de. */
  replyTo?: string;
  /** Zusätzliche Header (z.B. List-Unsubscribe für Login-Mails). */
  extraHeaders?: Record<string, string>;
}

/** Sind die Google-SMTP-Credentials gesetzt? */
export function googleSmtpConfigured(): boolean {
  return !!GOOGLE_SMTP_USER && !!GOOGLE_SMTP_PASS;
}

function encodeHeaderWord(s: string): string {
  // RFC 2047 für Nicht-ASCII (Umlaute, Emoji) in Subject/Anzeigename.
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, "$1\r\n");
}

function buildMime(mail: GoogleSmtpMail, from: string): string {
  const replyTo = mail.replyTo || "support@pfoten-plan.de";
  const ccList = mail.cc
    ? (Array.isArray(mail.cc) ? mail.cc : [mail.cc]).filter(Boolean)
    : [];

  const headers: string[] = [
    `From: ${from}`,
    `To: ${mail.to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeaderWord(mail.subject)}`,
    `MIME-Version: 1.0`,
  ];
  if (ccList.length) headers.push(`Cc: ${ccList.join(", ")}`);
  for (const [k, v] of Object.entries(mail.extraHeaders || {})) {
    headers.push(`${k}: ${v}`);
  }

  const htmlB64 = wrap76(Buffer.from(mail.html, "utf8").toString("base64"));
  const textB64 = mail.text
    ? wrap76(Buffer.from(mail.text, "utf8").toString("base64"))
    : null;

  // Body-Struktur je nach Inhalt.
  const htmlPart = [
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlB64,
  ].join("\r\n");

  const textPart = textB64
    ? [
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        textB64,
      ].join("\r\n")
    : null;

  // text + html → multipart/alternative
  const altBoundary = "==ALT_pfoten==";
  const bodyBlock = textPart
    ? [
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        ``,
        `--${altBoundary}`,
        textPart,
        `--${altBoundary}`,
        htmlPart,
        `--${altBoundary}--`,
      ].join("\r\n")
    : htmlPart;

  if (!mail.attachments || mail.attachments.length === 0) {
    return headers.join("\r\n") + "\r\n" + bodyBlock + "\r\n";
  }

  // Mit Anhängen → multipart/mixed umschließen.
  const mixBoundary = "==MIX_pfoten==";
  const parts: string[] = [
    `Content-Type: multipart/mixed; boundary="${mixBoundary}"`,
    ``,
    `--${mixBoundary}`,
    bodyBlock,
  ];
  for (const a of mail.attachments) {
    parts.push(
      `--${mixBoundary}`,
      `Content-Type: application/octet-stream; name="${a.name}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${a.name}"`,
      ``,
      wrap76(a.contentBase64.replace(/\s+/g, ""))
    );
  }
  parts.push(`--${mixBoundary}--`);
  return headers.join("\r\n") + "\r\n" + parts.join("\r\n") + "\r\n";
}

/**
 * Sendet eine Mail über Google Workspace SMTP als support@pfoten-plan.de.
 * Wirft bei jedem Fehler (AUTH, RCPT, Timeout) — Caller soll dann auf Brevo
 * zurückfallen. Gibt bei Erfolg { ok: true } zurück.
 */
export function sendViaGoogleSmtp(mail: GoogleSmtpMail): Promise<{ ok: true }> {
  if (!googleSmtpConfigured()) {
    return Promise.reject(new Error("google_smtp_not_configured"));
  }
  if (!mail.to) return Promise.reject(new Error("no_recipient"));

  const from = `${encodeHeaderWord(mail.fromName || "Max von Pfoten-Plan")} <${GOOGLE_SMTP_USER}>`;
  const rcpts = [
    mail.to,
    ...(mail.cc ? (Array.isArray(mail.cc) ? mail.cc : [mail.cc]) : []),
  ].filter(Boolean);
  // Dot-Stuffing: Zeilen, die mit "." beginnen, verdoppeln (RFC 5321 §4.5.2).
  const message = buildMime(mail, from).replace(/\r\n\./g, "\r\n..");

  return new Promise((resolve, reject) => {
    const sock = tls.connect(SMTP_PORT, SMTP_HOST, { servername: SMTP_HOST });
    sock.setEncoding("utf8");
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        sock.end();
      } catch {}
      err ? reject(err) : resolve({ ok: true });
    };
    sock.setTimeout(20000, () => done(new Error("smtp_timeout")));
    sock.on("error", (e) => done(e instanceof Error ? e : new Error(String(e))));

    let buffer = "";
    const waiters: Array<(line: string) => void> = [];
    sock.on("data", (d: string) => {
      buffer += d;
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (/^\d{3} /.test(line)) {
          const w = waiters.shift();
          if (w) w(line);
        }
      }
    });
    const expect = (ok: string) =>
      new Promise<string>((res, rej) => {
        waiters.push((line) => {
          if (line.startsWith(ok)) res(line);
          else rej(new Error(`smtp_unexpected: ${line}`));
        });
      });
    const send = (line: string) => sock.write(line + "\r\n");

    (async () => {
      await expect("220");
      send("EHLO pfoten-plan.de");
      await expect("250");
      send("AUTH LOGIN");
      await expect("334");
      send(Buffer.from(GOOGLE_SMTP_USER).toString("base64"));
      await expect("334");
      send(Buffer.from(GOOGLE_SMTP_PASS).toString("base64"));
      await expect("235");
      send(`MAIL FROM:<${GOOGLE_SMTP_USER}>`);
      await expect("250");
      for (const r of rcpts) {
        send(`RCPT TO:<${r}>`);
        await expect("250");
      }
      send("DATA");
      await expect("354");
      sock.write(message + "\r\n.\r\n");
      await expect("250");
      send("QUIT");
      done();
    })().catch((e) => done(e instanceof Error ? e : new Error(String(e))));
  });
}
