import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEventBeacon } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP, destinoNaLanding } from "@/lib/rotas-web";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import { PLANOS, linkDoCakto, urlDoCakto } from "@/pages/venda/conteudo";
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { cookiesDaMeta, dispararCompraCartao } from "@/pages/venda/rastreio";
import { CartaoVenda, DadosVenda, type ResultadoDados } from "@/pages/venda/telas-venda";
import { PixVenda, type PixGerado } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import { irProCakto } from "@/pages/venda/navegar";
import { Ferramenta, PaginaFunil, Preco, Resultado } from "./telas";
import { cupom, economia, faixaTotal, maisCara, totalAno, totalMes } from "./somatorio";
import { eventoMeta, funile, novoEventId, pixelLead, sessaoDaFunile } from "./rastreio";

/**
 * O FUNIL "SOMA-ASSINATURAS" — /funil-e (18/10). Proposta em FUNIL_PROPOSTA.md.
 *
 * O mecanismo (diferente de TUDO que já falhou): a landing JÁ É a ferramenta.
 * A pessoa toca nas assinaturas que paga (nada de digitar, nada de extrato) e
 * vê o total exato com os preços públicos de hoje — o "CNPJ do LicitaCerta"
 * das finanças pessoais. Não é o quiz do /raio-x: não existe pergunta nem
 * estimativa por faixa; existe uma conta exata sobre a seleção dela, um cupom
 * e uma lista de cancelamento que ela guarda.
 *
 * Fluxo: ferramenta → resultado (total + "qual você não usou?" + lista) →
 * preço (a97, âncora com o número DELA) → dados (a conta nasce aqui) → Pix na
 * página (Asaas a97) ou Cakto → sucesso. O rabo (dados → pix/cartão →
 * sucesso) REUSA os componentes do /assinar (DadosVenda, PixVenda,
 * CartaoVenda, SucessoVenda, conta.ts) — nenhuma lógica de dinheiro duplicada.
 *
 * Só existe FORA do domínio de produção: em coreaplicativo.com.br (e www) a
 * rota devolve pra "/" preservando a query (a campanha de teste aponta pro
 * domínio de preview). SoNaWeb no App.tsx + o cinto isNativeShell aqui.
 * noindex. Nada de segredo: os links da Cakto vêm de env (VITE_VENDA_CAKTO_ANUAL).
 */

export type PassoFunilE = "ferramenta" | "resultado" | "preco" | "dados" | "pix" | "cartao" | "sucesso";
export type MetodoFunilE = "pix" | "cartao";

export type EstadoFunilE = {
  passo: PassoFunilE;
  sel: string[];
  extras: number[];
  /** ids de serviço marcados como "não usei no último mês" */
  naoUsadas: string[];
  /** índices dos extras marcados como "não usei" */
  extrasNaoUsados: number[];
  metodo: MetodoFunilE | null;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  cartaoUrl: string | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  fim?: string | null;
  jaAssinante?: boolean;
};

const PASSOS: PassoFunilE[] = ["ferramenta", "resultado", "preco", "dados", "pix", "cartao", "sucesso"];
const VOLTA: Partial<Record<PassoFunilE, PassoFunilE>> = { resultado: "ferramenta", preco: "resultado", dados: "preco", pix: "preco", cartao: "preco" };

export const CHAVE_ESTADO_FUNILE = "funile-estado-v1";
let memoriaEstado: EstadoFunilE | null = null;
/** só pros testes */
export function _zerarEstadoFunile(): void { memoriaEstado = null; }

const novoEstado = (): EstadoFunilE => ({
  passo: "ferramenta", sel: [], extras: [], naoUsadas: [], extrasNaoUsados: [],
  metodo: null, nome: null, email: null, pix: null, cartaoUrl: null,
});

function lerEstado(): EstadoFunilE | null {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_FUNILE);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoFunilE;
    if (e && PASSOS.includes(e.passo)) { memoriaEstado = e; return e; }
  } catch { /* noop */ }
  return null;
}
function gravarEstado(e: EstadoFunilE): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO_FUNILE, JSON.stringify(e)); } catch { /* Instagram zerou: fica o heap */ }
}

