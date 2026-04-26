import { supabase } from "@/integrations/supabase/client";

/**
 * Server-side admin check via `user_roles` table + `has_role` RPC pattern.
 * NEVER trust client-side hardcoded ids for security decisions — always
 * also enforce via RLS policies on the server.
 */
export const checkIsAdmin = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[admin] role check failed:", error);
    return false;
  }
  return !!data;
};
