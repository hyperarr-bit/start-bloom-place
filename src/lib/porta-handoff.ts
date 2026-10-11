/**
 * PORTA → APP JÁ LOGADO (10/10, build 38).
 *
 * A Porta iPhone (coreaplicativo.com.br/comece) cria a conta NO SITE e manda a
 * pessoa pra App Store. Até aqui o app abria na welcome e ela tinha que achar o
 * "Entrar" e digitar o e-mail de novo. Agora o site entrega ao app um CÓDIGO de
 * uso único (função `porta-handoff`, 24 h, 1 uso) por dois caminhos:
 *
 *   1. ÁREA DE TRANSFERÊNCIA (o principal: a pessoa toca "Abrir" na própria App
 *      Store). No toque em "Baixar" o site copiou
 *      `https://coreaplicativo.com.br/p/<código>`. Na 1ª abertura do app (sem
 *      sessão, nunca tentado nesta instalação) o nativo pergunta ao iOS SE há um
 *      link no clipboard (`detectPatterns` — não mostra aviso nenhum); só se
 *      houver, lê o texto (aí o iOS mostra "Permitir colar?"), confere se é o
 *      nosso link e resgata. Sem link: segue pra welcome, sem atraso (≤ 400 ms).
 *   2. LINK `core://porta?c=<código>` — o botão "Abrir o CORE" da tela 7 da
 *      Porta e da página /p/<código>. App fechado (getLaunchUrl) ou aberto
 *      (appUrlOpen), ver deep-link.ts.
 *
 * O resgate: a função devolve o token_hash de um magic link e o app faz
 * `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`. Com a sessão,
 * o caminho normal do app (RootGate → /home → gate PaywallAssinatura) mostra o
 * paywall do teste de 3 dias; o RevenueCat faz logIn com o uid no
 * onAuthStateChange (use-auth).
 *
 * REGRA DA CONTA QUE JÁ ESTÁ NO APARELHO: se já houver sessão, o app só troca
 * de conta se a atual NÃO tem assinatura. Assinante logado nunca é deslogado
 * por um link (o código fica sem uso; a pessoa segue na conta dela). Na dúvida
 * — check-subscription falhou — trata como assinante: não troca. Se o código é
 * da MESMA conta, nada muda. Ao trocar, limpa o cache local da conta anterior
 * (a mesma vassoura do signOut), pra nada vazar de uma conta pra outra.
 *
 * Eventos: porta_handoff {via: "link"|"clipboard", ok, motivo, trocou_conta};
 *          porta_clip_check {tem_url, nosso} (1x por instalação, só iPhone).
 */
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";

export type ViaHandoff = "link" | "clipboard";
export type MotivoHandoff =
  | "ok" | "mesma_conta" | "formato" | "codigo" | "limite" | "rede" | "servidor" | "sessao" | "assinante_logado";
export type ResultadoHandoff = { ok: boolean; motivo: MotivoHandoff; trocouConta?: boolean };

/** O mesmo alfabeto do servidor (supabase/functions/_shared/porta-handoff.ts): 32 símbolos, sem I, O, 0, 1. */
export const RE_CODIGO_PORTA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
export const normalizarCodigo = (v: unknown): string =>
  String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);

/**
 * O código de um link da Porta, ou null. Aceita `core://porta?c=<código>` e
 * `https://coreaplicativo.com.br/p/<código>` (o que o site copia). Formato
 * torto devolve o texto normalizado mesmo assim (o resgate recusa com "formato"
 * e registra) — só não aceita link que não seja da Porta.
 */
export function codigoDoLinkDaPorta(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    if (u.protocol === "core:") {
      const alvo = (u.hostname || u.pathname.replace(/^\/+/, "")).toLowerCase();
      if (alvo !== "porta") return null;
      const c = normalizarCodigo(u.searchParams.get("c"));
      return c || null;
    }
    if (u.protocol === "https:" && /^(www\.)?coreaplicativo\.com\.br$/i.test(u.hostname)) {
      const m = /^\/p\/([^/]+)\/?$/.exec(u.pathname);
      const c = m ? normalizarCodigo(decodeURIComponent(m[1])) : "";
      return c || null;
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ QA (só build de teste) */
/* No Simulador a função ainda não está no ar: o build de TESTE (RC_MOCK=1, `npm run loja -- --teste`)
 * com VITE_PORTA_QA=1 troca o servidor por um falso e a troca do token por um login com a conta de QA
 * (VITE_PORTA_QA_EMAIL/SENHA, criada pelo script do Simulador). A condição usa a constante
 * `__RC_MOCK__` DIRETO (como lib/rc-mock): no build de loja ela é false e o esbuild apaga o ramo —
 * o preparar-loja confere que a marca "__porta_qa_mock" não sobrou no JS e aborta se VITE_PORTA_QA vazar. */
declare const __RC_MOCK__: boolean | undefined;

type RespostaServidor = { token_hash?: string; email?: string; erro?: string };

async function chamarServidor(codigo: string, via: ViaHandoff): Promise<RespostaServidor> {
  if (typeof __RC_MOCK__ !== "undefined" && __RC_MOCK__ === true && import.meta.env.VITE_PORTA_QA === "1") {
    // "__porta_qa_mock": código que começa com ERRO falha como código ruim; o resto "resgata"
    if (codigo.startsWith("ERRO")) return { erro: "codigo" };
    return { token_hash: "__porta_qa_mock", email: String(import.meta.env.VITE_PORTA_QA_EMAIL ?? "") };
  }
  const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "resgatar", codigo, via } });
  if (!error) return (data ?? {}) as RespostaServidor;
  // resposta não-2xx: o corpo ({ erro }) vem no contexto do erro
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const corpo = ctx?.json ? ((await ctx.json()) as RespostaServidor) : null;
    if (corpo?.erro) return corpo;
  } catch { /* corpo ilegível */ }
  throw error;
}

