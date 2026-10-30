import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useHomeNova } from "@/hooks/use-home-nova";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_HOME_ESCOLHA, escolhaDaHomeVale, origemConhecida, marcadorDaEscolha, registrarEscolhaDaHome, type EscolhaDaHome, type ViaDaEscolha,
} from "@/lib/home-nova";

/**
 * 1.0.22 (dono 28/10) — "Home: Nova / Clássica" (lib/home-nova › ESCOLHA DA HOME). Quem mostra a linha (Você, o menu da
 * conta) e o convite usam isto:
 *   · `disponivel` — a escolha existe AQUI (iPhone ou site, conta logada, `home_nova` ≠ "off"/"admin"). No Android: false;
 *   · `atual` — a Home que a pessoa vê agora (a regra de sempre + a escolha, se houver);
 *   · `escolher(para, via)` — grava na CONTA (`core-home-escolha`, sobe pro user_data: vale nos outros aparelhos), espelha
 *     no aparelho, avisa quem decide (a Home troca no próximo render) e manda `home_escolha {de, para, via}`.
 * Trocar não apaga nada: as duas Homes leem os mesmos dados. A cor do tema volta sozinha na clássica (pages/Home devolve
 * `core-cor-antes-home-nova`) e a nova força o Original de novo (HomeE guarda a cor da pessoa).
 */
export function useEscolhaDaHome(): { disponivel: boolean; atual: EscolhaDaHome; escolher: (para: EscolhaDaHome, via: ViaDaEscolha) => void } {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const { set, isGuest } = useUserData();
  const homeNova = useHomeNova(user);
  const atual: EscolhaDaHome = homeNova.ligada ? "nova" : "classica";
  const uid = user?.id ?? null;
  // 1.0.22 (dono 28/10): só conta ANTIGA confirmada vê a escolha (a linha em Você); conta nova e origem desconhecida, nunca
  const disponivel = !!uid && !isGuest && origemConhecida(uid) === "antiga" && escolhaDaHomeVale(homeNova.modo);

  const escolher = useCallback((para: EscolhaDaHome, via: ViaDaEscolha) => {
    if (!uid) return;
    set(CHAVE_HOME_ESCOLHA, marcadorDaEscolha(para, via), { system: true });
    registrarEscolhaDaHome(uid, para);
    trackEvent("home_escolha", { de: atual, para, via });
  }, [uid, set, atual]);

  return { disponivel, atual, escolher };
}
