// @ts-nocheck
// Edge function to seed/replace user_data for the demo account.
// Restricted to a hard-coded allow-list of emails — no other user_id can be touched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EMAILS = new Set<string>([
  "jv20101958@gmail.com",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, srk, { auth: { persistSession: false } });

    const body = await req.json();
    const { user_id, entries, mode } = body as {
      user_id: string;
      mode?: "replace" | "upsert";
      entries: Array<{ key: string; value: any }>;
    };

    if (!user_id || !Array.isArray(entries)) {
      return new Response(JSON.stringify({ error: "missing user_id or entries" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the target user is in the allow list.
    const { data: userRow, error: userErr } = await admin.auth.admin.getUserById(user_id);
    if (userErr || !userRow?.user) {
      return new Response(
        JSON.stringify({ error: "user not found", details: userErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const email = (userRow.user.email || "").toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      return new Response(JSON.stringify({ error: "forbidden user", email }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "replace") {
      const { error: delErr } = await admin
        .from("user_data")
        .delete()
        .eq("user_id", user_id);
      if (delErr) {
        return new Response(
          JSON.stringify({ error: "delete failed", details: delErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const rows = entries.map((e) => ({ user_id, key: e.key, value: e.value }));

    // Upsert in chunks to stay well under request size and statement limits.
    const CHUNK = 40;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await admin
        .from("user_data")
        .upsert(slice, { onConflict: "user_id,key" });
      if (error) {
        return new Response(
          JSON.stringify({
            error: "upsert failed",
            details: error.message,
            inserted_so_far: inserted,
            failing_chunk_first_key: slice[0]?.key,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      inserted += slice.length;
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, total: rows.length, mode: mode || "upsert", email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
