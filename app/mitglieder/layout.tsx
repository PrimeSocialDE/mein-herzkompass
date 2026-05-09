import type { Metadata } from "next";
import SiteShell from "@/components/mitglieder/SiteShell";
import { getCurrentMember } from "@/lib/member-auth";

export const metadata: Metadata = {
  title: "Mein Pfoten-Plan",
  description: "Dein persönlicher Trainings-Bereich",
};

export const dynamic = "force-dynamic";

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

  return <SiteShell email={email}>{children}</SiteShell>;
}
