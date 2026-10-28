/**
 * AS OFERTAS DA LANDING NOVA (/organizar, 28/10 — DESLIGADA, chave LANDING_NOVA no landing.html) — o lado do servidor.
 * O lado do site: src/landing/regras.ts (os MESMOS valores; o teste src/test/landing-nova.test.ts confere).
 *
 *   LN_ano279       "CORE 1 ano"            R$ 27,90 · 365 dias (annual) · NÃO renova sozinho      — braço "ano"
 *   LN_anosempre478 "CORE pra sempre"       R$ 47,80 · VITALÍCIO (+100 anos)                      — braço "ano" + caixinha
 *   LN_sempre279    "CORE pra sempre"       R$ 27,90 · VITALÍCIO (+100 anos)                      — braço "sempre"
 *
 * São PLANOS (a compra principal, 1 Pix só, sem upsell depois): entram nos mapas do ./ofertas-hoje.ts e na lista
 * OFERTAS_PLANO_HOJE — ganham de graça o caminho do /hoje (Pix sem e-mail na sessão anônima, `check`, webhook,
 * reconcile, e-mail opcional `email_pedido` → destino-hoje, `boas_vindas` 1x por pedido com as lojas).
 * A caixinha vai NO MESMO Pix (o valor do QR já sai com ela) — nunca um 2º Pix.
 *
 * NADA DISTO ESTÁ NO AR: as funções que leem estes mapas (asaas-pix, asaas-webhook, pix-reconcile, pix-vincular)
 * precisam de deploy, NESTA ORDEM: pix-reconcile + asaas-webhook (--no-verify-jwt) → asaas-pix (verify_jwt) →
 * pix-vincular. Uma versão velha que não conhece a oferta NÃO credita (oferta desconhecida nunca vira vitalício, 16/10).
 * Descrições SEM acento (vão no payload do Pix; app de banco antigo estraga acento).
 */
export const OFERTA_LANDING_ANO = "LN_ano279";
export const OFERTA_LANDING_ANO_SEMPRE = "LN_anosempre478";
export const OFERTA_LANDING_SEMPRE = "LN_sempre279";

export const PRECOS_LANDING: Record<string, number> = {
  [OFERTA_LANDING_ANO]: 2790,
  [OFERTA_LANDING_ANO_SEMPRE]: 4780,
  [OFERTA_LANDING_SEMPRE]: 2790,
};

export const CONCESSAO_LANDING: Record<string, { plano: string; periodo: string; dias: number | null; linhaNova?: boolean }> = {
  [OFERTA_LANDING_ANO]: { plano: "core-pro", periodo: "annual", dias: 365 },
  [OFERTA_LANDING_ANO_SEMPRE]: { plano: "lifetime", periodo: "lifetime", dias: null },
  [OFERTA_LANDING_SEMPRE]: { plano: "lifetime", periodo: "lifetime", dias: null },
};

export const DESCRICAO_LANDING: Record<string, string> = {
  [OFERTA_LANDING_ANO]: "CORE 1 ano",
  [OFERTA_LANDING_ANO_SEMPRE]: "CORE pra sempre",
  [OFERTA_LANDING_SEMPRE]: "CORE pra sempre",
};

export const OFERTAS_PLANO_LANDING: readonly string[] = [OFERTA_LANDING_ANO, OFERTA_LANDING_ANO_SEMPRE, OFERTA_LANDING_SEMPRE];
export const ehOfertaLanding = (o: string | null | undefined): boolean => !!o && OFERTAS_PLANO_LANDING.includes(o);
/** As da landing que são PRA SEMPRE (o e-mail de boas-vindas diz "pra sempre"). */
export const ehPraSempreLanding = (o: string | null | undefined): boolean => o === OFERTA_LANDING_ANO_SEMPRE || o === OFERTA_LANDING_SEMPRE;
