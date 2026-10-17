import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import {
  contaElegivelAoPainelLimpo, guardarForcaPainelDaUrl, lembrarPainelLimpo, mostrarPainelLimpo,
} from "@/lib/financas-painel-limpo";

/**
 * O Dashboard de Finanças abre LIMPO? (1.0.16 — régua, chave e memória em lib/financas-painel-limpo.)
 * Chamado no topo de pages/Index — na abertura do módulo, em qualquer aba — pra a decisão sair com o
 * módulo ainda vazio, antes do primeiro lançamento (não depende do Montar, que desde 17/10 só abre pela
 * missão). O "sim" é guardado no aparelho (por conta) e na conta assim que o dado da conta chega.
 */
export function usePainelLimpo(isPreview: boolean): boolean {
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  // `?painel-limpo=on|off|auto` (QA, só navegador): lido uma vez por montagem
  const leuUrl = useRef(false);
  if (!leuUrl.current) { leuUrl.current = true; guardarForcaPainelDaUrl(); }

  const uid = user?.id ?? null;
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  const elegivel = contaElegivelAoPainelLimpo({ uid, criadoEm, get, loaded, isGuest, isPreview });

  useEffect(() => {
    if (elegivel !== true || !uid || !loaded) return;
    lembrarPainelLimpo(uid, get, set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegivel, uid, loaded]);

  return mostrarPainelLimpo(elegivel);
}
