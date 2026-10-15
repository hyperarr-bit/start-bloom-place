import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import {
  ABERTURA_TUDO, DICA_ORGANIZA, OPCOES_AREA, OPCOES_ORGANIZA, PERGUNTA_AREA, PERGUNTA_DOR, PERGUNTA_NUMERO, PERGUNTA_ORGANIZA,
  alternarOrganiza, labelDe, planoDe3Dias, rotaDe, type EscolhaPorta,
} from "@/pages/porta/conteudo";
import { CardPorta, PerguntaMulti, PerguntaPorta, TopoPorta } from "@/pages/porta/telas";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import {
  PLANOS, SELO_VENDA, SUB_VENDA, TITULO_VENDA, areaDoM, linkDoCakto, urlDoCakto, type MetodoVenda, type PlanoVenda,
} from "./conteudo";
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "./conta";
import { cookiesDaMeta, dispararCompraCartao, eventoMeta, novoEventId, sessaoDaVenda } from "./rastreio";
import { CartaoVenda, DadosVenda, PaywallVenda, PlanoMontado, type ResultadoDados } from "./telas-venda";
import { PixVenda, type PixGerado } from "./PixVenda";
import { SucessoVenda } from "./SucessoVenda";
import { irProCakto } from "./navegar";

/**
 * FUNIL DE VENDA DA WEB — coreaplicativo.com.br/assinar (15/10). Só na WEB (SoNaWeb no App.tsx), noindex.
 * Uma campanha pequena da Meta (R$ 100/dia × 3 dias; ROI < 1,2× desliga). A /comece e a /experimente não mudam.
 *
 * Igual ao funil do app, com o PAYWALL ANTES da conta, no visual da Porta v5 (topo + UM card):
 *   1 área → 2 dor → 3 número → 4 "como você organiza hoje" (as MESMAS perguntas da Porta; `?m=` opcional já
 *   escolhe a área e começa na dor) → 5 "Seu plano está montado" (os 3 dias) → 6 PAYWALL: Anual R$ 97,90 em
 *   destaque (R$ 8,16/mês) com [Pagar com Pix] e [Cartão de crédito] (Cakto, ela parcela); embaixo, menor, o Mensal
 *   R$ 24,90 SÓ no cartão (recorrente) → 7 nome + e-mail (a conta nasce AQUI, ver ./conta.ts) → 8a Pix na página
 *   (Asaas, oferta a97 = 1 ano) ou 8b o checkout da Cakto (e-mail/nome pré-preenchidos + utm/fbclid) → 9 SUCESSO
 *   (loja do aparelho ou QR; "entre com este e-mail"; no iPhone, "Abrir o CORE" já logado pelo porta-handoff).
 * Volta da Cakto: a oferta redireciona pra /assinar?pago=cartao (configurar no painel) — a página confere a
 * assinatura e cai no sucesso; sem sessão neste navegador, mostra o "entre com o e-mail do pagamento".
 *
 * Eventos (analytics_events, todos com venda_session_id + ids do anúncio; utm_* o trackEvent junta):
 *   venda_view {attr…, plataforma, in_app, retomou, m}       1ª carga da sessão
 *   venda_passo {passo, area, resposta}                      area/p2/p3/organiza (resposta = o rótulo) e as telas
 *                                                            montado/paywall/dados/pix/cartao/sucesso (resposta "view")
 *   venda_paywall_view {}                                    cada vez que o paywall aparece
 *   venda_plano_click {plano, metodo, valor}
 *   venda_dados_erro {campo, motivo} · venda_conta {nova, via} · venda_conta_existe {}
 *   venda_pix_qr_view {order_id, valor} · venda_pix_copiado {ok} · venda_erro {onde, msg}
 *   venda_cakto_redirect {plano, valor}                      (beacon: a página sai)
 *   venda_pago {plano, metodo, valor}
 *   venda_loja_click {loja} · venda_codigo {ok} · venda_abrir_app_click {}
 * Meta: ViewContent (1ª carga) e InitiateCheckout (toque no plano) no pixel + CAPI (venda-capi) com o MESMO
 * event_id; Purchase pela CAPI do pagamento (event_id = id do pedido) + pixel com o mesmo id (ver ./rastreio.ts).
 * Nunca "sem cartão". Área de transferência só no "Copiar código Pix".
 */
