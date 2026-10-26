/**
 * OFERTA "ANUAL" DO /inicio (26/10) — variante pra uma campanha nova da Meta, com link próprio.
 *
 *   Link da campanha:  /inicio?oferta=anual&utm_source=…  (o /inicio sem o parâmetro fica byte a byte como sempre)
 *
 * O que muda SÓ nessa variante:
 *   · o produto do paywall é o PLANO ANUAL R$ 27,90 no Pix (`OFB_anual27`, 365 dias, NÃO é assinatura, NÃO renova
 *     sozinho) — toda menção a vitalício/pra sempre/pague uma vez do funil vira "1 ano de acesso";
 *   · depois do Pix confirmado: UPSELL "Troque para o VITALÍCIO por +R$ 47,90" (`OFB_up47`); X ou "Não, obrigado" →
 *     UMA vez o DOWNSELL "Vitalício por +R$ 27,90" (`OFB_down27`); recusou de novo → acesso (lojas). O pós-compra de
 *     sempre (presente/2027) NÃO aparece nesta variante;
 *   · comprou upsell ou downsell → linha vitalícia nova (o anual fica na linha dele); ficou no anual → acesso até
 *     compra + 365 dias (`subscriptions.billing_period = annual`, `current_period_end`) — o check-subscription já
 *     respeita o fim (7 dias de carência do Pix e depois o subscription-grace-cleanup cancela).
 *
 * A escolha fica no APARELHO (localStorage `core_oferta` + cookie `core_oferta`, 30 dias + heap — o navegador do
 * Instagram zera o storage entre páginas): a pessoa vê sempre a mesma oferta no mesmo aparelho, mesmo voltando sem o
 * parâmetro (a demo é navegação completa e volta pra /inicio?step=signup sem ele).
 *
 * EMERGÊNCIA: OFERTA_ANUAL_LIGADA = false + push → todo mundo (até quem já tem a marca) volta pro /inicio normal
 * (vitalício 27,90). Quem estiver com o Pix anual aberto ainda paga e é creditado (as functions conhecem a oferta).
 * QA neste navegador: `?oferta=anual` liga, `?oferta=controle` (ou `off`) apaga a marca.
 *
 * MEDIÇÃO: `oferta_etapa {etapa, variante, landing}` — UM por aparelho por etapa (deduplicado aqui e de novo no
 * script ferramentas-sessao/metricas/oferta-anual.mjs pelo device_id). Só no funil do /inicio. A variante "controle"
 * também é medida (as mesmas etapas do vitalício) pra o script comparar receita por visitante. Só soma um evento novo:
 * nenhuma tela do controle muda.
 */
import { useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";

/** A CHAVE DE EMERGÊNCIA. false = ninguém vê a variante (volta o /inicio de sempre). */
export const OFERTA_ANUAL_LIGADA: boolean = true;

export const PARAM_OFERTA = "oferta";
export const VALOR_ANUAL = "anual";
/** localStorage + cookie (o mesmo nome nos dois). */
export const CHAVE_OFERTA = "core_oferta";
export const VALIDADE_OFERTA_MS = 30 * 86_400_000;

export type VarianteOferta = "anual" | "controle";

/* ───────────────────────── as ofertas (o servidor tem os mesmos valores: _shared/ofertas-anual-inicio.ts) ───────── */

export const OFERTA_ANUAL = "OFB_anual27" as const;
export const OFERTA_UP_VITALICIO = "OFB_up47" as const;
export const OFERTA_DOWN_VITALICIO = "OFB_down27" as const;
export type OfertaDaVariante = typeof OFERTA_ANUAL | typeof OFERTA_UP_VITALICIO | typeof OFERTA_DOWN_VITALICIO;

export const VALOR_ANUAL_REAIS = 27.9;
export const VALOR_UP_REAIS = 47.9;
export const VALOR_DOWN_REAIS = 27.9;
export const DIAS_ANUAL = 365;
/** "R$ 2,33/mês" — o preço do ano dividido por 12, arredondado PRA CIMA no centavo (27,90 ÷ 12 = 2,325): nunca promete
 *  um mês mais barato do que é. */
export const POR_MES_ANUAL = (Math.ceil(Math.round((VALOR_ANUAL_REAIS / 12) * 1e6) / 1e4) / 100).toFixed(2).replace(".", ",");

export const ehOfertaDaVariante = (o: string | null | undefined): o is OfertaDaVariante =>
  o === OFERTA_ANUAL || o === OFERTA_UP_VITALICIO || o === OFERTA_DOWN_VITALICIO;

/* ───────────────────────── a marca no aparelho ───────────────────────── */

type Marca = { v: VarianteOferta; desde: number; landing: string };
let heap: Marca | null = null;

const agora = () => Date.now();

const lerCookie = (): string | null => {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CHAVE_OFERTA}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
};
const gravarCookie = (valor: string | null) => {
  try {
    document.cookie = valor
      ? `${CHAVE_OFERTA}=${encodeURIComponent(valor)}; max-age=${Math.round(VALIDADE_OFERTA_MS / 1000)}; path=/; SameSite=Lax`
      : `${CHAVE_OFERTA}=; max-age=0; path=/; SameSite=Lax`;
  } catch { /* sem cookie: fica o storage/heap */ }
};

