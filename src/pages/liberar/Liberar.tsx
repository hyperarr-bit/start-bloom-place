import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { MODULO_DO_TIPO, type ItemDaDemo } from "@/lib/demo-guiada";
import { VoltaDaDemoProvider, type VoltaDaDemo } from "@/lib/volta-da-demo";
import { DemoDoFunilProvider, type DemoDoFunil } from "@/lib/demo-do-funil";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import { CardPorta, TopoPorta } from "@/pages/porta/telas";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import { lerHtmlDaPorta, msDesdeANavegacao } from "@/pages/porta/medicao";
/* a demo do /experimente (as MESMAS peças) */
import { FAIXA_TEXTO, SEGUNDOS_ATE_A_FOLHA, moduloDaUrl, type ModuloDemo } from "@/pages/experimente/conteudo";
import { NavDemo } from "@/pages/experimente/NavDemo";
import { COMPONENTES, CarregandoModulo } from "@/pages/experimente/modulos";
import { FolhaDemo } from "@/pages/experimente/FolhaDemo";
import { NavegacaoDaDemo, type Desvio } from "@/pages/experimente/navegacao";
import { aindaEsta, codificarItens, decodificarItens, itemDaGravacao, juntarItem, levarItensParaConta, type BancoDosItens } from "@/pages/experimente/itens";
/* a venda do /assinar (as MESMAS telas e chamadas ao servidor) */
import { PLANOS, linkDoCakto, urlDoCakto, type MetodoVenda, type PlanoVenda } from "@/pages/venda/conteudo";
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { cookiesDaMeta, dispararCompraCartao, eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import { CartaoVenda, DadosVenda, PaywallVenda, type ResultadoDados } from "@/pages/venda/telas-venda";
import { PixVenda, type PixGerado } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import { irProCakto } from "@/pages/venda/navegar";
import {
  BENEFICIOS_LIBERAR, BOTAO_LIBERAR, FIM_TEXTO_LIBERAR, FIM_TITULO_LIBERAR, FOLHA_TEXTO_LIBERAR, FOLHA_TITULO_LIBERAR,
  PAYWALL_SUB_LIBERAR, PAYWALL_TITULO_LIBERAR, VARIANTE_LIBERAR, VOLTAR_DEMO_LIBERAR, contextoDoPaywall, moduloMaisUsado,
} from "./conteudo";

/**
 * A DEMO QUE VENDE — coreaplicativo.com.br/liberar?m=financas|rotina|treino|saude|dieta (16/10). Só na WEB
 * (SoNaWeb no App.tsx + cinto aqui), noindex. O /experimente e o /assinar ficam como estão.
 *
 *   DEMO     igual ao /experimente: topo (CORE · Modo demonstração · Entrar · [Liberar meu CORE]) + faixa + as 5
 *            pílulas + o módulo REAL com dados de exemplo (tudo em memória) + "Gostou?" no fim. Só aparece o que a
 *            pessoa toca; a navegação dos módulos fica presa no funil (./navegacao do /experimente). Folha de baixo
 *            1x por sessão (30 s ou 2ª troca de módulo), com "Liberar meu CORE" / "Continuar explorando".
 *   PAYWALL  todo "Liberar meu CORE" (topo, faixa, folha, fim, seta ← do módulo, saída do módulo) abre o PAYWALL do
 *            /assinar (anual R$ 97,90 · R$ 8,16/mês · "Pagar com Pix"; cartão/mensal SÓ com os links da Cakto,
 *            igual ao /assinar) — sem o quiz (a demo faz o papel dele) e com 1 linha do módulo que ela mais usou.
 *   DADOS    nome + e-mail: a conta nasce AQUI, pelo MESMO caminho do /assinar (../venda/conta.ts: sessão anônima +
 *            e-mail; e-mail que já existe entra com senha/código; "já é assinante" não paga de novo).
 *   PIX      o MESMO PixVenda (Asaas a97, QR + copia-e-cola, confere a cada 3 s) → SUCESSO (o mesmo SucessoVenda).
 * O que ELA criou na demo (gasto, hábito digitado, exercício digitado) vai pra conta assim que a conta existe
 * (../experimente/itens.ts — exemplo nunca vai).
 *
 * O passo mora na URL (`passo=paywall|dados|pix|cartao|sucesso`), então o Voltar do navegador volta pra demo; o
 * resto (plano, e-mail, Pix) em localStorage "liberar-estado-v1" (separado do /assinar).
 *
 * Eventos (todos com venda_session_id + ids do anúncio + variante "demo"):
 *   demo_view · demo_pilula · demo_edicao · demo_item · demo_folha_view/_criar/_fechar · demo_navegacao ·
 *   demo_entrar_click · demo_itens_conta (como no /experimente)
 *   demo_liberar_click {origem: "topo"|"faixa"|"folha"|"fim"|"seta"|"modulo", modulo, ms_na_demo, itens}
 *   venda_passo {passo, resposta: "view"} · venda_paywall_view · venda_plano_click · venda_conta · venda_conta_existe ·
 *   venda_dados_erro · venda_ja_assinante · venda_pix_qr_view · venda_pix_copiado · venda_erro · venda_pago ·
 *   venda_cakto_redirect · venda_loja_click · venda_codigo · venda_abrir_app_click (como no /assinar)
 * Meta: ViewContent 1x por sessão (pixel + CAPI, mesmo event_id); InitiateCheckout no toque do plano e Purchase
 * (CAPI do pagamento com event_id = id do pedido + pixel com o mesmo id) EXATAMENTE como no /assinar.
 * Nunca "sem cartão"; área de transferência só no "Copiar código Pix" (dentro do PixVenda).
 */

export type PassoLiberar = "demo" | "paywall" | "dados" | "pix" | "cartao" | "sucesso";
export type OrigemLiberar = "topo" | "faixa" | "folha" | "fim" | "seta" | "modulo";
const PROGRESSO: Partial<Record<PassoLiberar, number>> = { paywall: 0.7, dados: 0.85, pix: 0.95 };
const VOLTA: Partial<Record<PassoLiberar, PassoLiberar>> = { paywall: "demo", dados: "paywall", pix: "paywall", cartao: "paywall" };

export type EstadoLiberar = {
  plano: PlanoVenda | null;
  metodo: MetodoVenda | null;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  cartaoUrl: string | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  fim?: string | null;
  jaAssinante?: boolean;
  /** o pagamento caiu nesta página */
  pago?: boolean;
  /** os itens dela (codificados), fixados no toque em "Liberar meu CORE" */
  itens: string[];
  origem?: OrigemLiberar | null;
  /** o módulo que ela mais usou (no toque) */
  modulo?: ModuloDemo | null;
};

export const CHAVE_ESTADO_LIBERAR = "liberar-estado-v1";
const CHAVE_FOLHA = "liberar-folha-v1";
export const URL_QR_LIBERAR = "https://coreaplicativo.com.br/baixar?origem=venda_demo_qr";
/** a gravação dos itens dela não segura nada mais que isso */
const MS_ITENS = 5000;

let memoriaEstado: EstadoLiberar | null = null;
let memoriaFolha = false;
let memoriaVc: string | null = null;
/** só pros testes */
export function _zerarEstadoLiberar(): void { memoriaEstado = null; memoriaFolha = false; memoriaVc = null; }

/* O ViewContent sai 1x por SESSÃO DA VENDA, decidido no efeito (não na renderização): no build de produção a 1ª
 * renderização desta página é descartada (o módulo lazy suspende) e o `nova` do sessaoDaVenda() já chega false na
 * renderização que vale — visto nos prints de 16/10 (o /experimente tem o mesmo efeito no `sessao_nova`). */
const CHAVE_VC = "liberar-vc-v1";
const vcJaSaiu = (sessao: string): boolean => {
  if (memoriaVc === sessao) return true;
  try { return sessionStorage.getItem(CHAVE_VC) === sessao; } catch { return false; }
};
const marcarVc = (sessao: string): void => {
  memoriaVc = sessao;
  try { sessionStorage.setItem(CHAVE_VC, sessao); } catch { /* fica a memória */ }
};

const novoEstado = (): EstadoLiberar => ({ plano: null, metodo: null, nome: null, email: null, pix: null, cartaoUrl: null, itens: [] });
function lerEstado(): EstadoLiberar {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_LIBERAR);
    if (raw) {
      const e = JSON.parse(raw) as EstadoLiberar;
      if (e && typeof e === "object") {
        memoriaEstado = {
          ...novoEstado(), ...e,
          plano: e.plano === "anual" || e.plano === "mensal" ? e.plano : null,
          metodo: e.metodo === "pix" || e.metodo === "cartao" ? e.metodo : null,
          itens: codificarItens(decodificarItens(e.itens)),
        };
        return memoriaEstado;
      }
    }
  } catch { /* noop */ }
  return novoEstado();
}
function gravarEstado(e: EstadoLiberar): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO_LIBERAR, JSON.stringify(e)); } catch { /* storage bloqueado: fica a memória */ }
}
const folhaJaVista = (): boolean => {
  if (memoriaFolha) return true;
  try { return sessionStorage.getItem(CHAVE_FOLHA) === "1"; } catch { return false; }
};
const marcarFolhaVista = () => {
  memoriaFolha = true;
  try { sessionStorage.setItem(CHAVE_FOLHA, "1"); } catch { /* noop */ }
};

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};
const dataBr = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getFullYear() > 2100) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
};
const comTempo = <T,>(p: Promise<T>, ms: number, seEsgotar: T): Promise<T> =>
  Promise.race([p, new Promise<T>((r) => window.setTimeout(() => r(seEsgotar), ms))]);