export type PassoVenda = "area" | "p2" | "p3" | "organiza" | "montado" | "paywall" | "dados" | "pix" | "cartao" | "sucesso";
const PASSOS: PassoVenda[] = ["area", "p2", "p3", "organiza", "montado", "paywall", "dados", "pix", "cartao", "sucesso"];
const QUIZ = new Set<PassoVenda>(["area", "p2", "p3", "organiza"]);
const PROGRESSO: Partial<Record<PassoVenda, number>> = { area: 0.1, p2: 0.25, p3: 0.4, organiza: 0.55, montado: 0.7, paywall: 0.82, dados: 0.92, pix: 0.97 };
const VOLTA: Partial<Record<PassoVenda, PassoVenda>> = { p2: "area", p3: "p2", organiza: "p3", montado: "organiza", paywall: "montado", dados: "paywall", pix: "paywall", cartao: "paywall" };

export type EstadoVenda = {
  passo: PassoVenda;
  escolha: EscolhaPorta | null;
  p2: string | null;
  p3: string | null;
  p4: string[] | null;
  plano: PlanoVenda | null;
  metodo: MetodoVenda | null;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  cartaoUrl: string | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  /** ISO do fim do acesso (check-subscription), pro "acesso até" do sucesso */
  fim?: string | null;
};

export const CHAVE_ESTADO_VENDA = "venda-estado-v1";
let memoriaEstado: EstadoVenda | null = null;
/** só pros testes */
export function _zerarEstadoVenda(): void { memoriaEstado = null; }

const novoEstado = (area: EscolhaPorta | null): EstadoVenda => ({
  passo: area ? "p2" : "area", escolha: area, p2: null, p3: null, p4: null, plano: null, metodo: null, nome: null, email: null, pix: null, cartaoUrl: null,
});
function lerEstado(): EstadoVenda | null {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_VENDA);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoVenda;
    if (e && PASSOS.includes(e.passo)) { memoriaEstado = e; return e; }
  } catch { /* noop */ }
  return null;
}
function gravarEstado(e: EstadoVenda): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO_VENDA, JSON.stringify(e)); } catch { /* storage bloqueado: fica a memória */ }
}

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
const rotulosOrganiza = (ids: string[]): string => OPCOES_ORGANIZA.filter((o) => ids.includes(o.id)).map((o) => o.label).join(", ");

export const URL_QR_VENDA = "https://coreaplicativo.com.br/baixar?origem=venda_qr";

export default function VendaWebRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <VendaWeb />;
}

