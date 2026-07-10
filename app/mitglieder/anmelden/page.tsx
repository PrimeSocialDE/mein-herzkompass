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

import { headers } from "next/headers";
import { langFromHost } from "@/lib/lang";

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

  // Pre-Auth-Seite (noch keine Member-E-Mail) → Sprache über Host: lapaplan.pl = pl.
  const lang = langFromHost((await headers()).get("host"));
  const t = lang === "pl"
    ? {
        done: "Już prawie!",
        incomplete: "Link niekompletny",
        clickInfo: "Kliknij raz „Zaloguj się”, żeby bezpiecznie wejść do swojego panelu członkowskiego.",
        loginBtn: "Zaloguj się →",
        scannerNote: "Ten krok chroni Twoje logowanie przed automatycznymi skanerami e-mail. Link jest ważny przez godzinę.",
        expired: "Ten link do logowania jest niekompletny lub wygasł. Po prostu poproś o nowy.",
        toLogin: "Do logowania →",
      }
    : {
        done: "Fast geschafft!",
        incomplete: "Link unvollständig",
        clickInfo: "Klick einmal auf „Anmelden“, um sicher in deinen Mitgliederbereich zu kommen.",
        loginBtn: "Jetzt anmelden →",
        scannerNote: "Dieser Schritt schützt deinen Login vor automatischen E-Mail-Scannern. Der Link gilt eine Stunde.",
        expired: "Dieser Anmelde-Link ist unvollständig oder abgelaufen. Fordere dir einfach einen neuen an.",
        toLogin: "Zum Login →",
      };

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
        {valid ? t.done : t.incomplete}
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
            {t.clickInfo}
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
              {t.loginBtn}
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
            {t.scannerNote}
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
            {t.expired}
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
            {t.toLogin}
          </a>
        </>
      )}
    </div>
  );
}
