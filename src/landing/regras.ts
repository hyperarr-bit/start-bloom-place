/**
 * LANDING NOVA (/organizar, 28/10) — as regras puras: ofertas, braços, módulos da demo, textos que mudam por braço.
 * Sem DOM e sem rede (o teste src/test/landing-nova.test.ts lê daqui). O HTML da página mora em /landing.html; o
 * comportamento em ./landing.ts; o Pix de verdade em ./pagamento.ts (só baixa quando a pessoa toca em pagar).
 *
 * A CHAVE e os SORTEIOS (título e oferta) rodam no <head> do landing.html, ANTES da 1ª pintura (sem piscar): lá estão
 * LANDING_NOVA / AB_TITULO / AB_OFERTA. Aqui fica só o que o resto do código precisa saber do resultado
 * (html[data-t], html[data-oferta]).
 */

/* ───────────────────────── ofertas (as MESMAS de supabase/functions/_shared/ofertas-landing.ts) ───────────────────────── */

export type BracoOferta = "ano" | "sempre";
export type BracoTitulo = "a" | "b" | "c";
export type OfertaLanding = "LN_ano279" | "LN_anosempre478" | "LN_sempre279";

export const VALOR_OFERTA: Record<OfertaLanding, number> = {
  LN_ano279: 27.9,
  LN_anosempre478: 47.8,
  LN_sempre279: 27.9,
};
/** o que vai embaixo do valor na tela do Pix */
export const ROTULO_OFERTA: Record<OfertaLanding, string> = {
  LN_ano279: "1 ano de CORE · pagamento único",
  LN_anosempre478: "CORE pra sempre · pagamento único",
  LN_sempre279: "CORE pra sempre · pagamento único",
};
export const PRECO_CAIXINHA = 19.9;

/** Qual oferta o botão de pagar gera: braço "ano" (com ou sem a caixinha) ou braço "sempre" (sem caixinha). */
export function ofertaEscolhida(braco: BracoOferta, caixinha: boolean): OfertaLanding {
  if (braco === "sempre") return "LN_sempre279";
  return caixinha ? "LN_anosempre478" : "LN_ano279";
}

export const ehPraSempre = (o: OfertaLanding): boolean => o !== "LN_ano279";

/** R$ 27,90 / R$ 47,80 */
export const reais = (v: number): string => `R$ ${v.toFixed(2).replace(".", ",")}`;

/* ───────────────────────── braços (lidos do <html>, decididos no <head>) ───────────────────────── */

export function bracoOfertaDoHtml(el: { getAttribute(n: string): string | null } = document.documentElement): BracoOferta {
  return el.getAttribute("data-oferta") === "sempre" ? "sempre" : "ano";
}
export function bracoTituloDoHtml(el: { getAttribute(n: string): string | null } = document.documentElement): BracoTitulo {
  const t = el.getAttribute("data-t");
  return t === "b" || t === "c" ? t : "a";
}

/* ───────────────────────── áreas e módulos da demo ───────────────────────── */

export type Area = "tudo" | "dinheiro" | "rotina" | "corpo";
/** O módulo em que a demo abre pra cada resposta do topo. "Tudo" abre em Finanças (o motor do dia a dia: 84% dos
 *  pagantes) — as pílulas e a grade mostram o resto. */
export const MODULO_DA_AREA: Record<Area, ModuloLanding> = {
  tudo: "financas",
  dinheiro: "financas",
  rotina: "rotina",
  corpo: "treino",
};
export const ehArea = (a: unknown): a is Area => a === "tudo" || a === "dinheiro" || a === "rotina" || a === "corpo";

/** Os 16 (chaves do /preview — getSeedsForModule) na ordem da grade: uso real primeiro, Relações/Pet/Detox no fim. */
export const MODULOS_LANDING = [
  "financas", "rotina", "treino", "dieta",
  "saude", "desenvolvimento", "casa", "estudos",
  "carreira", "biblioteca", "beleza", "viagens",
  "hiperfoco", "relacionamentos", "pet", "detox",
] as const;
export type ModuloLanding = (typeof MODULOS_LANDING)[number];
export const ehModuloLanding = (m: unknown): m is ModuloLanding => typeof m === "string" && (MODULOS_LANDING as readonly string[]).includes(m);

export const NOME_DO_MODULO: Record<ModuloLanding, string> = {
  financas: "Finanças", rotina: "Rotina", treino: "Treino", dieta: "Dieta",
  saude: "Saúde", desenvolvimento: "Metas", casa: "Casa", estudos: "Estudos",
  carreira: "Carreira", biblioteca: "Leitura", beleza: "Beleza", viagens: "Viagens",
  hiperfoco: "Mente", relacionamentos: "Relações", pet: "Pet", detox: "Detox",
};