const parse = (raw: string | null): Marca | null => {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<Marca>;
    if (m && m.v === "anual" && typeof m.desde === "number") return { v: "anual", desde: m.desde, landing: String(m.landing || "/inicio").slice(0, 80) };
  } catch {
    // cookie antigo/curto: "anual" puro
    if (raw === VALOR_ANUAL) return { v: "anual", desde: agora(), landing: "/inicio" };
  }
  return null;
};

const lerMarca = (): Marca | null => {
  let m = heap;
  if (!m) {
    try { m = parse(localStorage.getItem(CHAVE_OFERTA)); } catch { m = null; }
  }
  if (!m) m = parse(lerCookie());
  if (m && agora() - m.desde > VALIDADE_OFERTA_MS) { apagarMarca(); return null; }
  if (m) {
    heap = m;
    // re-semeia o que o navegador zerou (o Instagram apaga o storage com a página viva)
    const raw = JSON.stringify(m);
    try { if (!localStorage.getItem(CHAVE_OFERTA)) localStorage.setItem(CHAVE_OFERTA, raw); } catch { /* noop */ }
    if (!lerCookie()) gravarCookie(raw);
  }
  return m;
};

const gravarMarca = (m: Marca) => {
  heap = m;
  const raw = JSON.stringify(m);
  try { localStorage.setItem(CHAVE_OFERTA, raw); } catch { /* storage bloqueado: cookie + heap */ }
  gravarCookie(raw);
};

function apagarMarca() {
  heap = null;
  try { localStorage.removeItem(CHAVE_OFERTA); } catch { /* noop */ }
  gravarCookie(null);
}

/** Só testes: esquece a marca, as etapas já medidas e o pós-compra segurado. */
export function _zerarOfertaAnual(): void {
  apagarMarca();
  etapasHeap.clear();
  try { localStorage.removeItem(CHAVE_ETAPAS); } catch { /* noop */ }
  setSegurando(false);
}

/**
 * Lê o link (`?oferta=anual` liga e GUARDA a marca por 30 dias; `?oferta=controle|off` apaga) — chame na chegada do
 * /inicio. Devolve a variante valendo aqui.
 */
export function capturarOferta(busca: string = typeof window === "undefined" ? "" : window.location.search, pathname: string = typeof window === "undefined" ? "/inicio" : window.location.pathname): VarianteOferta {
  let p: string | null = null;
  try { p = new URLSearchParams(busca).get(PARAM_OFERTA); } catch { p = null; }
  if (p === VALOR_ANUAL) {
    const atual = lerMarca();
    // o link de novo NÃO reinicia os 30 dias nem troca a landing da 1ª chegada
    if (!atual) gravarMarca({ v: "anual", desde: agora(), landing: (pathname || "/inicio").slice(0, 80) });
  } else if (p === "controle" || p === "off") {
    apagarMarca();
  }
  return varianteOferta();
}