/* ---------------------------------------------------------- o portão do domínio */
const DOMINIOS_PRODUCAO = new Set(["coreaplicativo.com.br", "www.coreaplicativo.com.br"]);
/** Só fora do domínio de produção (o preview da Vercel e o dev local passam). */
export const ehDominioDeProducao = (host: string): boolean => DOMINIOS_PRODUCAO.has(host.trim().toLowerCase());

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

export const URL_QR_FUNILE = "https://coreaplicativo.com.br/baixar?origem=funile_qr";

export default function FunilERota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  let host = "";
  try { host = window.location.hostname; } catch { /* jsdom */ }
  if (ehDominioDeProducao(host)) return <Navigate to={destinoNaLanding(window.location.search)} replace />;
  return <FunilE />;
}

export function FunilE() {
  const { user, loading: authLoading, isSubscribed } = useAuth();
  const params = useMemo(() => { try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } }, []);
  const voltouDoCartao = params.get("pago") === "cartao";

  /* atribuição + sessão: na 1ª renderização (mesmo cano da Porta e do /assinar) */
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    const s = sessaoDaFunile();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { funile_session_id: sessao, ...resto };
  }, [sessao]);

  const [estado, setEstadoCru] = useState<EstadoFunilE>(() => {
    const base = lerEstado() ?? novoEstado();
    if (voltouDoCartao && base.passo !== "sucesso") return { ...base, passo: "cartao", metodo: "cartao" };
    return base;
  });
  const setEstado = useCallback((f: (e: EstadoFunilE) => EstadoFunilE) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ir = (passo: PassoFunilE, extra: Partial<EstadoFunilE> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);
  const linkCartao = useMemo(() => linkDoCakto("anual"), []);

  /* noindex + título, só enquanto a página está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-funile", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Seu somatório";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  /* funile_view + ViewContent: 1x por sessão */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    funile("view", {
      ...a, atribuicao: origem, funile_session_id: sessao, plataforma, in_app: emInApp,
      retomou: estado.passo !== "ferramenta" ? estado.passo : null, pago: voltouDoCartao ? "cartao" : null,
    });
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "funil_e_somatorio", content_category: "venda" }, inicio.current.attr.fbc || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  /* os totais do momento (a fonte única: somatorio.ts). As "não usei" juntam
   * os serviços (por id) e os extras (por índice: "extra-<i>"). */
  const totais = (e: EstadoFunilE = estadoRef.current) => {
    const mes = totalMes(e.sel, e.extras);
    const itens = cupom(e.sel, e.extras);
    const chaves = [...e.naoUsadas, ...e.extrasNaoUsados.map((i) => `extra-${i}`)];
    const marcadas = itens.filter((i) => chaves.includes(i.chave));
    const eco = economia(marcadas);
    return { mes, ano: totalAno(mes), n: e.sel.length + e.extras.length, itens, marcadas, eco, cara: maisCara(marcadas) };
  };

  /* resultado: o marco do funil (Lead no pixel) — 1x por chegada na tela */
  useEffect(() => {
    if (estado.passo !== "resultado") return;
    const t = totais();
    funile("resultado", { n: t.n, mes: t.mes, ano: t.ano, faixa: faixaTotal(t.mes), ...ids() });
    pixelLead({ content_name: "funil_e_somatorio", content_category: "resultado" }, novoEventId("vc"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);
  useEffect(() => {
    if (estado.passo === "preco") funile("preco_view", { faixa: faixaTotal(totais().mes), cartao_anual: !!linkCartao, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  /* ---------------------------------------------------------- ferramenta */
  const onToggle = (id: string) => {
    setEstado((e) => {
      const on = !e.sel.includes(id);
      funile("toque", { servico: id, on, n: on ? e.sel.length + 1 : e.sel.length - 1, ...ids() });
      return {
        ...e,
        sel: on ? [...e.sel, id] : e.sel.filter((s) => s !== id),
        // desmarcou o serviço: ele sai também das "não usei"
        naoUsadas: on ? e.naoUsadas : e.naoUsadas.filter((s) => s !== id),
      };
    });
  };
  const onExtra = (v: number) => {
    funile("outra", { valor: v, ...ids() });
    setEstado((e) => ({ ...e, extras: [...e.extras, v] }));
  };
  const onTiraExtra = (i: number) => {
    setEstado((e) => ({
      ...e,
      extras: e.extras.filter((_, x) => x !== i),
      // os índices dos extras marcados andam junto (o item i some; os depois dele descem 1)
      extrasNaoUsados: e.extrasNaoUsados.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
    }));
  };
  const onSemAssinatura = () => {
    funile("sem_assinatura", { ...ids() });
    ir("resultado");
  };

  /* ---------------------------------------------------------- resultado */
  const onAlternaNaoUsada = (chave: string) => {
    setEstado((e) => {
      const on = !e.naoUsadas.includes(chave);
      funile("nao_usada", { servico: chave, on, ...ids() });
      return { ...e, naoUsadas: on ? [...e.naoUsadas, chave] : e.naoUsadas.filter((c) => c !== chave) };
    });
  };
  const onAlternaExtraNaoUsado = (i: number) => {
    setEstado((e) => {
      const on = !e.extrasNaoUsados.includes(i);
      return { ...e, extrasNaoUsados: on ? [...e.extrasNaoUsados, i] : e.extrasNaoUsados.filter((x) => x !== i) };
    });
  };
  const onEmail = (email: string) => {
    funile("email", { onde: "resultado", ...ids() });
    setEstado((e) => ({ ...e, email }));
  };
  const onSeguirDoResultado = () => {
    const t = totais();
    if (t.eco.n > 0) funile("economia", { n: t.eco.n, mes: t.eco.mes, ano: t.eco.ano, ...ids() });
    ir("preco");
  };

  /* ---------------------------------------------------------- preço → dados */
  const onPagar = (metodo: MetodoFunilE) => {
    funile("pagar_click", { metodo, valor: PLANOS.anual.valor, ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: PLANOS.anual.conteudo, value: PLANOS.anual.valor, currency: "BRL", content_category: metodo }, attrAgora().fbc || null);
    ir("dados", { metodo });
  };

  /* o que vai pra conta (user_metadata.venda, só se ausente) — a seleção dela em TEXTO */
  const montarVenda = (e: EstadoFunilE = estadoRef.current): VendaNaConta => {
    const t = totais(e);
    return {
      v: 1,
      attr: capturarAtribuicao({ search: "" }),
      respostas: {
        funil: "funil-e-soma-assinaturas",
        servicos: e.sel.join(",") || null,
        extras: e.extras.length ? e.extras.join(",") : null,
        nao_usadas: t.marcadas.length ? t.marcadas.map((m) => m.nome).join(",") : null,
        total_mes: String(t.mes),
        total_ano: String(t.ano),
      },
      plano: "anual",
      metodo: e.metodo ?? "pix",
      venda_session_id: sessao,
      criado_em: new Date().toISOString(),
    };
  };

  const [indoCartao, setIndoCartao] = useState(false);
  const seguirPagamento = (nome: string, email: string) => {
    const metodo: MetodoFunilE = estadoRef.current.metodo ?? "pix";
    if (metodo === "pix") {
      ir("pix", { nome, email: email.toLowerCase(), pix: null, jaAssinante: false });
      return;
    }
    if (!linkCartao) {
      funile("erro", { onde: "cakto_sem_link", ...ids() });
      ir("pix", { nome, email: email.toLowerCase(), pix: null, metodo: "pix", jaAssinante: false });
      return;
    }
    const url = urlDoCakto(linkCartao, { email, nome, attr: attrAgora() as unknown as Record<string, string> });
    ir("cartao", { nome, email: email.toLowerCase(), cartaoUrl: url, jaAssinante: false });
    setIndoCartao(true);
    const c = cookiesDaMeta();
    trackEventBeacon("funile_cakto_redirect", { plano: "anual", valor: PLANOS.anual.valor, fbp: c.fbp, fbc: c.fbc || attrAgora().fbc || null, source_url: window.location.href.slice(0, 300), ...ids() });
    window.setTimeout(() => irProCakto(url), 700);
  };

  /* quem já assina não paga de novo (mesma regra do /assinar, conferida no servidor) */
  const irJaAssinante = (nome: string, email: string, fim: string | null, via: string) => {
    funile("ja_assinante", { via, ...ids() });
    ir("sucesso", { nome, email: email.toLowerCase(), jaAssinante: true, fim, pix: null });
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
      irJaAssinante(nome, email, null, "sessao");
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) { funile("conta_existe", { ...ids() }); return { ok: false, existe: true }; }
      const erro = (r as { erro: string }).erro;
      funile("erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    const nova = (r as { nova: boolean }).nova;
    funile("conta", { nova, via: "email", metodo: estadoRef.current.metodo, ...ids() });
    if (nova) seguirPagamento(nome, email);
    else await seguirOuJaAssinante(nome, email, "sessao");
    return { ok: true };
  };
  const onEntrarSenha = async (email: string, senha: string, nome: string): Promise<boolean> => {
    const ok = await entrarComSenha(email, senha, nome, montarVenda());
    if (!ok) return false;
    funile("conta", { nova: false, via: "senha", ...ids() });
    await seguirOuJaAssinante(nome, email, "senha");
    return true;
  };
  const onEntrouCodigo = async (nome: string, email: string) => {
    await entrouPorCodigo(nome, montarVenda());
    funile("conta", { nova: false, via: "codigo", ...ids() });
    await seguirOuJaAssinante(nome, email, "codigo");
  };

  /* ---------------------------------------------------------- pago */
  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) {
        funile("codigo", { ok: false, erro: (error?.message || "sem_codigo").slice(0, 120), ...ids() });
        return;
      }
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((x) => ({ ...x, codigo, emailEnviado }));
      funile("codigo", { ok: true, email: emailEnviado, ...ids() });
    } catch (e) {
      funile("codigo", { ok: false, erro: String(e).slice(0, 120), ...ids() });
    }
  };
  const pediuCodigo = useRef(false);
  const concluirPago = (metodo: MetodoFunilE, valor: number, extra: Record<string, unknown> = {}) => {
    funile("pago", { plano: "anual", metodo, valor, ...extra, ...ids() });
    ir("sucesso", { jaAssinante: false });
    if (!pediuCodigo.current) { pediuCodigo.current = true; void pedirCodigo(); }
  };
  const onPixPago = useCallback(() => {
    concluirPago("pix", PLANOS.anual.valor, { order_id: estadoRef.current.pix?.orderId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p })), [setEstado]);

  /* cartão: na volta, confere a assinatura a cada 4 s e na volta da aba (igual ao /assinar) */
  useEffect(() => {
    if (estado.passo !== "cartao" || indoCartao || authLoading || !user) return;
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
          const r = await dispararCompraCartao("anual");
          setEstado((e) => ({ ...e, fim: d.subscription_end ?? null }));
          concluirPago("cartao", r.valor ?? PLANOS.anual.valor);
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
  }, [estado.passo, indoCartao, authLoading, user?.id]);
  useEffect(() => {
    if (!indoCartao) return;
    const aoVoltar = () => { if (document.visibilityState === "visible") setIndoCartao(false); };
    window.addEventListener("pageshow", aoVoltar);
    const t = window.setTimeout(() => document.addEventListener("visibilitychange", aoVoltar), 1500);
    return () => { window.clearTimeout(t); window.removeEventListener("pageshow", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [indoCartao]);

  /* sucesso: o fim do acesso + o código se a página recarregou sem ele */
  useEffect(() => {
    if (estado.passo !== "sucesso" || authLoading || !user) return;
    if (!estado.fim) {
      void supabase.functions.invoke("check-subscription").then(({ data }) => {
        const fim = (data as { subscription_end?: string | null } | null)?.subscription_end;
        if (fim) setEstado((e) => ({ ...e, fim }));
      }).catch(() => {});
    }
    if (!pediuCodigo.current && !codigoDaPortaOk(estado.codigo)) { pediuCodigo.current = true; void pedirCodigo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, authLoading, user?.id]);

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
    const q = new URLSearchParams({ origem: "funile" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("funile_loja_click", { plataforma, loja, ...ids() });
  };

  /* ---------------------------------------------------------- render */
  const t = totais();
  const volta = VOLTA[estado.passo];

  let tela: React.ReactNode = null;
  if (estado.passo === "ferramenta") {
    tela = (
      <Ferramenta
        sel={estado.sel} extras={estado.extras} total={t.mes} rota="ferramenta"
        onToggle={onToggle} onExtra={onExtra} onTiraExtra={onTiraExtra}
        onVer={() => ir("resultado")} onSemAssinatura={onSemAssinatura}
      />
    );
  } else if (estado.passo === "resultado") {
    tela = (
      <Resultado
        sel={estado.sel} extras={estado.extras} naoUsadas={[...estado.naoUsadas, ...estado.extrasNaoUsados.map((i) => `extra-${i}`)]}
        extrasNaoUsados={estado.extrasNaoUsados} total={t.mes} rota="resultado"
        onAlternaNaoUsada={onAlternaNaoUsada} onAlternaExtraNaoUsado={onAlternaExtraNaoUsado}
        onSeguir={onSeguirDoResultado} email={estado.email} onEmail={onEmail}
      />
    );
  } else if (estado.passo === "preco") {
    tela = <Preco total={t.mes} caraNaoUsada={t.cara ? { nome: t.cara.nome, preco: t.cara.preco } : null} temCartao={!!linkCartao} onPix={() => onPagar("pix")} onCartao={() => onPagar("cartao")} rota="preco" />;
  } else if (estado.passo === "dados") {
    tela = (
      <div className="rounded-[20px] border border-[#ebe8ee] bg-white px-5 pt-2 pb-6 shadow-[0_1px_2px_rgba(22,18,28,.04),0_10px_28px_-14px_rgba(22,18,28,.14)]">
        <DadosVenda
          plano="anual" metodo={estado.metodo ?? "pix"}
          nomeInicial={estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")}
          emailInicial={estado.email ?? ""}
          emailLogado={!authLoading && user?.email ? user.email : null}
          onEnviar={onEnviarDados} onEntrarSenha={onEntrarSenha} onEntrouCodigo={onEntrouCodigo}
          onTrocarPlano={() => ir("preco")}
          onErroCampo={(campo, motivo) => funile("dados_erro", { campo, motivo, ...ids() })}
        />
      </div>
    );
  } else if (estado.passo === "pix") {
    tela = (
      <div className="rounded-[20px] border border-[#ebe8ee] bg-white px-5 pt-2 pb-6 shadow-[0_1px_2px_rgba(22,18,28,.04),0_10px_28px_-14px_rgba(22,18,28,.14)]">
        <PixVenda pix={estado.pix} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"} />
      </div>
    );
  } else if (estado.passo === "cartao") {
    tela = (
      <div className="rounded-[20px] border border-[#ebe8ee] bg-white px-5 pt-2 pb-6 shadow-[0_1px_2px_rgba(22,18,28,.04),0_10px_28px_-14px_rgba(22,18,28,.14)]">
        {!indoCartao && !authLoading && !user ? (
          <SucessoVenda
            plataforma={plataforma} email={estado.email} plano="anual" confirmado={false} voltou={voltou} abrirApp={null} emailEnviado={false}
            fimDoAcesso={null} hrefLoja={hrefLoja} qrUrl={URL_QR_FUNILE} onLoja={onLoja} onAbrirApp={() => {}}
          />
        ) : (
          <CartaoVenda
            fase={indoCartao ? "indo" : "voltou"} plano="anual" urlCakto={estado.cartaoUrl}
            onAbrirDeNovo={() => trackEventBeacon("funile_cakto_redirect", { plano: "anual", valor: PLANOS.anual.valor, de_novo: true, ...ids() })}
            onTrocarPraPix={user?.email ? () => { setIndoCartao(false); ir("pix", { metodo: "pix", pix: null }); } : null}
          />
        )}
      </div>
    );
  } else if (estado.passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    tela = (
      <div className="rounded-[20px] border border-[#ebe8ee] bg-white px-5 pt-4 pb-6 shadow-[0_1px_2px_rgba(22,18,28,.04),0_10px_28px_-14px_rgba(22,18,28,.14)]">
        <SucessoVenda
          plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano="anual" confirmado jaAssinante={!!estado.jaAssinante} voltou={voltou}
          abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
          emailEnviado={comCodigo && !!estado.emailEnviado}
          fimDoAcesso={dataBr(estado.fim)} hrefLoja={hrefLoja} qrUrl={URL_QR_FUNILE} onLoja={onLoja}
          onAbrirApp={() => trackEventBeacon("funile_abrir_app_click", { voltou, ...ids() })}
        />
      </div>
    );
  }

  return (
    <PaginaFunil testid="funile" passo={estado.passo}>
      {volta && (
        <button
          type="button" onClick={() => ir(volta)} data-testid="funile-voltar"
          className="mb-2 -ml-2 flex items-center gap-1 h-9 px-2 rounded-[9px] text-[13.5px] font-semibold text-[#737373] active:bg-[#efece8]"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />Voltar
        </button>
      )}
      {tela}
    </PaginaFunil>
  );
}
