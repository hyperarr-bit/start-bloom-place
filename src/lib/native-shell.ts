/**
 * Detecção "estou rodando dentro do APP da loja" (Capacitor) — 22/07.
 *
 * Por que existe: dentro do app Android, conteúdo digital SÓ pode ser vendido
 * pelo Play Billing (regra do Play no Brasil até ~09/2027). Toda superfície
 * de Pix/checkout web precisa bifurcar pra ASSINATURA quando isNativeShell().
 *
 * Por que sem import do @capacitor/core: o runtime do Capacitor injeta
 * window.Capacitor sozinho dentro do shell. Checar o global mantém o bundle
 * WEB byte-idêntico (zero dependência nova no caminho quente do funil).
 *
 * Não confundir com rodandoInstalado() (pwa-install.ts): aquilo é PWA no
 * navegador — este aqui é o binário da loja. O PWA continua vendendo Pix.
 */
export const isNativeShell = (): boolean => {
  try {
    const c = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return c?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

/** Preços da ASSINATURA do app (arquitetura decidida 22/07 com pesquisa):
 *  - mensal é ÂNCORA (existe pra fazer o anual parecer 67% off — proporção
 *    Cal AI), visível mas apagado no paywall.
 *  - anual é o produto real, com trial de 3 dias (padrão Cal AI/BitePal).
 *  - downsell NUNCA desconta na 1ª recusa: 1º trial 7d (offer do Play),
 *    2º roleta → 1º ano 79,90 (intro price), fundo só em win-back push.
 *  - 97,90 × 129,90 será teste A/B via RevenueCat Experiments no lançamento.
 *  Os valores REAIS exibidos virão do RevenueCat/Play (moeda local, offers);
 *  estes são fallback de exibição e contrato de produto.
 */
export const APP_PRECOS = {
  // 02/08: âncora passa de 29,90 → 19,90 por decisão do dono.
  //
  // ATENÇÃO, e isto não é detalhe: esta string é só EXIBIÇÃO. Quem cobra é o
  // Play Billing, pelo preço do plano base do produto `core_mensal` no Play
  // Console. Enquanto lá continuar 29,90, o app mostra 19,90 e a Google cobra
  // 29,90 — divergência que reprova na análise e queima confiança de quem
  // pagou. Trocar aqui SEM trocar lá é pior que não trocar.
  mensal: { id: "core_mensal", preco: "R$ 19,90" },
  anual: { id: "core_anual", preco: "R$ 97,90", trialDias: 3, porMes: "R$ 8,16" },
  // 06/08 (decisão do dono): o app vende UM produto — vitalício, pagamento
  // único, espelho do paywall da web. Produto `core_vitalicio` ATIVO no Play
  // via API (purchaseOption "compra"). Mensal e anual ficam no catálogo só
  // pra base já assinante (restore/renovação).
  // 07/08: 47,90 → 27,90 — MESMO preço da web, pedido do dono pra comparar
  // app × web com uma variável só. Preço da Play trocado por API na mesma
  // hora (PATCH oneTimeProducts, conferido ACTIVE/27,90 na resposta).
  vitalicio: { id: "core_vitalicio", preco: "R$ 27,90" },
  // 09/08 (dono): downsell do app — mesma compra vitalícia por 19,90 pra quem
  // CANCELOU a folha do Google no preço cheio. Produto próprio no Play
  // (`core_vitalicio_19`, ACTIVE via API, schema espelho do core_vitalicio),
  // porque a folha não aceita desconto dinâmico em compra única.
  vitalicio19: { id: "core_vitalicio_19", preco: "R$ 19,90" },
} as const;