/** A variante AQUI (sem ler o link). Chave de emergência desligada = sempre "controle". */
let chaveForcada: boolean | null = null;
/** Só testes: simula a chave de emergência (null volta pra OFERTA_ANUAL_LIGADA). */
export const _forcarChaveOfertaAnual = (v: boolean | null): void => { chaveForcada = v; };

export function varianteOferta(): VarianteOferta {
  if (!(chaveForcada ?? OFERTA_ANUAL_LIGADA)) return "controle";
  return lerMarca()?.v === "anual" ? "anual" : "controle";
}

export const ehOfertaAnual = (): boolean => varianteOferta() === "anual";

/** A landing da 1ª chegada com a marca (pros eventos) — "/inicio" no controle. */
export const landingDaOferta = (): string => (varianteOferta() === "anual" ? lerMarca()?.landing ?? "/inicio" : "/inicio");

/** O /inicio é o único funil da variante (o paywall do app e o /planos nunca mudam). */
export const noFunilDoInicio = (): boolean => {
  try { return window.location.pathname.startsWith("/inicio"); } catch { return false; }
};

/** A variante nesta tela: anual SÓ no funil do /inicio. */
export const ofertaAnualAqui = (): boolean => noFunilDoInicio() && ehOfertaAnual();

/* ───────────────────────── medição: 1 evento por aparelho por etapa ───────────────────────── */

export type EtapaOferta =
  | "landing" | "checkout" | "pix" | "pago"
  | "up_visto" | "up_pago" | "down_visto" | "down_pago";

export const ETAPAS_OFERTA: readonly EtapaOferta[] = ["landing", "checkout", "pix", "pago", "up_visto", "up_pago", "down_visto", "down_pago"];

const CHAVE_ETAPAS = "core_oferta_etapas";
const etapasHeap = new Set<string>();
const lerEtapas = (): Set<string> => {
  try {
    const raw = localStorage.getItem(CHAVE_ETAPAS);
    if (raw) for (const k of JSON.parse(raw) as string[]) etapasHeap.add(k);
  } catch { /* fica o heap */ }
  return etapasHeap;
};

/**
 * Marca a etapa (UMA vez por aparelho por variante). Só no funil do /inicio. `extra` vai junto (valor, order_id…).
 * Devolve true se mandou.
 */
export function marcarEtapaOferta(etapa: EtapaOferta, extra: Record<string, unknown> = {}): boolean {
  if (!noFunilDoInicio()) return false;
  const variante = varianteOferta();
  const k = `${variante}:${etapa}`;
  const feitas = lerEtapas();
  if (feitas.has(k)) return false;
  feitas.add(k);
  try { localStorage.setItem(CHAVE_ETAPAS, JSON.stringify([...feitas].slice(-40))); } catch { /* heap */ }
  trackEvent("oferta_etapa", { etapa, variante, landing: landingDaOferta(), ...extra });
  return true;
}

/* ───────────────────────── o pós-compra segurado ───────────────────────── */
/* O /inicio manda o assinante pro app assim que o useAuth vê a assinatura (60 s ou na volta do foco — exatamente quando
 * a pessoa volta do banco). Na variante, o upsell/downsell vive POR CIMA do "Pagamento confirmado": enquanto ele está
 * aberto, o funil não redireciona. (No controle isso não muda — ver LEIA.md: o pós-compra de sempre tem o mesmo risco.) */
let segurando = false;
const ouvintes = new Set<() => void>();
function setSegurando(v: boolean) {
  if (segurando === v) return;
  segurando = v;
  ouvintes.forEach((f) => f());
}
export const segurarPosCompra = (v: boolean): void => setSegurando(v);
export const posCompraSegurado = (): boolean => segurando;
export function usePosCompraSegurado(): boolean {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => segurando,
    () => false,
  );
}

