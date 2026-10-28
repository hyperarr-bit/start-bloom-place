import { isNativeShell } from "@/lib/native-shell";

/**
 * HOME NOVA NO SITE PRA CONTA NOVA (dono 27/10: "bora botar essa versão pras contas criadas na web, tipo nova home
 * figurinha mas sem tutorial e etc").
 *
 * Com a chave "on", no SITE (navegador — nunca no app das lojas):
 *   · a origem da conta ("nova"/"antiga") é decidida também aqui, com a MESMA régua do app (conta criada há < 48 h E
 *     sem missão em doses de antes da 1.0.19) e gravada na CONTA (`core-home-nova-origem`) — uma vez nova/antiga, pra
 *     sempre (o app lê o mesmo marcador e nunca reclassifica);
 *   · o modo da Home nova no site vira "novas" (lib/home-nova `padraoHomeNova`): conta NOVA vê a Home "E" (carrossel do
 *     dia + barra de vidro + figurinhas/Conquistas); conta ANTIGA, inclusive o admin, fica com a Home de hoje;
 *   · conta nova tem o FLUXO ENXUTO (lib/fluxo-enxuto): sem tutorial/intro de módulo, montar Finanças/Rotina, tour,
 *     cartões e dicas — fica só a dica do "+" da Home nova — e as festas de figurinha com calma (lib/festas-calma).
 * O funil/paywall da web, o app do Android e o do iPhone não mudam.
 *
 * ROLLBACK: WEB_HOME_NOVA = "off" + push → o site exatamente como antes (nada é classificado nem gravado; as contas
 * que já ganharam o marcador "nova" no site voltam pra Home de hoje no site — o marcador fica na conta e só o app o lê).
 *
 * Testes: `globalThis.__WEB_HOME_NOVA__ = "on" | "off"` força (src/test/setup.ts deixa "off" — a suíte de antes descreve
 * o site de hoje; os testes desta chave apagam o global).
 */
export type ModoWebHomeNova = "on" | "off";
export const WEB_HOME_NOVA: ModoWebHomeNova = "on";

/** A chave vale AQUI? (só no site; no app das lojas é sempre não — lá quem manda é a regra do app) */
export function webHomeNovaLigada(): boolean {
  try {
    if (isNativeShell()) return false;
    const g = (globalThis as { __WEB_HOME_NOVA__?: unknown }).__WEB_HOME_NOVA__;
    if (g === "on" || g === "off") return g === "on";
    return WEB_HOME_NOVA === "on";
  } catch { return false; }
}

/**
 * SCORE DA CONTA NOVA DO SITE (dono 27/10, depois do teste: "1 gasto já dá 100 · Dia completo"). No site não há missão
 * em doses, e a régua do novato (lib/pendencias-novato) conta só o que a pessoa usa — o 1º gasto virava 100. Na conta
 * NOVA do site (chave on, régua do novato valendo) o score conta os 3 cards da 1ª página do carrossel, com o MESMO peso:
 * Gasto, Hábitos e Água — 1 gasto = 33, os 3 completos = 100. Os 3 também entram na lista de pendências do novato.
 * Escondido em "Personalizar" sai da conta; nenhum visível = 0. App das lojas e conta antiga: a conta de sempre.
 */
export const TIPOS_DO_SCORE_SITE_NOVO = ["gasto", "habitos", "agua"] as const;
export function scoreDaContaNovaNoSite(blocos: ReadonlyArray<{ tipo: string; pontos: number; max: number }>, ocultos: readonly string[] = []): number {
  const tipos = TIPOS_DO_SCORE_SITE_NOVO.filter((t) => !ocultos.includes(t));
  if (tipos.length === 0) return 0;
  const fracao = (t: string) => { const b = blocos.find((x) => x.tipo === t); return b && b.max > 0 ? Math.min(1, Math.max(0, b.pontos / b.max)) : 0; };
  return Math.round((tipos.reduce((s, t) => s + fracao(t), 0) / tipos.length) * 100);
}
