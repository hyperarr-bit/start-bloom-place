/**
 * OFERTAS DE SAÍDA DO PAYWALL DO iPHONE (10/10, pra 1.0.14) — as CHAVES.
 *
 * Quatro coisas novas, cada uma atrás da própria chave, TODAS DESLIGADAS por
 * padrão (= o paywall de hoje, byte a byte; travado em src/test/ofertas-saida.test.tsx):
 *
 *   OFERTA_X_PAYWALL    fechou o paywall do funil sem iniciar o teste (Voltar) →
 *                       caixa de presente: anual 69,90 COM os 3 dias grátis (lugar "x_paywall")
 *   OFERTA_MENSAL_19    escolheu o mensal e cancelou a folha da Apple → mensal 19,90
 *                       (produto core_mensal_19, offering `mensal_19`, pacote $rc_monthly)
 *   SAIDA_TESTE_ESCADA  quem sai durante o teste recusou o 69,90 ("Agora não") → 2º degrau:
 *                       mensal 19,90 (também no bloqueio de quem perdeu o acesso)
 *   PAYWALL_TEXTOS      "A Apple vai pedir confirmação. Nada é cobrado hoje." acima do botão
 *                       + selo "economize N%" no anual (N calculado dos preços reais)
 *   PAYWALL_ENXUTO      (10/10, dono: "tem muita informação no paywall") o paywall de
 *                       assinatura do app (PaywallAssinatura: gate e /planos) acima da dobra
 *                       só com título, as 2 colunas, prova social curta e o botão; "O que você
 *                       construiu" só com 2+ itens e colapsado numa linha; conta/trocar conta,
 *                       restaurar, termos, privacidade e excluir conta numa linha só no rodapé
 *   RECUPERACAO_PAYWALL (10/10, estilo Enxovaly) quem sai do paywall do funil sem iniciar o
 *                       teste recebe 2 avisos locais (+3 h e 9h da manhã seguinte, faixa 950000),
 *                       só se a permissão já existir; cancelados quando o teste começa
 *   PAYWALL_CURTO       (10/10, dono: "na tora, testa tudo" — SEM A/B) o PaywallIOS do funil cabe
 *                       SEM ROLAR (390×844 e 375×667): título com a meta dela, linha do tempo com
 *                       datas reais, anual pré-selecionado + mensal numa linha, prova social em 1
 *                       linha, "Sem cobrança hoje" + botão (1 pulso só) + legal; a preparação da
 *                       folha da Apple no toque (~1,2 s). O resto vai pro "ver mais" discreto.
 *                       `paywall_oferta_vista` ganha `paywall_curto: true`
 *   SAIDA_DIRETO_19     (16/10, dono: o 69,90 converteu 0 de 53 no teste cancelado/bloqueio) em
 *                       "cancelou_teste" e "bloqueio" PULA o 69,90 e vai direto pro mensal 19,90 —
 *                       só se a offering `mensal_19` existir (sem ela, o 69,90 de sempre). Não
 *                       mexe no "x_paywall" nem no "folha_cancelada". Metadata `saida_direto_19`.
 *                       Fica FORA do "liga tudo" (QA `on`, build de QA, build de loja): só a
 *                       metadata, a lista explícita `?ofertas-saida=direto_19` ou a constante
 *   PLANO_CADEADO       (10/10) a tela "Seu plano de 3 dias" (ONBOARDING_1TELA) ganha Dia 1/2/3 na
 *                       linguagem dela + bloco "Depois do teste" borrado com cadeado e o botão
 *                       "Desbloquear meu plano" → paywall. `funnel_view step=plano_3_dias` ganha
 *                       `cadeado: true`; o toque é `funnel_click cta=desbloquear_plano`
 *
 * QUEM DECIDE, nesta ordem (a primeira que responder vale):
 *   1. força de QA deste aparelho, gravada pelo link `?ofertas-saida=…` (ver guardarForcaDasOfertas)
 *   2. a build de QA `VITE_V14_QA=1` (lib/v14-qa): liga as oito (nunca a SAIDA_DIRETO_19)
 *   3. metadata remota do RevenueCat: QUALQUER offering (current, anual_69, mensal_19…) pode
 *      carregar `oferta_x_paywall`, `oferta_mensal_19`, `saida_teste_escada`, `paywall_textos`,
 *      `paywall_enxuto`, `recuperacao_paywall`, `paywall_curto`, `plano_cadeado`, `saida_direto_19` com "on"/"off" —
 *      a `current` vence as outras.
 *      Ligar/desligar SEM versão nova.
 *   4. a constante local abaixo ("off" hoje).
 * Além disso, uma oferta só EXISTE se a loja tiver o produto: a offering `mensal_19` ausente
 * no RevenueCat faz OFERTA_MENSAL_19 e o 2º degrau da escada não fazerem nada, chave ligada ou não.
 *
 * Só iPhone: as telas que leem isto já estão atrás de ehApple(); na web e no Android nada muda.
 */
