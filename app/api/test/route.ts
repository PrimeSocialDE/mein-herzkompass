import { supabase } from "@/lib/db";   // falls Alias eingerichtet
// Falls nicht → import { supabase } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("orders")
    .insert([{ email: "kunde@test.de", name: "Testkunde", status: "queued" }])
    .select();

  return new Response(JSON.stringify({ data, error }), { status: 200 });
}