import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { COLUNAS_PAGANTE, clientePagante, entradaIndiqueAqui, type LinhaCompra } from "@/lib/indique-entrada";

/**
 * A entrada do indique vale PRA ESTA PESSOA, AQUI? (17/11, subida) — site + chave INDIQUE_ENTRADA + logada + cliente pagante.
 * Uma consulta por conta por abertura (a linha da Você, o balão e o pontinho perguntam juntos: a resposta é dividida).
 * Erro de rede = não mostra (nada de "Novo" pra quem talvez nem pague).
 */
const cache = new Map<string, Promise<boolean>>();
export const __zerarElegivelIndique = () => cache.clear();

function perguntar(uid: string): Promise<boolean> {
  let p = cache.get(uid);
  if (!p) {
    p = (async () => {
      try {
        const { data, error } = await supabase.from("subscriptions").select(COLUNAS_PAGANTE).eq("user_id", uid);
        if (error) { cache.delete(uid); return false; }
        return clientePagante((data ?? []) as LinhaCompra[]);
      } catch { cache.delete(uid); return false; }
    })();
    cache.set(uid, p);
  }
  return p;
}

export function useIndiqueElegivel(forcar?: boolean): { elegivel: boolean; uid: string | null } {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [ligado] = useState(() => forcar ?? entradaIndiqueAqui());
  const [elegivel, setElegivel] = useState(!!forcar);
  useEffect(() => {
    if (forcar !== undefined || !ligado || !uid) return;
    let vivo = true;
    void perguntar(uid).then((ok) => { if (vivo) setElegivel(ok); });
    return () => { vivo = false; };
  }, [ligado, uid, forcar]);
  return { elegivel: forcar ?? (ligado && !!uid && elegivel), uid };
}