/** O caminho de cada módulo no app (o que os módulos usam no navigate) → a chave da demo. */
const CAMINHO_PRA_MODULO: Record<string, ModuloLanding> = {
  financas: "financas", rotina: "rotina", treino: "treino", dieta: "dieta", saude: "saude",
  desenvolvimento: "desenvolvimento", metas: "desenvolvimento", casa: "casa", estudos: "estudos", carreira: "carreira",
  biblioteca: "biblioteca", beleza: "beleza", viagens: "viagens", hiperfoco: "hiperfoco", mente: "hiperfoco",
  relacionamentos: "relacionamentos", pet: "pet", detox: "detox",
};

/** `?m=` / caminho → módulo (desconhecido = Finanças). */
export function moduloDaLanding(m: string | null | undefined): ModuloLanding {
  const k = String(m ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/^\/+/, "");
  return CAMINHO_PRA_MODULO[k] ?? "financas";
}

/**
 * Pra onde um destino de DENTRO do módulo vai na demo da landing (null = segue normal):
 *   · rota de um dos 16 módulos (/rotina?aba=…) → troca de módulo na própria demo;
 *   · qualquer outra rota interna (login, /home, conquistas…) → "oferta" (a página rola até o preço);
 *   · link de outro site, a própria demo → segue.
 */
export type DesvioLanding = { tipo: "modulo"; modulo: ModuloLanding; aba: string | null } | { tipo: "conta"; destino: string } | null;
export function desvioNaLanding(destino: string): DesvioLanding {
  let u: URL;
  try { u = new URL(destino, "https://demo.local"); } catch { return null; }
  if (u.origin !== "https://demo.local") return null;
  const caminho = u.pathname.replace(/\/+$/, "") || "/";
  if (caminho === "/organizar/demo") return null;
  const m = CAMINHO_PRA_MODULO[caminho.slice(1)];
  if (m) return { tipo: "modulo", modulo: m, aba: u.searchParams.get("aba") };
  return { tipo: "conta", destino: `${caminho}${u.search}`.slice(0, 120) };
}

/* ───────────────────────── mensagens entre a página e a demo (iframe, mesma origem) ───────────────────────── */

export type MensagemDaDemo =
  | { tipo: "landing:pronta"; modulo: ModuloLanding; ms: number }
  | { tipo: "landing:modulo-trocado"; modulo: ModuloLanding; via: "dentro" }
  | { tipo: "landing:oferta"; destino: string }
  | { tipo: "landing:mexeu"; modulo: ModuloLanding };
export type MensagemPraDemo = { tipo: "landing:modulo"; m: ModuloLanding };

/* ───────────────────────── o Pix na página (estado guardado: o banco fecha a aba) ───────────────────────── */

export type PixLanding = {
  orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number; oferta: OfertaLanding;
  /** 29/10: reaberto pelo link do e-mail de lembrete (outra aba/navegador — a página não confirma sozinha) */
  doEmail?: boolean;
};
export const VALIDADE_PIX_MS = 30 * 60_000;
export const venceEm = (p: Pick<PixLanding, "expiresAt" | "criadoEm">): number => {
  const t = p.expiresAt ? Date.parse(p.expiresAt) : NaN;
  return Number.isFinite(t) ? t : p.criadoEm + VALIDADE_PIX_MS;
};
export const mmss = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export type FasePix = "oferta" | "gerando" | "qr" | "pago" | "conta" | "erro";
export type EstadoLanding = {
  v: 1;
  fase: FasePix;
  pix: PixLanding | null;
  /** QRs anteriores desta visita ainda vivos (trocou a caixinha depois de gerar): a conferência reveza com eles */
  anteriores: PixLanding[];
  pago: PixLanding | null;
  email: string | null;
  /** o e-mail opcional da tela do Pix (rede contra pagou-e-fechou-a-aba) */
  emailPix: string | null;
  salvoEm: number;
};
export const ESTADO_VAZIO: EstadoLanding = { v: 1, fase: "oferta", pix: null, anteriores: [], pago: null, email: null, emailPix: null, salvoEm: 0 };
/** Estado mais velho que isso não volta (a compra paga fica na conta; o Pix venceu muito antes). */
export const TTL_ESTADO_MS = 2 * 24 * 3600e3;

/** O estado guardado volta? (vencido/corrompido = começa do zero; Pix aberto e vencido = volta pra oferta) */
export function estadoQueVolta(bruto: unknown, agora: number = Date.now()): EstadoLanding {
  const e = bruto as Partial<EstadoLanding> | null;
  if (!e || e.v !== 1 || typeof e.salvoEm !== "number" || agora - e.salvoEm > TTL_ESTADO_MS) return { ...ESTADO_VAZIO };
  const base: EstadoLanding = { ...ESTADO_VAZIO, ...e, anteriores: Array.isArray(e.anteriores) ? e.anteriores : [] } as EstadoLanding;
  if (base.pago) return { ...base, fase: base.email ? "conta" : "pago" };
  if (base.pix && venceEm(base.pix) > agora) return { ...base, fase: "qr" };
  return { ...ESTADO_VAZIO };
}

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ───────────────────────── lojas ───────────────────────── */
export const URL_APP_STORE = "https://apps.apple.com/br/app/id6806913181";
export const urlPlay = (origem: string): string =>
  `https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=${encodeURIComponent(`utm_source=web&utm_medium=${origem}&utm_campaign=web_${origem}`)}`;