async function trocarPorSessao(tokenHash: string): Promise<boolean> {
  if (typeof __RC_MOCK__ !== "undefined" && __RC_MOCK__ === true && import.meta.env.VITE_PORTA_QA === "1") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(import.meta.env.VITE_PORTA_QA_EMAIL ?? ""),
      password: String(import.meta.env.VITE_PORTA_QA_SENHA ?? ""),
    });
    return !error && !!data?.session;
  }
  const r1 = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (!r1.error && r1.data?.session) return true;
  // "magiclink" é o tipo antigo; o GoTrue novo aceita o mesmo token_hash como "email"
  const r2 = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return !r2.error && !!r2.data?.session;
}

/** A conta logada agora tem assinatura? Falhou a consulta = trata como SIM (nunca troca na dúvida). */
async function contaAtualAssina(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("check-subscription");
    if (error) return true;
    return !!(data as { subscribed?: boolean } | null)?.subscribed;
  } catch {
    return true;
  }
}

async function limparContaAnterior(): Promise<void> {
  try {
    const m = await import("@/hooks/use-auth");
    m.purgeLocalUserCache();
  } catch { /* noop */ }
}

/* O mesmo código pode chegar por dois caminhos na mesma abertura (o "Abrir o CORE" abre o app recém-
 * instalado com o link E o clipboard tem o mesmo código): um resgate só, os dois esperam a mesma promessa. */
const emCurso = new Map<string, Promise<ResultadoHandoff>>();
/** só pros testes */
export function _zerarHandoff(): void { emCurso.clear(); }

/** Troca o código por sessão. Nunca lança. */
export function resgatarCodigo(codigoCru: string, via: ViaHandoff): Promise<ResultadoHandoff> {
  const codigo = normalizarCodigo(codigoCru);
  const ja = emCurso.get(codigo);
  if (ja) return ja;
  const p = resgatar(codigo, via);
  emCurso.set(codigo, p);
  return p;
}

async function resgatar(codigo: string, via: ViaHandoff): Promise<ResultadoHandoff> {
  const fim = (r: ResultadoHandoff): ResultadoHandoff => {
    trackEvent("porta_handoff", { via, ok: r.ok, motivo: r.motivo, trocou_conta: !!r.trocouConta });
    return r;
  };
  try {
    const qa = typeof __RC_MOCK__ !== "undefined" && __RC_MOCK__ === true && import.meta.env.VITE_PORTA_QA === "1";
    if (!qa && !RE_CODIGO_PORTA.test(codigo)) return fim({ ok: false, motivo: "formato" });

    const { data: s } = await supabase.auth.getSession();
    const atual = s?.session?.user ?? null;
    // assinante logado: nunca deslogar por um link
    if (atual && (await contaAtualAssina())) return fim({ ok: false, motivo: "assinante_logado" });

    let resp: RespostaServidor;
    try {
      resp = await chamarServidor(codigo, via);
    } catch {
      return fim({ ok: false, motivo: "rede" });
    }
    if (!resp?.token_hash) {
      const motivo: MotivoHandoff = resp?.erro === "codigo" ? "codigo" : resp?.erro === "limite" ? "limite" : "servidor";
      return fim({ ok: false, motivo });
    }
    if (atual?.email && resp.email && atual.email.toLowerCase() === resp.email.toLowerCase()) {
      return fim({ ok: true, motivo: "mesma_conta" });
    }
    if (atual) await limparContaAnterior();
    if (!(await trocarPorSessao(resp.token_hash))) return fim({ ok: false, motivo: "sessao" });
    return fim({ ok: true, motivo: "ok", trocouConta: !!atual });
  } catch {
    return fim({ ok: false, motivo: "servidor" });
  }
}

/* ------------------------------------------------------------------ área de transferência */

/** Flag do APARELHO (fora das chaves que a vassoura do logout leva: não começa com "core-"). */
export const CHAVE_CLIPBOARD_TENTADO = "porta-clip-tentado";
/** Teto pra perguntar ao iOS se há link no clipboard: sem link, a welcome não espera mais que isso. */
export const LIMITE_DETECCAO_MS = 400;

