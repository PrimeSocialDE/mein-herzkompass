import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* OpenAI / ChatGPT Ads Pixel (oaiq) — auf allen App-Seiten */}
        <Script src="/oaiq.js" strategy="afterInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
