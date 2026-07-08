// Zahlungs-Logos als Trust-Element am Checkout — die Original-Bilder aus /public.
// Bewusst klein & dezent gehalten.

const LOGOS: { src: string; alt: string }[] = [
  { src: "/visa-logo.png", alt: "Visa" },
  { src: "/mastercard-logo.png", alt: "Mastercard" },
  { src: "/paypal-logo.png", alt: "PayPal" },
  { src: "/applepay.png", alt: "Apple Pay" },
  { src: "/klarna-logo.png", alt: "Klarna" },
  { src: "/sepa-logo.png", alt: "SEPA-Lastschrift" },
];

export default function PaymentLogos() {
  return (
    <div
      aria-label="Akzeptierte Zahlungsmethoden"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
      }}
    >
      {LOGOS.map((l) => (
        <span
          key={l.src}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 22,
            padding: "0 6px",
            background: "#fff",
            border: "1px solid #ECE3D2",
            borderRadius: 5,
            boxShadow: "0 1px 1.5px rgba(0,0,0,.04)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.src}
            alt={l.alt}
            style={{ height: 13, width: "auto", display: "block", objectFit: "contain" }}
          />
        </span>
      ))}
    </div>
  );
}
