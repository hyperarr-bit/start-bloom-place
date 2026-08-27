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
  // 16/08 (v53, decisão do dono): o app volta a ser ASSINATURA — mensal 24,90
  // e anual 159,90 (= R$ 13,32/mês, economia real de R$ 138 vs 12× mensal).
  // O teste grátis agora é NOSSO (3 dias sem cartão, teste-gratis.ts), então
  // a oferta coretrial do Play sai do anual — a folha cobra na hora.
  //
  // ATENÇÃO, e isto não é detalhe: esta string é só EXIBIÇÃO. Quem cobra é o
  // Play Billing, pelo preço do plano base do produto no Play Console.
  // Divergência entre os dois reprova na análise e queima confiança de quem
  // pagou. Trocar aqui SEM trocar lá é pior que não trocar.
  mensal: { id: "core_mensal", preco: "R$ 24,90" },
  anual: { id: "core_anual", preco: "R$ 159,90", porMes: "R$ 13,32", economiaAno: "R$ 138" },
  // 23/08 (dono aprovou o desenho novo): o mensal da VITRINE vira À VISTA —
  // base plan pré-pago de 30 dias no core_mensal, mesmo preço do recorrente
  // (24,90), pago no Pix (ou cartão) na folha do Google, renovação manual.
  // Motivo (dados de 19-22/08): 5/5 compradores do pré-pago 19,90 viram a
  // folha COM trial e cancelaram de propósito — recusam RECORRÊNCIA, não
  // preço. O recorrente core_mensal continua no catálogo pra save-offer e
  // base antiga; a vitrine não vende mais ele.
  mensalVista: { id: "core_mensal:coremensalvista", preco: "R$ 24,90" },
  // 23/08 noite (pivô aprovado: "tire o trial e foca só no à vista") — o app
  // vende SÓ pagamento à vista, na mecânica do único formato que liquidou
  // dinheiro de verdade (pré-pago, Pix na folha): anual 159,90 na vitrine
  // como R$ 13,32/mês, e o 97,90 é a CAIXA DE PRESENTE da escada de saída
  // (estilo Me+) — nunca exposto na vitrine, senão vira o preço real.
  anualVista: { id: "core_anual:coreanualvista", preco: "R$ 159,90", porMes: "R$ 13,32" },
  /** 26/08: o 97,90 DEIXOU de ser resgate e virou O anual. O de 159,90 levou
 *  95 dos 102 toques em comprar e vendeu ZERO — a folha do Google nunca
 *  fechou nesse preço. A âncora agora é o mensal: 24,90 × 12 = 298,80. */
  anual97: { id: "core_anual:coreanual97", preco: "R$ 97,90", porMes: "R$ 8,16", economia: "R$ 200" },
  // 16/08 (dono): downsell do D3 = "R$ 19,90 o mês, no Pix, renova quando
  // você quiser" — base plan PRÉ-PAGO de 30 dias no MESMO produto core_mensal
  // (Play cobra o Pix na folha e controla a expiração; renovação é manual por
  // natureza do pré-pago). Só aparece pra quem CANCELOU a folha no preço
  // cheio — exposto no paywall canibalizaria o mensal 24,90 do cartão.
  mensalPix: { id: "core_mensal:coremensalpix", preco: "R$ 19,90" },
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
  /** 27/08 (v81, dono aprovou o desenho): o VITALÍCIO volta a ser a oferta —
   *  agora única, a R$ 97,90. Raio-x de 26-27/08: quem VÊ a folha converte a
   *  7-9%, ninguém troca de plano após recusar (0/224), e o 19,90 de resgate
   *  fez 0/168 — então uma oferta só, no maior ticket que a folha já provou
   *  fechar (97,90), com o mensal virando só âncora riscada (24,90×12=298,80).
   *  Produto `core_vitalicio_97` ACTIVE no Play (schema espelho do
   *  core_vitalicio que vendeu, diff = só preço) e registrado no RC
   *  (entitlement CORE APP Pro) — tudo por API, conferido na resposta. */
  vitalicio97: { id: "core_vitalicio_97", preco: "R$ 97,90" },
} as const;
