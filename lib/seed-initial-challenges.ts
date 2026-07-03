// Initial-Seed direkt nach Mollie-Payment.
//
// Wird AUSSCHLIESSLICH von Server-API-Routes verwendet:
//   - /api/mitglieder/plan/generate
//   - /api/cron/process-paid-leads
//
// Bewusst NICHT in lib/member-challenges.ts — sonst wuerde die
// /mitglieder/erfolge/challenges-Page (die member-challenges importiert)
// alle hier verwendeten Module ins Function-Bundle ziehen (auth.admin,
// member-mail → pdf-builder → pdf-lib, etc).
//
// Schritte:
// 1) Auth-User sicherstellen (createUser falls noch nicht da)
// 2) Member-Profil sicherstellen (getOrCreateMemberProfile)
// 3) getOrAssignWeekChallenges aufrufen — das triggert auto die
//    Welcome-Challenges-Mail durch die existierende isFirstEver-Logik.

// Findet einen Auth-User per E-Mail ueber ALLE Seiten (nicht nur die ersten 200).
// Die alte "page:1"-Suche verfehlte bestehende Accounts bei >200 Usern.
async function findAuthUserIdByEmail(sb: any, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 60; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const u = (data.users as any[]).find(
      (x) => (x.email || "").toLowerCase() === target
    );
    if (u) return u.id;
    if (data.users.length < 200) return null; // letzte Seite
  }
  return null;
}

export async function seedInitialChallengesForEmail(
  email: string
): Promise<{ ok: boolean; reason?: string; challenges_count?: number }> {
  if (!email) return { ok: false, reason: "no_email" };

  const { createClient } = await import("@supabase/supabase-js");
  const supaUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supaUrl || !serviceRole) {
    return { ok: false, reason: "no_supabase_credentials" };
  }
  const sb = createClient(supaUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Auth-User anlegen (BESTAETIGT) oder — falls vorhanden — finden UND bestaetigen.
  //    createUser zuerst: neue Accounts sind so sofort einloggbar (email_confirm).
  //    Bei "already registered" den bestehenden User ueber ALLE Seiten finden und
  //    bestaetigen — das behebt den Login-Bug (unbestaetigte Alt-Accounts, die die
  //    alte page-1-Suche verfehlte, worauf createUser scheiterte).
  let userId: string | null = null;
  try {
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created?.user?.id) {
      userId = created.user.id;
    } else if (cErr && /(already|registered|exist)/i.test(cErr.message || "")) {
      userId = await findAuthUserIdByEmail(sb, email);
      if (userId) {
        // Sicherstellen, dass der (evtl. unbestaetigte) Account bestaetigt ist.
        const { error: uErr } = await sb.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });
        if (uErr) console.warn("[challenges-seed] confirm failed:", uErr.message);
      }
    } else if (cErr) {
      console.warn("[challenges-seed] createUser failed:", cErr.message);
      return { ok: false, reason: "create_user_failed" };
    }
  } catch (e: any) {
    console.warn("[challenges-seed] auth-user step failed:", e?.message);
    return { ok: false, reason: "auth_step_exception" };
  }

  if (!userId) return { ok: false, reason: "no_user_id" };

  // 2) Member-Profil sicherstellen (lazy-syncs vom Lead inkl. quiz_result)
  let member;
  try {
    const { getOrCreateMemberProfile } = await import("./member-db");
    member = await getOrCreateMemberProfile({ userId, email });
  } catch (e: any) {
    console.warn("[challenges-seed] member-profile step failed:", e?.message);
    return { ok: false, reason: "member_profile_exception" };
  }

  // 3) Initial-Challenges erzeugen (welcome-mail wird intern auto getriggert)
  try {
    const { getOrAssignWeekChallenges } = await import("./member-challenges");
    const challenges = await getOrAssignWeekChallenges(member);
    return { ok: true, challenges_count: challenges.length };
  } catch (e: any) {
    console.warn("[challenges-seed] assign-week failed:", e?.message);
    return { ok: false, reason: "assign_week_exception" };
  }
}