export function VendaWeb() {
  const { user, loading: authLoading, isSubscribed } = useAuth();
  const params = useMemo(() => { try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } }, []);
  const areaUrl = useMemo(() => areaDoM(params.get("m")), [params]);
  const voltouDoCartao = params.get("pago") === "cartao";

  // atribuição + sessão: na 1ª renderização
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    const s = sessaoDaVenda();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { venda_session_id: sessao, ...resto };
  }, [sessao]);

  const [estado, setEstadoCru] = useState<EstadoVenda>(() => {
    const base = lerEstado() ?? novoEstado(areaUrl);
    if (voltouDoCartao && base.passo !== "sucesso") return { ...base, passo: "cartao", plano: base.plano ?? "anual", metodo: "cartao" };
    return base;
  });
  const setEstado = useCallback((f: (e: EstadoVenda) => EstadoVenda) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ir = (passo: PassoVenda, extra: Partial<EstadoVenda> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);
  const rota = rotaDe(estado.escolha);
  const cartao = useMemo(() => ({ anual: linkDoCakto("anual"), mensal: linkDoCakto("mensal") }), []);

  /* noindex + título, só enquanto a página está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-venda", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Seu plano";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  /* venda_view + ViewContent: 1x por sessão */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    trackEvent("venda_view", {
      ...a, atribuicao: origem, venda_session_id: sessao, plataforma, in_app: emInApp,
      retomou: estado.passo !== "area" && estado.passo !== "p2" ? estado.passo : null, m: params.get("m") || null, pago: voltouDoCartao ? "cartao" : null,
    });
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "venda_web", content_category: "venda" }, inicio.current.attr.fbc || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  const passoFeito = (passo: string, resposta: string | null, area: string | null = estadoRef.current.escolha) =>
    trackEvent("venda_passo", { passo, area, resposta, ...ids() });
  /* as telas depois do quiz: 1 venda_passo "view" por chegada; o paywall também o venda_paywall_view */
  useEffect(() => {
    if (QUIZ.has(estado.passo)) return;
    passoFeito(estado.passo, "view");
    if (estado.passo === "paywall") trackEvent("venda_paywall_view", { area: estado.escolha, cartao_anual: !!cartao.anual, mensal: !!cartao.mensal, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  /* o que vai pra conta (user_metadata.venda, só se ausente) */
  const montarVenda = (e: EstadoVenda = estadoRef.current): VendaNaConta => {
    const r = rotaDe(e.escolha);
    const num = PERGUNTA_NUMERO[r];
    return {
      v: 1,
      attr: capturarAtribuicao({ search: "" }),
      respostas: {
        area: e.escolha ?? "dinheiro", rota: r, p2: e.p2, p3: e.p3,
        atrapalha: labelDe(PERGUNTA_DOR[r].opts, e.p2), [num.key]: labelDe(num.opts, e.p3),
        organiza: e.p4 && e.p4.length ? rotulosOrganiza(e.p4) : null,
      },
      plano: e.plano ?? "anual",
      metodo: e.metodo ?? "pix",
      venda_session_id: sessao,
      criado_em: new Date().toISOString(),
    };
  };

  /* ---------------------------------------------------------- paywall → dados */
  const onEscolher = (plano: PlanoVenda, metodo: MetodoVenda) => {
    const p = PLANOS[plano];
    trackEvent("venda_plano_click", { plano, metodo, valor: p.valor, ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: p.conteudo, value: p.valor, currency: "BRL", content_category: metodo }, attrAgora().fbc || null);
    ir("dados", { plano, metodo });
  };

  /* ---------------------------------------------------------- pagar */
  const [indoCartao, setIndoCartao] = useState(false);
  const seguirPagamento = (nome: string, email: string) => {
    const e = estadoRef.current;
    const plano = e.plano ?? "anual";
    const metodo: MetodoVenda = plano === "mensal" ? "cartao" : e.metodo ?? "pix";
    if (metodo === "pix") {
      ir("pix", { nome, email: email.toLowerCase(), pix: null, metodo: "pix" });
      return;
    }
    const base = cartao[plano];
    if (!base) {
      // sem o link da Cakto daquele plano (não deveria aparecer o botão): o anual cai no Pix
      trackEvent("venda_erro", { onde: "cakto_sem_link", msg: plano, ...ids() });
      ir(plano === "anual" ? "pix" : "paywall", { nome, email: email.toLowerCase(), pix: null, metodo: "pix", plano: "anual" });
      return;
    }
    const url = urlDoCakto(base, { email, nome, attr: attrAgora() as unknown as Record<string, string> });
    ir("cartao", { nome, email: email.toLowerCase(), cartaoUrl: url, metodo: "cartao" });
    setIndoCartao(true);
    // fbp/fbc/url vão junto: o cakto-webhook usa na CAPI do Purchase (o cartão não tem pix_order_created)
    const c = cookiesDaMeta();
    trackEventBeacon("venda_cakto_redirect", { plano, valor: PLANOS[plano].valor, fbp: c.fbp, fbc: c.fbc || attrAgora().fbc || null, source_url: window.location.href.slice(0, 300), ...ids() });
    window.setTimeout(() => irProCakto(url), 700);
  };

  const onEnviarDados = async (nome: string, email: string): Promise<ResultadoDados> => {
    // a conta logada já é assinante (comprou antes): não cobra de novo
    if (isSubscribed && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      trackEvent("venda_ja_assinante", { ...ids() });
      ir("sucesso", { nome, email: email.toLowerCase() });
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) { trackEvent("venda_conta_existe", { ...ids() }); return { ok: false, existe: true }; }
      const erro = (r as { erro: string }).erro;
      trackEvent("venda_erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    trackEvent("venda_conta", { nova: (r as { nova: boolean }).nova, via: "email", plano: estadoRef.current.plano, metodo: estadoRef.current.metodo, ...ids() });
    seguirPagamento(nome, email);
    return { ok: true };
  };
  const onEntrarSenha = async (email: string, senha: string, nome: string): Promise<boolean> => {
    const ok = await entrarComSenha(email, senha, nome, montarVenda());
    if (!ok) return false;
    trackEvent("venda_conta", { nova: false, via: "senha", ...ids() });
    seguirPagamento(nome, email);
    return true;
  };
  const onEntrouCodigo = async (nome: string, email: string) => {
    await entrouPorCodigo(nome, montarVenda());
    trackEvent("venda_conta", { nova: false, via: "codigo", ...ids() });
    seguirPagamento(nome, email);
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
    ir("sucesso");
    if (!pediuCodigo.current) { pediuCodigo.current = true; void pedirCodigo(); }
  };
  const onPixPago = useCallback(() => {
    concluirPago("pix", PLANOS.anual.valor, { order_id: estadoRef.current.pix?.orderId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p })), [setEstado]);

  /* cartão: na volta (ou na página de obrigado), confere a assinatura a cada 4 s e na volta da aba */
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
  }, [estado.passo, indoCartao, authLoading, user?.id]);
  /* voltou do checkout pela seta do navegador (bfcache): o "indo" vira "confirmando" */
  useEffect(() => {
    if (!indoCartao) return;
    const aoVoltar = () => { if (document.visibilityState === "visible") setIndoCartao(false); };
    window.addEventListener("pageshow", aoVoltar);
    const t = window.setTimeout(() => document.addEventListener("visibilitychange", aoVoltar), 1500);
    return () => { window.clearTimeout(t); window.removeEventListener("pageshow", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [indoCartao]);

  /* sucesso: o fim do acesso (Pix) + o código se a página recarregou sem ele */
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
    const q = new URLSearchParams({ origem: "venda" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("venda_loja_click", { plataforma, loja, ...ids() });
  };

  /* ---------------------------------------------------------- render */
  const progresso = PROGRESSO[estado.passo] ?? null;
  const volta = VOLTA[estado.passo];
  const podeVoltar = !!volta && !(estado.passo === "cartao" && indoCartao);
  const voltar = () => { if (volta) { setIndoCartao(false); ir(volta); } };
  const plano = estado.plano ?? "anual";

  let tela: React.ReactNode = null;
  if (estado.passo === "area") {
    tela = (
      <PerguntaPorta
        key="area" testid="porta-q-area" titulo={PERGUNTA_AREA} opcoes={OPCOES_AREA} inicial={estado.escolha}
        onEscolher={(o) => {
          const area = o.id as EscolhaPorta;
          passoFeito("area", area, area);
          ir("p2", estadoRef.current.escolha === area ? { escolha: area } : { escolha: area, p2: null, p3: null });
        }}
      />
    );
  } else if (estado.passo === "p2") {
    const q = PERGUNTA_DOR[rota];
    tela = (
      <PerguntaPorta
        key={`p2-${rota}`} testid="porta-q-p2" titulo={q.q} opcoes={q.opts} inicial={estado.p2}
        sub={estado.escolha === "tudo" ? ABERTURA_TUDO : undefined}
        onEscolher={(o) => { passoFeito("p2", o.label); ir("p3", { p2: o.id }); }}
      />
    );
  } else if (estado.passo === "p3") {
    const q = PERGUNTA_NUMERO[rota];
    tela = <PerguntaPorta key={`p3-${rota}`} testid="porta-q-p3" titulo={q.q} opcoes={q.opts} inicial={estado.p3} onEscolher={(o) => { passoFeito("p3", o.label); ir("organiza", { p3: o.id }); }} />;
  } else if (estado.passo === "organiza") {
    tela = (
      <PerguntaMulti
        testid="porta-q-organiza" titulo={PERGUNTA_ORGANIZA} sub={DICA_ORGANIZA} opcoes={OPCOES_ORGANIZA}
        inicial={estado.p4 ?? []} alternar={alternarOrganiza}
        onContinuar={(sel) => { passoFeito("organiza", rotulosOrganiza(sel)); ir("montado", { p4: sel }); }}
      />
    );
  } else if (estado.passo === "montado") {
    const plano3 = planoDe3Dias(rota, estado.p2);
    tela = <PlanoMontado dias={plano3} motivo={plano3.motivo} onContinuar={() => ir("paywall")} />;
  } else if (estado.passo === "paywall") {
    tela = <PaywallVenda temCartaoAnual={!!cartao.anual} temMensal={!!cartao.mensal} onEscolher={onEscolher} />;
  } else if (estado.passo === "dados") {
    tela = (
      <DadosVenda
        plano={plano} metodo={plano === "mensal" ? "cartao" : estado.metodo ?? "pix"}
        nomeInicial={estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")}
        emailInicial={estado.email ?? ""}
        emailLogado={!authLoading && user?.email ? user.email : null}
        onEnviar={onEnviarDados} onEntrarSenha={onEntrarSenha} onEntrouCodigo={onEntrouCodigo}
        onTrocarPlano={() => ir("paywall")}
        onErroCampo={(campo, motivo) => trackEvent("venda_dados_erro", { campo, motivo, ...ids() })}
      />
    );
  } else if (estado.passo === "pix") {
    tela = <PixVenda pix={estado.pix} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"} />;
  } else if (estado.passo === "cartao") {
    if (!indoCartao && !authLoading && !user) {
      // voltou da Cakto num navegador sem a sessão: não dá pra conferir daqui
      tela = (
        <SucessoVenda
          plataforma={plataforma} email={estado.email} plano={plano} confirmado={false} voltou={voltou} abrirApp={null} emailEnviado={false}
          fimDoAcesso={null} hrefLoja={hrefLoja} qrUrl={URL_QR_VENDA} onLoja={onLoja} onAbrirApp={() => {}}
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
  } else if (estado.passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    tela = (
      <SucessoVenda
        plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano={plano} confirmado voltou={voltou}
        abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
        emailEnviado={comCodigo && !!estado.emailEnviado}
        fimDoAcesso={dataBr(estado.fim)} hrefLoja={hrefLoja} qrUrl={URL_QR_VENDA} onLoja={onLoja}
        onAbrirApp={() => trackEventBeacon("venda_abrir_app_click", { voltou, ...ids() })}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f6f5f7] text-[#16121c] antialiased" data-testid="venda" data-passo={estado.passo}>
      <div className="mx-auto w-full max-w-[440px] px-5 pb-10" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        <TopoPorta selo={SELO_VENDA} titulo={TITULO_VENDA} sub={SUB_VENDA} compacto={!QUIZ.has(estado.passo)} />
        <CardPorta progresso={progresso} onVoltar={podeVoltar ? voltar : undefined} passo={estado.passo}>
          {tela}
        </CardPorta>
      </div>
    </div>
  );
}
