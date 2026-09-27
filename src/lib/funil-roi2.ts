/**
 * FUNIL ROI 2 — a chave única do redesenho do /inicio (27/09/2026).
 *
 * O que o dono aprovou (prancha antes/depois em scratchpad/funil-roi2, "faz
 * tudo e não precisa do teste A/B, bota logo como principal"): em toda tela,
 * da porta ao Pix, o funil diz que a pessoa escolhe por onde COMEÇAR e leva os
 * 16 módulos; o preço diz "não é mensal, não é anual"; o paywall ganha o bloco
 * "É confiável?" só com fatos, os 16 com ✓ em TODAS as trilhas (a de dinheiro
 * via só a comparação com planilha — e pagava o Pix a 38% contra 60% de quem
 * escolhia "Tudo"), 3 avaliações reais da Play e o CTA "Liberar os 16 módulos".
 * Motivo medido: 62% escolhem UMA área na porta e o comentário do Instagram
 * ("entendi que seria só pra uma das áreas… desisti") é a leitura literal do
 * funil de hoje.
 *
 * SEM A/B, de propósito: todo mundo vê a mesma versão. O que fica é o
 * ROLLBACK DE UMA LINHA — `FUNIL_ROI2 = false` + push devolve o funil de
 * 19/09 inteiro (porta, copy, ordem do paywall, cadastro de 3 campos, recibo).
 *
 * QA num navegador só, sem mexer no funil de ninguém: localStorage
 * `funil-roi2-force` = "on" | "off". Serve pra tirar print do "antes" no mesmo
 * build e pra conferir o rollback ao vivo.
 */
export const FUNIL_ROI2 = true;

const CHAVE_FORCA = "funil-roi2-force";

export function ehFunilRoi2(): boolean {
  try {
    const f = localStorage.getItem(CHAVE_FORCA);
    if (f === "on") return true;
    if (f === "off") return false;
  } catch { /* storage bloqueado (webview) — vale a constante */ }
  return FUNIL_ROI2;
}
