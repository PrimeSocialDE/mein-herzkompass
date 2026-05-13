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

  // 1) Auth-User suchen oder anlegen
  let userId: string | null = null;
  try {
    const { data: listData } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = (listData?.users || []).find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (cErr) {
        console.warn("[challenges-seed] createUser failed:", cErr.message);
        return { ok: false, reason: "create_user_failed" };
      }
      userId = created?.user?.id || null;
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
