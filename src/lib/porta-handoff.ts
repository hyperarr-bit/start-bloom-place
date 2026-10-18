/**
 * PORTA → APP JÁ LOGADO (10/10, build 38).
 *
 * A Porta iPhone (coreaplicativo.com.br/comece) cria a conta NO SITE e manda a
 * pessoa pra App Store. Pra o app abrir JÁ LOGADO, o site pede um CÓDIGO de uso
 * único (função `porta-handoff`, 24 h, 1 uso) e mostra, na volta da loja, o
 * botão "Abrir o CORE" → `core://entrar?h=<código>` (o mesmo link da página
 * /abrir?h=<código> do site). App fechado (getLaunchUrl) ou aberto (appUrlOpen),
 * ver deep-link.ts e PortaPrimeiraAbertura. `core://entrar` sem `h` só abre o /entrar.
 *
 * ÁREA DE TRANSFERÊNCIA É PROIBIDA (dono 10/10): o "CORE quer colar…" do iOS é
 * feio e, com "Não Permitir", quebra o atalho. Nada aqui lê o clipboard.
 *
 * O resgate: a função devolve o token_hash de um magic link e o app faz
 * `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`. Com a sessão, o
 * RootGate leva pra /home e o gate (TrialBanner) mostra "Você ganhou 3 dias
 * grátis" (conta da Porta) e o paywall curto; o RevenueCat faz logIn com o uid.
 *
 * REGRA DA CONTA QUE JÁ ESTÁ NO APARELHO: se já houver sessão, o app só troca
 * de conta se a atual NÃO tem assinatura. Assinante logado nunca é deslogado
 * por um link (o código fica sem uso; a pessoa segue na conta dela). Na dúvida
 * — check-subscription falhou — trata como assinante: não troca. Se o código é
 * da MESMA conta, nada muda. Ao trocar, limpa o cache local da conta anterior
 * (a mesma vassoura do signOut), pra nada vazar de uma conta pra outra.
 *
 * Evento: porta_handoff {via: "link", ok, motivo, trocou_conta}.
 */
import { supabase } from "@/integrations/supabase/client";
import { marcarEntrouPeloLink } from "@/lib/porta-sessao";
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";

export type ViaHandoff = "link";
export type MotivoHandoff =
  | "ok" | "mesma_conta" | "formato" | "codigo" | "limite" | "rede" | "servidor" | "sessao" | "assinante_logado";
export type ResultadoHandoff = { ok: boolean; motivo: MotivoHandoff; trocouConta?: boolean };

/** O mesmo alfabeto do servidor (supabase/functions/_shared/porta-handoff.ts): 32 símbolos, sem I, O, 0, 1. */
export const RE_CODIGO_PORTA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
export const normalizarCodigo = (v: unknown): string =>
  String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);

/** O link é da Porta? (`core://entrar`, com ou sem código) */
export function ehLinkDeEntrar(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(String(url).trim());
    return u.protocol === "core:" && (u.hostname || u.pathname.replace(/^\/+/, "")).toLowerCase() === "entrar";
  } catch {
    return false;
  }
}

/**
 * O código de um link da Porta, ou null. Aceita `core://entrar?h=<código>` e (pro
 * dia em que existir universal link) `https://coreaplicativo.com.br/abrir?h=<código>`.
 * Formato torto devolve o texto normalizado mesmo assim (o resgate recusa com
 * "formato" e registra) — só não aceita link que não seja da Porta.
 */
export function codigoDoLinkDaPorta(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    if (u.protocol === "core:") {
      if (!ehLinkDeEntrar(url)) return null;
      const c = normalizarCodigo(u.searchParams.get("h"));
      return c || null;
    }
    if (u.protocol === "https:" && /^(www\.)?coreaplicativo\.com\.br$/i.test(u.hostname) && /^\/abrir\/?$/.test(u.pathname)) {
      const c = normalizarCodigo(u.searchParams.get("h"));
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

/* O mesmo link chega por dois caminhos no arranque frio (o deep-link.ts lê o getLaunchUrl E a
 * PortaPrimeiraAbertura também): um resgate só, os dois esperam a mesma promessa. */
const emCurso = new Map<string, Promise<ResultadoHandoff>>();
/** só pros testes */
export function _zerarHandoff(): void { emCurso.clear(); aberturaLida = false; }

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
    if (r.ok) marcarEntrouPeloLink();
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

/* ------------------------------------------------------------------ link de abertura */

/** Teto pra ler o link de abertura: sem link, a welcome não espera mais que isso. */
export const LIMITE_DETECCAO_MS = 400;

const comTeto = <T,>(p: Promise<T>, ms: number, padrao: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(padrao), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(padrao); });
  });

/** Vale olhar o link de abertura antes da welcome? (só o app do iPhone: é onde a Porta manda) */
export const olharLinkDeAbertura = (): boolean => plataformaApp() === "ios";

/** Se o app abriu (frio) por um link da Porta, o código dele — pra a abertura esperar esse resgate em vez de piscar a welcome. */
let aberturaLida = false;
/** só pros testes */
export function _zerarAbertura(): void { aberturaLida = false; }
/* UMA vez por processo: o getLaunchUrl continua devolvendo o link da abertura enquanto o app vive — sem
 * isto, quem saísse da conta e voltasse pra "/" teria o mesmo código "resgatado" de novo. */
export async function codigoDoLinkDeAbertura(): Promise<string | null> {
  if (aberturaLida) return null;
  aberturaLida = true;
  try {
    const { App } = await import("@capacitor/app");
    const inicial = await comTeto(App.getLaunchUrl(), LIMITE_DETECCAO_MS, undefined as { url?: string } | undefined);
    return codigoDoLinkDaPorta(inicial?.url ?? null);
  } catch {
    return null;
  }
}
