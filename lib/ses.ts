// Amazon SES v2 Sender (SigV4, ohne SDK — node:crypto).
//
// Wird für den DE-Sequenz-Versand (z.B. Tag-30-Laura-Umfrage) genutzt, um von
// Brevo unabhängig zu sein und die neue Absenderdomain pfoten-post.de sauber
// aufzuwärmen. Absender-Domain muss in SES verifiziert sein (pfoten-post.de ist es).
//
// DSGVO: Caller übergibt eine sichtbare Abmelde-URL; wir setzen zusätzlich die
// List-Unsubscribe + List-Unsubscribe-Post (RFC 8058 One-Click) Header.

import crypto from "node:crypto";

const REGION = process.env.AWS_REGION || "eu-central-1";
const HOST = `email.${REGION}.amazonaws.com`;

export function sesConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

const hmac = (k: crypto.BinaryLike | Buffer, d: string) =>
  crypto.createHmac("sha256", k).update(d).digest();
const sha = (d: string) => crypto.createHash("sha256").update(d).digest("hex");

async function sesRequest(method: string, path: string, bodyObj: any) {
  const AK = process.env.AWS_ACCESS_KEY_ID!;
  const SK = process.env.AWS_SECRET_ACCESS_KEY!;
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const ds = amz.slice(0, 8);
  const ch = `content-type:application/json\nhost:${HOST}\nx-amz-date:${amz}\n`;
  const sh = "content-type;host;x-amz-date";
  const creq = [method, path, "", ch, sh, sha(body)].join("\n");
  const scope = `${ds}/${REGION}/ses/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n");
  let k = hmac("AWS4" + SK, ds);
  k = hmac(k, REGION);
  k = hmac(k, "ses");
  k = hmac(k, "aws4_request");
  const sig = crypto.createHmac("sha256", k).update(sts).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;
  const r = await fetch(`https://${HOST}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amz,
      Authorization: auth,
    },
    body: body || undefined,
  });
  return { status: r.status, data: await r.text() };
}

export interface SesMail {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string; // muss @verifizierter-Domain sein (pfoten-post.de)
  replyTo?: string;
  /** Sichtbare Abmelde-URL → wird als List-Unsubscribe (One-Click) gesetzt. */
  unsubscribeUrl?: string;
  tags?: string[];
}

/** Sendet eine Mail über SES v2. Wirft NICHT — gibt {ok,status,error} zurück,
 *  damit der Caller sauber auf Brevo zurückfallen kann. */
export async function sendViaSes(
  mail: SesMail
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!sesConfigured()) return { ok: false, status: 0, error: "ses_not_configured" };

  const headers: Array<{ Name: string; Value: string }> = [];
  if (mail.unsubscribeUrl) {
    headers.push({
      Name: "List-Unsubscribe",
      Value: `<${mail.unsubscribeUrl}>, <mailto:${mail.fromEmail}?subject=unsubscribe>`,
    });
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" });
  }

  const payload: any = {
    FromEmailAddress: `${mail.fromName} <${mail.fromEmail}>`,
    Destination: { ToAddresses: [mail.to] },
    Content: {
      Simple: {
        Subject: { Data: mail.subject, Charset: "UTF-8" },
        Body: { Html: { Data: mail.html, Charset: "UTF-8" } },
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
  };
  if (mail.replyTo) payload.ReplyToAddresses = [mail.replyTo];
  if (mail.tags && mail.tags.length) {
    payload.EmailTags = mail.tags.map((t, i) => ({
      Name: i === 0 ? "campaign" : `tag${i}`,
      Value: t.replace(/[^a-zA-Z0-9_-]/g, "-"),
    }));
  }

  try {
    const res = await sesRequest("POST", "/v2/email/outbound-emails", payload);
    if (res.status < 300) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: res.data.slice(0, 200) };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || "ses_fetch_failed" };
  }
}