import { v14Qa, v14Loja } from "@/lib/v14-qa";

export type ModoOferta = "off" | "on";
export type NomeDaOferta = "x_paywall" | "mensal_19" | "escada" | "textos" | "enxuto" | "recuperacao" | "curto" | "cadeado" | "direto_19";

/** Constantes locais. ROLLBACK/LIGAR sem RevenueCat = trocar aqui + build. */
export const OFERTA_X_PAYWALL: ModoOferta = "off";
export const OFERTA_MENSAL_19: ModoOferta = "off";
export const SAIDA_TESTE_ESCADA: ModoOferta = "off";
export const PAYWALL_TEXTOS: ModoOferta = "off";
export const PAYWALL_ENXUTO: ModoOferta = "off";
export const RECUPERACAO_PAYWALL: ModoOferta = "off";
export const PAYWALL_CURTO: ModoOferta = "off";
export const PLANO_CADEADO: ModoOferta = "off";
export const SAIDA_DIRETO_19: ModoOferta = "off";

const LOCAL: Record<NomeDaOferta, ModoOferta> = {
  x_paywall: OFERTA_X_PAYWALL,
  mensal_19: OFERTA_MENSAL_19,
  escada: SAIDA_TESTE_ESCADA,
  textos: PAYWALL_TEXTOS,
  enxuto: PAYWALL_ENXUTO,
  recuperacao: RECUPERACAO_PAYWALL,
  curto: PAYWALL_CURTO,
  cadeado: PLANO_CADEADO,
  direto_19: SAIDA_DIRETO_19,
};
/** Chaves que NUNCA entram no "liga tudo" (força `on`, build de QA, build de loja): mudam a
 *  escada pra todo mundo, então só ligam por nome (metadata, lista explícita ou constante). */
const SO_POR_NOME: ReadonlySet<NomeDaOferta> = new Set<NomeDaOferta>(["direto_19"]);

/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA: Record<NomeDaOferta, string> = {
  x_paywall: "oferta_x_paywall",
  mensal_19: "oferta_mensal_19",
  escada: "saida_teste_escada",
  textos: "paywall_textos",
  enxuto: "paywall_enxuto",
  recuperacao: "recuperacao_paywall",
  curto: "paywall_curto",
  cadeado: "plano_cadeado",
  direto_19: "saida_direto_19",
};

export const CHAVE_FORCA_OFERTAS = "ofertas-saida-force"; // nas 2 allowlists (use-auth / use-user-data)
export const PARAM_QA_OFERTAS = "ofertas-saida";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/* ───────────── 2. metadata remota (preenchida pelo revenuecat.ts a cada getOfferings) ───────────── */
let remota: Partial<Record<NomeDaOferta, ModoOferta>> = {};

const modoDe = (v: unknown): ModoOferta | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

