// Test ob Mollie Recurring-Payments + PayPal Mandate-Erstellung freigeschaltet
// ist. Wir erstellen einen Test-Customer + einen Test-Payment mit method=paypal
// und sequenceType=first. Wenn Mollie akzeptiert → Recurring ist aktiv.
// Wenn 422 zurueck → Mollie-Support kontaktieren.
//
// Test-Mode: NUR via MOLLIE_TEST_API_KEY wenn vorhanden, sonst Live (kein
// Charge, nur Create — die Payment-URL koennen wir auch wieder verwerfen).

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const key = process.env.MOLLIE_API_KEY; // Live-Key
console.log("=== Test 1: Customer create ===");

const customerRes = await fetch("https://api.mollie.com/v2/customers", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "mandate-test@pfoten-plan.de",
    name: "Test Mandate",
    locale: "de_DE",
    metadata: { test: "true", purpose: "recurring-availability-check" },
  }),
});
const customer = await customerRes.json();
console.log(`Status: ${customerRes.status}`);
if (customerRes.status >= 400) {
  console.log("❌ Customer create failed:", JSON.stringify(customer, null, 2));
  process.exit(1);
}
console.log(`✓ customer.id = ${customer.id}`);
console.log(`  createdAt = ${customer.createdAt}`);

console.log("\n=== Test 2: Payment mit sequenceType=first (PayPal) ===");
const paymentRes = await fetch("https://api.mollie.com/v2/payments", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: { currency: "EUR", value: "0.01" },
    description: "Pfoten-Plan Recurring-Availability-Test",
    redirectUrl: "https://www.pfoten-plan.de/zusatz.html",
    method: "paypal",
    customerId: customer.id,
    sequenceType: "first",
    metadata: { test: "true" },
  }),
});
const payment = await paymentRes.json();
console.log(`Status: ${paymentRes.status}`);
if (paymentRes.status >= 400) {
  console.log("❌ Payment mit PayPal+first failed:");
  console.log(JSON.stringify(payment, null, 2));
} else {
  console.log(`✓ payment.id = ${payment.id}`);
  console.log(`  status = ${payment.status}`);
  console.log(`  method = ${payment.method}`);
  console.log(`  sequenceType = ${payment.sequenceType}`);
  console.log(`  checkout-url = ${payment._links?.checkout?.href?.slice(0,80)}...`);
}

console.log("\n=== Test 3: Payment mit sequenceType=first (creditcard, ohne Method) ===");
const paymentResCC = await fetch("https://api.mollie.com/v2/payments", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: { currency: "EUR", value: "0.01" },
    description: "Pfoten-Plan CC-Recurring-Test",
    redirectUrl: "https://www.pfoten-plan.de/zusatz.html",
    customerId: customer.id,
    sequenceType: "first",
    metadata: { test: "true" },
  }),
});
const paymentCC = await paymentResCC.json();
console.log(`Status: ${paymentResCC.status}`);
if (paymentResCC.status >= 400) {
  console.log("❌ Payment mit sequenceType=first (ohne Method) failed:");
  console.log(JSON.stringify(paymentCC, null, 2));
} else {
  console.log(`✓ payment.id = ${paymentCC.id}`);
  console.log(`  status = ${paymentCC.status}`);
  console.log(`  sequenceType = ${paymentCC.sequenceType}`);
}

console.log("\n=== Test 4: Existierende Mandates des Customers (sollte leer sein) ===");
const mandatesRes = await fetch(`https://api.mollie.com/v2/customers/${customer.id}/mandates`, {
  headers: { Authorization: `Bearer ${key}` },
});
const mandates = await mandatesRes.json();
console.log(`Status: ${mandatesRes.status}`);
console.log(`  count = ${mandates.count}`);

console.log("\n=== Cleanup: Test-Customer + Test-Payments stehenlassen ===");
console.log("(Mollie loescht Customers nicht via API; sie bleiben harmlos im Dashboard)");

console.log("\n=== Fazit ===");
const okPayPal = paymentRes.status < 400;
const okCC = paymentResCC.status < 400;
if (okPayPal && okCC) {
  console.log("✅ Recurring ist AKTIV — PayPal + Creditcard akzeptieren sequenceType=first");
  console.log("   → One-Click-Upsells funktionieren sobald echte Kunden bezahlen");
} else if (okCC && !okPayPal) {
  console.log("⚠️  Creditcard recurring OK, aber PayPal recurring NICHT freigeschaltet");
  console.log("   → Mollie-Support kontaktieren: 'PayPal Billing Agreement aktivieren'");
} else if (!okCC) {
  console.log("❌ Recurring ist NICHT aktiviert");
  console.log("   → Mollie-Support kontaktieren");
}