/* ───────────────────────── o fluxo do upsell (estado puro) ───────────────────────── */

export type EtapaUpgrade = "up" | "up_pix" | "down" | "down_pix" | "fim";
export type ResultadoUpgrade = "vitalicio" | "anual";
export type EstadoUpgrade = {
  v: 1;
  /** o pedido do anual que abriu o fluxo (1 fluxo por compra) */
  compra: string;
  etapa: EtapaUpgrade;
  /** o downsell já apareceu (aparece UMA vez, nunca de novo) */
  downVisto: boolean;
  /** o pedido pago do upgrade (up ou down) */
  pedido: string | null;
  oferta: typeof OFERTA_UP_VITALICIO | typeof OFERTA_DOWN_VITALICIO | null;
  /** o Pix aberto agora (sobrevive à ida pro app do banco) */
  pix: unknown | null;
};
export const novoEstadoUpgrade = (compra: string): EstadoUpgrade => ({ v: 1, compra, etapa: "up", downVisto: false, pedido: null, oferta: null, pix: null });

/** Recusar (X ou "Não, obrigado"): o upsell abre o downsell UMA vez; o downsell (ou o upsell com o down já visto) termina. */
export function aoRecusar(e: EstadoUpgrade): EstadoUpgrade {
  if ((e.etapa === "up" || e.etapa === "up_pix") && !e.downVisto) return { ...e, etapa: "down", downVisto: true, pix: null };
  return { ...e, etapa: "fim", pix: null };
}
export function aoAceitar(e: EstadoUpgrade): EstadoUpgrade {
  if (e.etapa === "up") return { ...e, etapa: "up_pix" };
  if (e.etapa === "down") return { ...e, etapa: "down_pix" };
  return e;
}
/** Voltar do Pix pra oferta (sem recusar). */
export function aoVoltarDoPix(e: EstadoUpgrade): EstadoUpgrade {
  if (e.etapa === "up_pix") return { ...e, etapa: "up", pix: null };
  if (e.etapa === "down_pix") return { ...e, etapa: "down", pix: null };
  return e;
}
export function aoPagar(e: EstadoUpgrade, pedido: string): EstadoUpgrade {
  const oferta = e.etapa === "down_pix" ? OFERTA_DOWN_VITALICIO : OFERTA_UP_VITALICIO;
  return { ...e, etapa: "fim", pedido, oferta, pix: null };
}
export const resultadoDoUpgrade = (e: EstadoUpgrade): ResultadoUpgrade => (e.pedido ? "vitalicio" : "anual");

/** Fora do prefixo core-* de propósito (a vassoura do cache não mexe; é o fluxo desta compra neste aparelho). */
export const CHAVE_ESTADO_UPGRADE = "oferta-anual-upgrade-v1";
let memoriaUpgrade: EstadoUpgrade | null = null;
export const _zerarEstadoUpgrade = (): void => { memoriaUpgrade = null; try { localStorage.removeItem(CHAVE_ESTADO_UPGRADE); } catch { /* noop */ } };
export function lerEstadoUpgrade(compra: string): EstadoUpgrade {
  let e: EstadoUpgrade | null = memoriaUpgrade;
  if (!e) {
    try { const raw = localStorage.getItem(CHAVE_ESTADO_UPGRADE); if (raw) e = JSON.parse(raw) as EstadoUpgrade; } catch { e = null; }
  }
  return e && e.v === 1 && e.compra === compra ? e : novoEstadoUpgrade(compra);
}
export function gravarEstadoUpgrade(e: EstadoUpgrade): void {
  memoriaUpgrade = e;
  try { localStorage.setItem(CHAVE_ESTADO_UPGRADE, JSON.stringify(e)); } catch { /* fica o heap */ }
}

/** dd/mm/aaaa do fim do anual (compra + 365 dias) — o que a tela de acesso mostra. */
export function fimDoAnual(desde: number = Date.now()): string {
  const d = new Date(desde + DIAS_ANUAL * 86_400_000 - 3 * 3600e3);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