type PluginClipboard = {
  clipboardTemLink(): Promise<{ temUrl: boolean }>;
  clipboardLer(): Promise<{ texto?: string | null; versao?: number }>;
  clipboardLimpar(o: { versao: number }): Promise<{ limpou: boolean }>;
};
type Carregado = { nativo: PluginClipboard };
let plugin: Promise<Carregado | null> | null = null;
/* Embrulhado num objeto, de propósito: o plugin do Capacitor é um Proxy e resolver uma promise
 * com ele faz o JS procurar `.then()` nele (ver cobranca-nativa.ts / notificacoes.ts). */
const carregarPlugin = (): Promise<Carregado | null> => {
  if (!plugin) {
    plugin = import("@capacitor/core")
      .then(({ registerPlugin }) => ({ nativo: registerPlugin<PluginClipboard>("CoreNativo") }))
      .catch(() => null);
  }
  return plugin;
};
/** só pros testes */
export function _trocarPlugin(p: Promise<Carregado | null> | null): void { plugin = p; }

const comTeto = <T,>(p: Promise<T>, ms: number, padrao: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(padrao), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(padrao); });
  });

const jaTentou = (): boolean => {
  try { return localStorage.getItem(CHAVE_CLIPBOARD_TENTADO) === "1"; } catch { return true; }
};
const marcarTentado = (): void => {
  try { localStorage.setItem(CHAVE_CLIPBOARD_TENTADO, "1"); } catch { /* noop */ }
};

/** Precisa olhar o clipboard nesta abertura? (iPhone, nunca tentado nesta instalação.) Síncrono: sem isso, zero espera. */
export const precisaOlharClipboard = (): boolean => plataformaApp() === "ios" && !jaTentou();
/** Marca "já olhou" (o link de abertura da Porta também conta: o clipboard teria o MESMO código). */
export const marcarClipboardTentado = (): void => marcarTentado();

/**
 * Passo 1 (sem aviso do iOS): há algo com cara de URL no clipboard? `detectPatterns` não lê o conteúdo.
 * Marca a flag ANTES de olhar (1x por instalação, mesmo se o app morrer no meio). Teto de 400 ms no total.
 */
export async function detectarLinkNoClipboard(): Promise<boolean> {
  if (!precisaOlharClipboard()) return false;
  marcarTentado();
  const tem = await comTeto((async () => {
    const p = await carregarPlugin();
    if (!p) return false;
    const r = await p.nativo.clipboardTemLink();
    return !!r?.temUrl;
  })(), LIMITE_DETECCAO_MS, false);
  if (!tem) trackEvent("porta_clip_check", { tem_url: false, nosso: false });
  return tem;
}

/**
 * Passo 2 (só depois do passo 1 dizer que há URL): lê o texto — aqui o iOS pergunta "Permitir colar?",
 * sem teto, é a pessoa respondendo —, confere se é o nosso link e resgata. null = não era nosso.
 */
export async function resgatarDoClipboard(): Promise<ResultadoHandoff | null> {
  const p = await carregarPlugin();
  if (!p) return null;
  let lido: { texto?: string | null; versao?: number } | null = null;
  try { lido = await p.nativo.clipboardLer(); } catch { lido = null; }
  const codigo = codigoDoLinkDaPorta(lido?.texto ?? null);
  trackEvent("porta_clip_check", { tem_url: true, nosso: !!codigo, leu: lido?.texto != null });
  if (!codigo) return null;
  const r = await resgatarCodigo(codigo, "clipboard");
  // o código é de uso único: usado (ou recusado), o link no clipboard não serve pra mais nada.
  // Só limpa se o clipboard ainda é o que lemos (changeCount igual) — nunca apaga o que a pessoa copiou depois.
  if (r.ok || r.motivo === "codigo" || r.motivo === "formato") {
    try { if (typeof lido?.versao === "number") await p.nativo.clipboardLimpar({ versao: lido.versao }); } catch { /* noop */ }
  }
  return r;
}

/** Os dois passos juntos: null quando não havia o que resgatar (segue pra welcome). */
export async function tentarClipboardDaPorta(): Promise<ResultadoHandoff | null> {
  if (!(await detectarLinkNoClipboard())) return null;
  return resgatarDoClipboard();
}

/** Se o app abriu (frio) por um link da Porta, o código dele — pra a 1ª abertura esperar esse resgate em vez do clipboard. */
export async function codigoDoLinkDeAbertura(): Promise<string | null> {
  try {
    const { App } = await import("@capacitor/app");
    const inicial = await comTeto(App.getLaunchUrl(), LIMITE_DETECCAO_MS, undefined as { url?: string } | undefined);
    return codigoDoLinkDaPorta(inicial?.url ?? null);
  } catch {
    return null;
  }
}
