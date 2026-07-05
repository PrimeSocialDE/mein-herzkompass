// app/mitglieder/anmelden/page.tsx
//
// Scanner-sichere Login-Bestaetigung. Der Magic-Link in der Auth-Mail zeigt auf
// DIESE Seite (statt direkt auf /mitglieder/callback). Hier wird NICHTS
// eingeloest — es wird nur ein POST-Formular mit "Jetzt anmelden"-Button
// gerendert. Erst beim echten Klick (POST an /mitglieder/callback) wird der
// Einmal-Token via verifyOtp eingeloest.
//
// Warum: E-Mail-Sicherheitsscanner (GMX, web.de, Outlook Safe Links) rufen
// Links automatisch per GET vorab ab und verbrennen so den Einmal-Token —
// dann funktionieren weder Link noch der 6-stellige Code. Scanner submitten
// aber keine POST-Formulare → der Token bleibt gueltig bis zum echten Klick.

export const dynamic = "force-dynamic";

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: any;
}) {
  const sp = (await Promise.resolve(searchParams)) || {};
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : "";
  const type = typeof sp.type === "string" ? sp.type : "magiclink";
  let next = typeof sp.next === "string" ? sp.next : "/mitglieder";
  if (!next.startsWith("/")) next = "/mitglieder"; // Open-Redirect-Schutz

  const valid = !!tokenHash;

  return (
    <div
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "40px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>🐾</div>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "#1a1a1a",
          lineHeight: 1.2,
          margin: "0 0 10px",
        }}
      >
        {valid ? "Fast geschafft!" : "Link unvollständig"}
      </h1>

      {valid ? (
        <>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#6B7280",
              margin: "0 auto 26px",
              maxWidth: "32ch",
            }}
          >
            Klick einmal auf „Anmelden", um sicher in deinen Mitgliederbereich zu
            kommen.
          </p>

          <form method="POST" action="/mitglieder/callback">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 17,
                fontWeight: 800,
                color: "#fff",
                background: "linear-gradient(180deg,#CAA86F,#B0894E)",
                border: 0,
                borderRadius: 14,
                padding: "15px 34px",
                cursor: "pointer",
                boxShadow: "0 10px 22px -10px rgba(176,137,78,.8)",
              }}
            >
              Jetzt anmelden →
            </button>
          </form>

          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "#9aa2ad",
              margin: "22px auto 0",
              maxWidth: "34ch",
            }}
          >
            Dieser Schritt schützt deinen Login vor automatischen E-Mail-Scannern.
            Der Link gilt eine Stunde.
          </p>
        </>
      ) : (
        <>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#6B7280",
              margin: "0 auto 22px",
              maxWidth: "32ch",
            }}
          >
            Dieser Anmelde-Link ist unvollständig oder abgelaufen. Fordere dir
            einfach einen neuen an.
          </p>
          <a
            href="/mitglieder/login"
            style={{
              display: "inline-block",
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              background: "linear-gradient(180deg,#CAA86F,#B0894E)",
              borderRadius: 14,
              padding: "14px 28px",
              textDecoration: "none",
            }}
          >
            Zum Login →
          </a>
        </>
      )}
    </div>
  );
}