/** Decisão pura: lê as chaves do metadata de todas as offerings (a `current` vence). */
export function lerChavesRemotas(offerings: unknown): Partial<Record<NomeDaOferta, ModoOferta>> {
  type Off = { identifier?: string; metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  const lidas: Partial<Record<NomeDaOferta, ModoOferta>> = {};
  const aplicar = (off: Off) => {
    for (const nome of Object.keys(CHAVE_REMOTA) as NomeDaOferta[]) {
      const m = modoDe(off?.metadata?.[CHAVE_REMOTA[nome]]);
      if (m) lidas[nome] = m;
    }
  };
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) aplicar(off);
  aplicar(o?.current);
  return lidas;
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings(). */
export function registrarChavesRemotas(offerings: unknown): void {
  try { remota = lerChavesRemotas(offerings); } catch { /* metadata estranha: fica como estava */ }
}
export const chavesRemotas = (): Readonly<Partial<Record<NomeDaOferta, ModoOferta>>> => remota;
/** Só testes. */
export const _zerarChavesRemotas = (): void => { remota = {}; };

/* ───────────── 1. força de QA pelo link ───────────── */
/**
 * `?ofertas-saida=on` liga as 8 neste aparelho (a `direto_19` só por nome, na lista); `off` força as 8 desligadas; `auto`
 * apaga a força; lista separada por vírgula (`x_paywall,mensal_19,escada,textos,enxuto,recuperacao,curto,cadeado`)
 * liga só essas. Gravado no aparelho porque o funil muda de passo sem levar a query.
 * Também apaga as marcas de "já vi" (`recomecar` junto, ex.: `?ofertas-saida=on,recomecar`).
 */
export function guardarForcaDasOfertas(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_QA_OFERTAS);
  } catch { return; }
  if (v === null) return;
  const partes = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (partes.includes("recomecar")) apagarMarcasDeVisto();
  const semRecomecar = partes.filter((p) => p !== "recomecar");
  if (semRecomecar.includes("auto")) { ls.del(CHAVE_FORCA_OFERTAS); return; }
  if (semRecomecar.includes("off")) { ls.set(CHAVE_FORCA_OFERTAS, "off"); return; }
  if (semRecomecar.includes("on")) { ls.set(CHAVE_FORCA_OFERTAS, "on"); return; }
  const nomes = semRecomecar.filter((p): p is NomeDaOferta => p in LOCAL);
  if (nomes.length) ls.set(CHAVE_FORCA_OFERTAS, nomes.join(","));
}

export const forcaDasOfertas = (nome: NomeDaOferta): ModoOferta | null => {
  const f = ls.get(CHAVE_FORCA_OFERTAS);
  if (!f) return null;
  if (f === "on" || f === "off") return f;
  return f.split(",").includes(nome) ? "on" : "off";
};

/** As marcas de "1x por aparelho" de todas as ofertas (presente e mensal 19) — pra QA recomeçar. */
export const CHAVES_DE_VISTO = [
  "core-presente69-cancelou-visto", "core-presente69-bloqueio-visto", "core-presente69-x-paywall-visto",
  "core-mensal19-mensal-paywall-visto", "core-mensal19-cancelou-visto", "core-mensal19-bloqueio-visto", "core-mensal19-recusa-visto",
  "core-save-offer-visto",
];
export const apagarMarcasDeVisto = (): void => { for (const k of CHAVES_DE_VISTO) ls.del(k); };

/* ───────────── a resposta ───────────── */
/** A oferta está ligada AQUI, agora? força de QA > build de QA > metadata do RevenueCat > constante local. */
export function ofertaLigada(nome: NomeDaOferta): boolean {
  const soPorNome = SO_POR_NOME.has(nome);
  const f = forcaDasOfertas(nome);
  // `?ofertas-saida=on` não liga as "só por nome" (mas `off` desliga): cai na metadata/constante
  if (f && !(soPorNome && f === "on" && ls.get(CHAVE_FORCA_OFERTAS) === "on")) return f === "on";
  if (soPorNome) {
    const r = remota[nome];
    return r ? r === "on" : LOCAL[nome] === "on";
  }
  if (v14Qa()) return true;
  const r = remota[nome];
  if (r) return r === "on"; // a metadata do RC manda (é o interruptor de emergência no ar, sem versão nova)
  // loja (VITE_V14_LOJA): tudo ligado MENOS o mensal 19,90 — o produto core_mensal_19 não existe na Apple ainda
  if (v14Loja() && nome !== "mensal_19") return true;
  return LOCAL[nome] === "on";
}
