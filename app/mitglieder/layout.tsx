import "./mitglieder.css";
import type { Metadata } from "next";
import Script from "next/script";
import SiteShell from "@/components/mitglieder/SiteShell";
import { getCurrentMember } from "@/lib/member-auth-server";
import { getMemberLang } from "@/lib/member-lang";

export const metadata: Metadata = {
  title: "Mein Pfoten-Plan",
  description: "Dein persönlicher Trainings-Bereich",
};

export const dynamic = "force-dynamic";

// IDs hardcoded weil identisch zu den Landing-Pages (deinplan3/4, kurz-schritt*).
// Ueber env-Override moeglich falls in Zukunft getrennt.
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "864109602683515";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "ufxcf43805";

export default async function MitgliederLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Email für Sidebar holen — fällt auf undefined zurück wenn nicht eingeloggt
  // (dann zeigt die Sidebar keine Email-Zeile, Login-Page rendert dennoch sauber)
  let email: string | undefined;
  try {
    const user = await getCurrentMember();
    email = user?.email;
  } catch {
    email = undefined;
  }
  // Sprache des Members (answers.lang) → Navigation/Shell auf Polnisch. Default de.
  const lang = await getMemberLang(email);

  return (
    <>
      {/* Facebook Pixel — track Dashboard-PageView, plus fbp/fbc Cookies
          werden gesetzt damit der Mollie-Checkout (oder /api/brevo-contact)
          sie via Cookies an Server schicken kann. */}
      <Script id="fb-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${FB_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>

      {/* Microsoft Clarity — Session-Recording + Heatmaps fuer Dashboard.
          Damit sehen wir wie eingeloggte User durch den Bereich klicken. */}
      <Script id="ms-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");
        `}
      </Script>

      <SiteShell email={email} lang={lang}>{children}</SiteShell>
    </>
  );
}