/** O passo pedido na URL, conferido com o que existe (recarregar no meio nunca cai numa tela sem dado). */
export function passoValido(pedido: string | null, e: EstadoLiberar): PassoLiberar {
  switch (pedido) {
    case "sucesso": return e.pago || e.jaAssinante ? "sucesso" : "paywall";
    case "pix": return e.email && e.plano === "anual" ? "pix" : e.plano ? "dados" : "paywall";
    case "cartao": return e.cartaoUrl && e.email ? "cartao" : "paywall";
    case "dados": return e.plano ? "dados" : "paywall";
    case "paywall": return "paywall";
    default: return "demo";
  }
}

/** A rota: o app da loja NUNCA monta (cinto além do SoNaWeb do App.tsx). */
export default function LiberarRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <Liberar />;
}

export function Liberar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading, isSubscribed } = useAuth();
  const modulo = moduloDaUrl(params.get("m"));

  // atribuição + sessão da venda: na 1ª renderização, antes de qualquer troca de URL
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; entrada: ModuloDemo; t0: number } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    inicio.current = { attr, sessao: sessaoDaVenda().id, entrada: modulo, t0: Date.now() };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { venda_session_id: sessao, ...resto, variante: VARIANTE_LIBERAR };
  }, [sessao]);
  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);
  const cartao = useMemo(() => ({ anual: linkDoCakto("anual"), mensal: linkDoCakto("mensal") }), []);

  const [estado, setEstadoCru] = useState<EstadoLiberar>(lerEstado);
  const setEstado = useCallback((f: (e: EstadoLiberar) => EstadoLiberar) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const passo = passoValido(params.get("passo"), estado);

  /* noindex + título, só enquanto a página está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-liberar", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Experimente o app";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [passo, modulo]);

  /* ViewContent: 1x por sessão da venda (pixel + CAPI, mesmo event_id — o mesmo do /assinar) */
  const sessaoNova = useRef(false);
  useEffect(() => {
    if (vcJaSaiu(sessao)) return;
    sessaoNova.current = true;
    marcarVc(sessao);
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "venda_web", content_category: "venda_demo" }, inicio.current!.attr.fbc || null);
  }, [sessao]);

  const urlDoPasso = (p: PassoLiberar): string => {
    const q = new URLSearchParams(params);
    if (p === "demo") q.delete("passo"); else q.set("passo", p);
    if (!q.get("m")) q.set("m", modulo);
    return `/liberar?${q.toString()}`;
  };
  const ir = (p: PassoLiberar, extra: Partial<EstadoLiberar> = {}, replace = false) => {
    if (Object.keys(extra).length) setEstado((e) => ({ ...e, ...extra }));
    navigate(urlDoPasso(p), { replace });
  };

  /* ---------------------------------------------------------- a demo (a mesma do /experimente) */
  const mexidas = useRef<Partial<Record<ModuloDemo, Record<string, unknown>>>>({});
  const contagem = useRef<Partial<Record<ModuloDemo, number>>>({});
  const moduloRef = useRef(modulo);
  moduloRef.current = modulo;
  const editados = useRef(new Set<string>());
  const [itens, setItens] = useState<ItemDaDemo[]>(() => decodificarItens(estado.itens));
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const ler = (m: ModuloDemo) => (k: string): unknown => {
    const mx = mexidas.current[m];
    if (mx && k in mx) return mx[k];
    return getSeedsForModule(m)[k];
  };

  const aoGravar = useCallback((chave: string, valor: unknown, anterior: unknown, gesto: boolean) => {
    const m = moduloRef.current;
    (mexidas.current[m] ??= {})[chave] = valor;
    if (!gesto) return;
    contagem.current[m] = (contagem.current[m] ?? 0) + 1;
    if (!editados.current.has(m)) {
      editados.current.add(m);
      trackEvent("demo_edicao", { modulo: m, chave, ...ids() });
    }
    const item = itemDaGravacao(m, chave, valor, anterior, ler(m));
    if (!item) return;
    const n = juntarItem(itensRef.current, item);
    if (n !== itensRef.current) {
      itensRef.current = n;
      setItens(n);
      trackEvent("demo_item", { tipo: item.tipo, n: n.length, modulo: m, ...ids() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sementeDoModulo = useCallback((s: Record<string, unknown>) => ({ ...s, ...(mexidas.current[moduloRef.current] ?? {}) }), []);

  /* demo_view: 1ª vez de cada módulo nesta página */
  const vistos = useRef(new Set<string>());
  useEffect(() => {
    if (passo !== "demo" || vistos.current.has(modulo)) return;
    const entrada = vistos.current.size === 0;
    vistos.current.add(modulo);
    const extra: Record<string, unknown> = {};
    if (entrada) {
      const { origem, ...a } = inicio.current!.attr;
      const html = lerHtmlDaPorta(); // o porta_html do index.html (variante "liberar"), pra juntar
      Object.assign(extra, a, { atribuicao: origem, plataforma, in_app: emInApp, sessao_nova: sessaoNova.current, html_id: html?.id ?? null, html_ms: html?.t ?? null });
    }
    trackEvent("demo_view", { modulo, tempo_ms: msDesdeANavegacao(), entrada, ...extra, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, modulo]);

  /* a folha de baixo: 1x por sessão, aos 30 s de demo ou na 2ª troca de módulo; nunca depois de ela ir pro paywall */
  const [folha, setFolha] = useState<null | "30s" | "pilula">(null);
  const mostrarFolha = useCallback((gatilho: "30s" | "pilula") => {
    if (folhaJaVista()) return;
    marcarFolhaVista();
    setFolha(gatilho);
    trackEvent("demo_folha_view", { gatilho, modulo: moduloRef.current, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (passo !== "demo" || folhaJaVista()) return;
    const t = window.setTimeout(() => mostrarFolha("30s"), SEGUNDOS_ATE_A_FOLHA * 1000);
    return () => window.clearTimeout(t);
  }, [passo, mostrarFolha]);
  const fecharFolha = (via: "botao" | "x") => {
    if (folha) trackEvent("demo_folha_fechar", { gatilho: folha, via, ...ids() });
    setFolha(null);
  };

  const trocas = useRef(0);
  const trocarModulo = (para: ModuloDemo) => {
    if (para === modulo) return;
    trocas.current += 1;
    trackEvent("demo_pilula", { de: modulo, para, n: trocas.current, ...ids() });
    const q = new URLSearchParams(params);
    q.set("m", para);
    q.delete("aba");
    navigate({ search: `?${q.toString()}` }, { replace: true });
    if (trocas.current === 2) mostrarFolha("pilula");
  };

  /** O toque em "Liberar meu CORE": fixa o que vai pra conta (só o que ela criou E ainda está lá) e mede. */
  const cliqueLiberar = (origem: OrigemLiberar) => {
    const valendo = itensRef.current.filter((i) => aindaEsta(i, ler(MODULO_DO_TIPO[i.tipo] as ModuloDemo)));
    const mais = moduloMaisUsado(contagem.current, modulo);
    marcarFolhaVista(); // foi pro paywall: a folha não tem mais o que dizer
    setEstado((e) => ({ ...e, itens: codificarItens(valendo), origem, modulo: mais }));
    trackEvent("demo_liberar_click", { origem, modulo, ms_na_demo: Date.now() - inicio.current!.t0, itens: valendo.length, ...ids() });
  };
  /** já pagou (ou já era assinante) nesta página: o "Liberar" leva pro sucesso, não pra cobrar de novo */
  const destinoDoLiberar = (): PassoLiberar => (estadoRef.current.pago || estadoRef.current.jaAssinante ? "sucesso" : "paywall");
  const liberar = (origem: OrigemLiberar) => {
    cliqueLiberar(origem);
    if (origem === "folha") setFolha(null);
    navigate(urlDoPasso(destinoDoLiberar()));
  };

  /* o módulo tentou navegar pra fora: módulo da demo → troca aqui; o resto → o paywall */
  const desviarRef = useRef<(d: NonNullable<Desvio>) => void>(() => {});
  desviarRef.current = (d) => {
    if (d.tipo === "modulo") {
      trackEvent("demo_navegacao", { para: d.modulo, aba: d.aba, acao: "modulo", ...ids() });
      const q = new URLSearchParams(params);
      q.set("m", d.modulo);
      if (d.aba) q.set("aba", d.aba); else q.delete("aba");
      q.delete("passo");
      navigate(`/liberar?${q.toString()}`);
      return;
    }
    trackEvent("demo_navegacao", { para: d.destino, acao: "liberar", ...ids() });
    liberar("modulo");
  };
  const aoDesviar = useCallback((d: NonNullable<Desvio>) => desviarRef.current(d), []);
  const demoDoFunil = useMemo<DemoDoFunil>(() => ({ abrirConta: () => desviarRef.current({ tipo: "conta", destino: "modulo" }) }), []);

  /* a seta ← do cabeçalho dos módulos: na demo, vai pro paywall (mesma fonte do botão) */
  const volta: VoltaDaDemo = { destino: urlDoPasso(destinoDoLiberar()), aoTocar: () => cliqueLiberar("seta"), modulo, extras: { variante: VARIANTE_LIBERAR } };

  /* ---------------------------------------------------------- as telas da venda: 1 venda_passo "view" por chegada */
  useEffect(() => {
    if (passo === "demo") return;
    trackEvent("venda_passo", { passo, area: null, resposta: "view", ...ids() });
    if (passo === "paywall") trackEvent("venda_paywall_view", { area: null, modulo: estadoRef.current.modulo ?? modulo, cartao_anual: !!cartao.anual, mensal: !!cartao.mensal, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  /* o que vai pra conta (user_metadata.venda, só se ausente — ../venda/conta.ts) */
  const montarVenda = (e: EstadoLiberar = estadoRef.current): VendaNaConta & { variante: string } => ({
    v: 1,
    attr: capturarAtribuicao({ search: "" }),
    respostas: {
      modulo: inicio.current!.entrada,
      modulos: [...vistos.current].join(",") || inicio.current!.entrada,
      mais_usado: e.modulo ?? modulo,
      itens: String(e.itens.length),
      origem: e.origem ?? null,
    },
    plano: e.plano ?? "anual",
    metodo: e.metodo ?? "pix",
    venda_session_id: sessao,
    criado_em: new Date().toISOString(),
    variante: VARIANTE_LIBERAR,
  });

  /* os itens que ELA criou na demo vão pra conta assim que a conta existe (1x; idempotente; nunca segura a venda) */
  const levouItens = useRef(false);
  const levarItens = async (): Promise<void> => {
    if (levouItens.current) return;
    const meus = decodificarItens(estadoRef.current.itens);
    if (!meus.length) return;
    levouItens.current = true;
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) { levouItens.current = false; return; }
      const r = await comTempo(levarItensParaConta(supabase as unknown as BancoDosItens, u.id, meus), MS_ITENS, { ok: false, chaves: [], erro: "tempo" });
      trackEvent("demo_itens_conta", { ok: r.ok, n: meus.length, chaves: r.chaves.join(","), erro: r.erro ?? null, ...ids() });
      if (!r.ok) levouItens.current = false; // tenta de novo no sucesso
    } catch {
      levouItens.current = false;
    }
  };

  /* ---------------------------------------------------------- paywall → dados */
  const onEscolher = (plano: PlanoVenda, metodo: MetodoVenda) => {
    const p = PLANOS[plano];
    trackEvent("venda_plano_click", { plano, metodo, valor: p.valor, ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: p.conteudo, value: p.valor, currency: "BRL", content_category: metodo }, attrAgora().fbc || null);
    ir("dados", { plano, metodo });
  };

  /* ---------------------------------------------------------- pagar (igual ao /assinar) */
  const [indoCartao, setIndoCartao] = useState(false);
  const seguirPagamento = (nome: string, email: string) => {
    const e = estadoRef.current;
    const plano = e.plano ?? "anual";
    const metodo: MetodoVenda = plano === "mensal" ? "cartao" : e.metodo ?? "pix";
    if (metodo === "pix") {
      ir("pix", { nome, email: email.toLowerCase(), pix: null, metodo: "pix", plano: "anual", jaAssinante: false });
      return;
    }
    const base = cartao[plano];
    if (!base) {
      trackEvent("venda_erro", { onde: "cakto_sem_link", msg: plano, ...ids() });
      if (plano === "anual") ir("pix", { nome, email: email.toLowerCase(), pix: null, metodo: "pix", plano: "anual" });
      else ir("paywall", { nome, email: email.toLowerCase(), plano: null, metodo: null });
      return;
    }
    const url = urlDoCakto(base, { email, nome, attr: attrAgora() as unknown as Record<string, string> });
    ir("cartao", { nome, email: email.toLowerCase(), cartaoUrl: url, metodo: "cartao", jaAssinante: false });
    setIndoCartao(true);
    const c = cookiesDaMeta();
    trackEventBeacon("venda_cakto_redirect", { plano, valor: PLANOS[plano].valor, fbp: c.fbp, fbc: c.fbc || attrAgora().fbc || null, source_url: window.location.href.slice(0, 300), ...ids() });
    window.setTimeout(() => irProCakto(url), 700);
  };

  const irJaAssinante = (nome: string, email: string, fim: string | null, via: string) => {
    trackEvent("venda_ja_assinante", { via, ...ids() });
    ir("sucesso", { nome, email: email.toLowerCase(), jaAssinante: true, fim, pix: null }, true);
  };
  const conferirJaAssinante = async (): Promise<{ sim: boolean; fim: string | null }> => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
      return { sim: !!d?.subscribed, fim: d?.subscription_end ?? null };
    } catch {
      return { sim: false, fim: null };
    }
  };
  const seguirOuJaAssinante = async (nome: string, email: string, via: string) => {
    const j = await conferirJaAssinante();
    if (j.sim) { irJaAssinante(nome, email, j.fim, via); return; }
    seguirPagamento(nome, email);
  };

  const onEnviarDados = async (nome: string, email: string): Promise<ResultadoDados> => {
    if (isSubscribed && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      void levarItens();
      irJaAssinante(nome, email, null, "sessao");
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) { trackEvent("venda_conta_existe", { ...ids() }); return { ok: false, existe: true }; }
      const erro = (r as { erro: string }).erro;
      trackEvent("venda_erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    const nova = (r as { nova: boolean }).nova;
    trackEvent("venda_conta", { nova, via: "email", plano: estadoRef.current.plano, metodo: estadoRef.current.metodo, ...ids() });
    void levarItens();
    if (nova) seguirPagamento(nome, email);
    else await seguirOuJaAssinante(nome, email, "sessao");
    return { ok: true };
  };
  const onEntrarSenha = async (email: string, senha: string, nome: string): Promise<boolean> => {
    const ok = await entrarComSenha(email, senha, nome, montarVenda());
    if (!ok) return false;
    trackEvent("venda_conta", { nova: false, via: "senha", ...ids() });
    void levarItens();
    await seguirOuJaAssinante(nome, email, "senha");
    return true;
  };
  const onEntrouCodigo = async (nome: string, email: string) => {
    await entrouPorCodigo(nome, montarVenda());
    trackEvent("venda_conta", { nova: false, via: "codigo", ...ids() });
    void levarItens();
    await seguirOuJaAssinante(nome, email, "codigo");
  };

  /* ---------------------------------------------------------- pago */
  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) {
        trackEvent("venda_codigo", { ok: false, erro: (error?.message || "sem_codigo").slice(0, 120), ...ids() });
        return;
      }
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((x) => ({ ...x, codigo, emailEnviado }));
      trackEvent("venda_codigo", { ok: true, email: emailEnviado, ...ids() });
    } catch (e) {
      trackEvent("venda_codigo", { ok: false, erro: String(e).slice(0, 120), ...ids() });
    }
  };
  const pediuCodigo = useRef(false);
  const concluirPago = (metodo: MetodoVenda, valor: number, extra: Record<string, unknown> = {}) => {
    const plano = estadoRef.current.plano ?? "anual";
    trackEvent("venda_pago", { plano, metodo, valor, ...extra, ...ids() });
    ir("sucesso", { pago: true, jaAssinante: false }, true);
    if (!pediuCodigo.current) { pediuCodigo.current = true; void pedirCodigo(); }
  };
  const onPixPago = useCallback(() => {
    concluirPago("pix", PLANOS.anual.valor, { order_id: estadoRef.current.pix?.orderId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p })), [setEstado]);

  /* cartão (só com o link da Cakto): na volta, confere a assinatura a cada 4 s e na volta da aba */
  useEffect(() => {
    if (passo !== "cartao" || indoCartao || authLoading || !user) return;
    let parado = false;
    let timer: number | null = null;
    let rodando = false;
    const conferir = async () => {
      if (parado || rodando) return;
      rodando = true;
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
        if (d?.subscribed && !parado) {
          parado = true;
          const plano = estadoRef.current.plano ?? "anual";
          const r = await dispararCompraCartao(plano);
          setEstado((e) => ({ ...e, fim: d.subscription_end ?? null }));
          concluirPago("cartao", r.valor ?? PLANOS[plano].valor);
          return;
        }
      } catch { /* tenta de novo */ } finally { rodando = false; }
      if (!parado) timer = window.setTimeout(conferir, 4000);
    };
    void conferir();
    const aoVoltar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    return () => {
      parado = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, indoCartao, authLoading, user?.id]);
  useEffect(() => {
    if (!indoCartao) return;
    const aoVoltar = () => { if (document.visibilityState === "visible") setIndoCartao(false); };
    window.addEventListener("pageshow", aoVoltar);
    const t = window.setTimeout(() => document.addEventListener("visibilitychange", aoVoltar), 1500);
    return () => { window.clearTimeout(t); window.removeEventListener("pageshow", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [indoCartao]);

  /* sucesso: o fim do acesso + o código se a página recarregou sem ele + os itens se ainda não foram */
  useEffect(() => {
    if (passo !== "sucesso" || authLoading || !user) return;
    if (!estado.fim) {
      void supabase.functions.invoke("check-subscription").then(({ data }) => {
        const fim = (data as { subscription_end?: string | null } | null)?.subscription_end;
        if (fim) setEstado((e) => ({ ...e, fim }));
      }).catch(() => {});
    }
    if (!pediuCodigo.current && !codigoDaPortaOk(estado.codigo)) { pediuCodigo.current = true; void pedirCodigo(); }
    void levarItens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, authLoading, user?.id]);

  /* ---------------------------------------------------------- sucesso: loja + volta da aba */
  const clicouLoja = useRef(false);
  const [voltou, setVoltou] = useState(false);
  useEffect(() => {
    const aoMudar = () => { if (document.visibilityState === "visible" && clicouLoja.current) setVoltou(true); };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);
  const hrefLoja = (loja: "ios" | "android" | null): string => {
    const a = attrAgora();
    const q = new URLSearchParams({ origem: "venda_demo" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("venda_loja_click", { plataforma, loja, ...ids() });
  };

  /* ---------------------------------------------------------- render: a venda */
  if (passo !== "demo") {
    const anterior = VOLTA[passo];
    const podeVoltar = !!anterior && !(passo === "cartao" && indoCartao);
    const voltar = () => { if (anterior) { setIndoCartao(false); navigate(urlDoPasso(anterior)); } };
    const plano = estado.plano ?? "anual";
    let tela: React.ReactNode = null;
    if (passo === "paywall") {
      tela = (
        <PaywallVenda
          temCartaoAnual={!!cartao.anual} temMensal={!!cartao.mensal} onEscolher={onEscolher}
          titulo={PAYWALL_TITULO_LIBERAR} sub={PAYWALL_SUB_LIBERAR} beneficios={BENEFICIOS_LIBERAR}
          contexto={<Contexto {...contextoDoPaywall(estado.modulo ?? modulo, estado.itens.length)} />}
        />
      );
    } else if (passo === "dados") {
      tela = (
        <DadosVenda
          plano={plano} metodo={plano === "mensal" ? "cartao" : estado.metodo ?? "pix"}
          nomeInicial={estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")}
          emailInicial={estado.email ?? ""}
          emailLogado={!authLoading && user?.email ? user.email : null}
          onEnviar={onEnviarDados} onEntrarSenha={onEntrarSenha} onEntrouCodigo={onEntrouCodigo}
          onTrocarPlano={() => navigate(urlDoPasso("paywall"))}
          onErroCampo={(campo, motivo) => trackEvent("venda_dados_erro", { campo, motivo, ...ids() })}
        />
      );
    } else if (passo === "pix") {
      tela = <PixVenda pix={estado.pix} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"} />;
    } else if (passo === "cartao") {
      if (!indoCartao && !authLoading && !user) {
        tela = (
          <SucessoVenda
            plataforma={plataforma} email={estado.email} plano={plano} confirmado={false} voltou={voltou} abrirApp={null} emailEnviado={false}
            fimDoAcesso={null} hrefLoja={hrefLoja} qrUrl={URL_QR_LIBERAR} onLoja={onLoja} onAbrirApp={() => {}}
          />
        );
      } else {
        tela = (
          <CartaoVenda
            fase={indoCartao ? "indo" : "voltou"} plano={plano} urlCakto={estado.cartaoUrl}
            onAbrirDeNovo={() => trackEventBeacon("venda_cakto_redirect", { plano, valor: PLANOS[plano].valor, de_novo: true, ...ids() })}
            onTrocarPraPix={plano === "anual" && user?.email ? () => { setIndoCartao(false); ir("pix", { metodo: "pix", pix: null }); } : null}
          />
        );
      }
    } else if (passo === "sucesso") {
      const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
      tela = (
        <SucessoVenda
          plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano={plano} confirmado jaAssinante={!!estado.jaAssinante} voltou={voltou}
          abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
          emailEnviado={comCodigo && !!estado.emailEnviado}
          fimDoAcesso={dataBr(estado.fim)} hrefLoja={hrefLoja} qrUrl={URL_QR_LIBERAR} onLoja={onLoja}
          onAbrirApp={() => trackEventBeacon("venda_abrir_app_click", { voltou, ...ids() })}
        />
      );
    }
    return (
      <div className="min-h-[100dvh] bg-[#f6f5f7] text-[#16121c] antialiased" data-testid="liberar" data-passo={passo}>
        <div className="mx-auto w-full max-w-[440px] px-5 pb-10" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
          <TopoPorta compacto />
          <CardPorta progresso={PROGRESSO[passo] ?? null} onVoltar={podeVoltar ? voltar : undefined} passo={passo}>
            {tela}
          </CardPorta>
          {passo === "paywall" && (
            <button type="button" onClick={() => navigate(urlDoPasso("demo"))} className="mt-4 mx-auto flex h-10 px-4 items-center text-[14px] text-[#6b6670]" data-testid="liberar-voltar-demo">
              {VOLTAR_DEMO_LIBERAR}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- render: a demo */
  const Modulo = COMPONENTES[modulo];
  return (
    <VoltaDaDemoProvider value={volta}>
      <div className="demo-com-tour min-h-[100dvh] bg-background [overflow-x:clip]" data-testid="liberar" data-passo="demo" data-modulo={modulo}>
        <NavDemo
          modulo={modulo}
          onTrocar={trocarModulo}
          onCriar={() => liberar("topo")}
          botao={BOTAO_LIBERAR}
          compacto
          onEntrar={() => { trackEvent("demo_entrar_click", { modulo, ...ids() }); navigate("/entrar"); }}
        />
        <div className="bg-secondary text-foreground text-[12.5px] border-b border-border" data-testid="demo-faixa">
          <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-center gap-1.5 text-center">
            <span className="text-muted-foreground">{FAIXA_TEXTO}</span>
            <span aria-hidden className="text-muted-foreground">·</span>
            <button type="button" onClick={() => liberar("faixa")} className="font-semibold underline underline-offset-2" data-testid="demo-faixa-criar">{BOTAO_LIBERAR}</button>
          </div>
        </div>
        <DemoDoFunilProvider value={demoDoFunil}>
          <PreviewUserDataProvider key={modulo} moduleKey={modulo} semente={sementeDoModulo} aoGravar={aoGravar}>
            <NavegacaoDaDemo aoDesviar={aoDesviar}>
              <RouteErrorBoundary routeName={`liberar-${modulo}`}>
                <Suspense fallback={<CarregandoModulo />}>
                  <div data-testid={`demo-modulo-${modulo}`}><Modulo /></div>
                </Suspense>
              </RouteErrorBoundary>
            </NavegacaoDaDemo>
          </PreviewUserDataProvider>
        </DemoDoFunilProvider>
        <section className="max-w-md mx-auto px-4 pt-4 pb-[calc(28px+env(safe-area-inset-bottom))]" data-testid="demo-fim">
          <div className="rounded-[20px] border border-border bg-card px-5 py-5 text-center">
            <p className="text-[18px] font-extrabold tracking-[-0.02em] leading-tight text-balance">{FIM_TITULO_LIBERAR}</p>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground text-pretty">{FIM_TEXTO_LIBERAR}</p>
            <button
              type="button" onClick={() => liberar("fim")} data-testid="demo-fim-criar"
              className="mt-4 w-full h-[50px] rounded-[12px] bg-foreground text-background text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[.985] transition-transform"
            >
              {BOTAO_LIBERAR} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
        {folha && (
          <FolhaDemo
            titulo={FOLHA_TITULO_LIBERAR} texto={FOLHA_TEXTO_LIBERAR} botao={BOTAO_LIBERAR}
            onCriar={() => { trackEvent("demo_folha_criar", { gatilho: folha, ...ids() }); liberar("folha"); }}
            onFechar={fecharFolha}
          />
        )}
      </div>
    </VoltaDaDemoProvider>
  );
}

/** A linha do paywall com o que ela fez na demo (o módulo mais usado; o que ela anotou vai junto). */
function Contexto({ linha, itens }: { linha: string; itens: string | null }) {
  return (
    <>
      <span className="block">{linha}</span>
      {itens && <span className="block mt-0.5 font-medium text-[#6b6670]" data-testid="venda-paywall-contexto-itens">{itens}</span>}
    </>
  );
}