/* ───────────────────────── checkout: e-mail ANTES do Pix (29/10, A/B "AB_CHECKOUT" no <head>) ───────────────────────── */

/** "livre" = o checkout de hoje (Pix na hora, e-mail opcional na tela do QR); "email" = 1 campo de e-mail acima do botão. */
export type BracoCheckout = "livre" | "email";
export function bracoCheckoutDoHtml(el: { getAttribute(n: string): string | null } = document.documentElement): BracoCheckout {
  return el.getAttribute("data-checkout") === "email" ? "email" : "livre";
}

/**
 * O sorteio do braço pelo id do aparelho (landing_device_id) — a MESMA conta do <head> do landing.html (o teste roda os
 * dois e compara). Determinístico: o mesmo aparelho cai sempre no mesmo braço, mesmo com o localStorage zerado (o id
 * sobrevive no cookie).
 */
export function bracoCheckoutDoAparelho(id: string): BracoCheckout {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "livre" : "email";
}

/** Os erros de domínio que mais aparecem (sugestão tocável embaixo do campo; nunca bloqueia). */
const DOMINIO_ERRADO: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmaill.com": "gmail.com",
  "gmail.com.br": "gmail.com", "gimail.com": "gmail.com", "gmeil.com": "gmail.com",
  "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmil.com": "hotmail.com", "hormail.com": "hotmail.com", "hotamil.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.con": "outlook.com", "outllok.com": "outlook.com",
  "iclod.com": "icloud.com", "icloud.con": "icloud.com", "icoud.com": "icloud.com", "icluod.com": "icloud.com",
  "yaho.com.br": "yahoo.com.br", "yahoo.com.b": "yahoo.com.br", "yahooo.com.br": "yahoo.com.br",
};

/** "fulana@gmial.com" → "fulana@gmail.com" (null = nada a sugerir). */
export function sugestaoDeEmail(bruto: string): string | null {
  const e = bruto.trim().toLowerCase();
  const i = e.lastIndexOf("@");
  if (i < 1) return null;
  const certo = DOMINIO_ERRADO[e.slice(i + 1)];
  return certo ? `${e.slice(0, i)}@${certo}` : null;
}

export type ChecagemEmail = { ok: true; email: string } | { ok: false; motivo: "vazio" | "invalido"; msg: string };
/** A validação leve do campo antes do Pix (o servidor confere de novo). */
export function checarEmailAntes(bruto: string): ChecagemEmail {
  const e = bruto.trim().toLowerCase();
  if (!e) return { ok: false, motivo: "vazio", msg: "Coloque seu e-mail: é por onde você entra no CORE." };
  if (!EMAIL_OK.test(e) || e.length > 254) return { ok: false, motivo: "invalido", msg: "Esse e-mail parece errado. Confere?" };
  return { ok: true, email: e };
}

/* ───────────────────────── a volta pelo e-mail de lembrete do Pix (?r=t12|t20h) ───────────────────────── */

export type ToqueLembrete = "t12" | "t20h";
export type VoltaDoLembrete = { toque: ToqueLembrete; pedido: string | null; pix: PixLanding | null };
const OFERTAS: readonly OfertaLanding[] = ["LN_ano279", "LN_anosempre478", "LN_sempre279"];

/**
 * O link do e-mail: /organizar?r=t12&pedido=<id>&pix=<copia-e-cola>&vence=<ms>&o=<oferta> (o t12 leva o QR ainda vivo;
 * o t20h, só r e pedido). Devolve o Pix pra REABRIR na página quando ainda vale ≥ 1 min; senão a pessoa gera outro.
 * `doEmail`: aberto fora da aba que gerou — sem a sessão de quem pagou, a página não confirma sozinha (o acesso chega
 * no e-mail quando cair).
 */
export function voltaDoLembrete(busca: URLSearchParams, agora: number = Date.now()): VoltaDoLembrete | null {
  const r = busca.get("r");
  if (r !== "t12" && r !== "t20h") return null;
  const pedidoBruto = busca.get("pedido") ?? "";
  const pedido = /^[A-Za-z0-9_-]{6,80}$/.test(pedidoBruto) ? pedidoBruto : null;
  const codigo = busca.get("pix") ?? "";
  const vence = Number(busca.get("vence"));
  const oferta = busca.get("o") as OfertaLanding | null;
  let pix: PixLanding | null = null;
  if (pedido && /^000201[\x20-\x7e]{20,600}$/.test(codigo) && Number.isFinite(vence) && vence - agora > 60_000 && oferta && OFERTAS.includes(oferta)) {
    pix = { orderId: pedido, qrCode: codigo, qrCodeBase64: null, expiresAt: new Date(vence).toISOString(), criadoEm: vence - VALIDADE_PIX_MS, oferta, doEmail: true };
  }
  return { toque: r, pedido, pix };
}
