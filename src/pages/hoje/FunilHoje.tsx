import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Lock, Pencil, ShieldCheck, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP, destinoNaLanding } from "@/lib/rotas-web";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import { eventoMeta, novoEventId } from "@/pages/venda/rastreio";
import {
  AREAS, CONTAS, DOWNSELL_PRA_SEMPRE_27, FAIXAS, LINHA_RENOVACAO, PLANOS, PRECO_KIT, UPSELL_A_DOIS, UPSELL_PRA_SEMPRE, BUMP_KIT,
  VALOR_OFERTA, calcular, contasEscolhidas, dataCurta, fimDoAcesso, funilHojeLigado, ofertaDoPlano, preco, reais, reaisDigitados, temKit,
  type Conta, type Faixa, type OfertaHoje, type PlanoHoje, type Resultado,
} from "./conteudo";
import {
  EMAIL_OK, emailAtual, gravarAtribuicao, gravarFinancas, gravarKit, pedirBoasVindas, salvarEmailDaCompra, sessaoViva, trazerCompraParaConta,
} from "./conta";
import { PixHoje, PixIcone, venceEm, type PixSalvo } from "./PixHoje";
import { supabase } from "@/integrations/supabase/client";
import "./funil-hoje.css";
import { Confete, Etiqueta, GraficoPraSempre, SeloPago } from "./UpsellAnimado";

/**
 * FUNIL WEB NOVO — coreaplicativo.com.br/hoje (18/10). Só na WEB (SoNaWeb no App.tsx), noindex, sem link no site.
 * Atrás da chave FUNIL_HOJE (padrão OFF; QA `?funil-hoje=on`) — ver ./conteudo.ts.
 *
 *   1 renda (a 1ª tela JÁ é a pergunta; o toque na faixa avança) → 2 contas (chips com valor típico, editáveis) →
 *   3 o número ("você pode gastar R$ X por dia", a MESMA conta do card QUANTO POSSO GASTAR HOJE) → 4 oferta (anual
 *   27,90 o 1º ano × mensal 14,90, os dois no Pix; post-it do Kit +9,90 no MESMO Pix) → 5 Pix na página (Asaas, SEM
 *   conta antes: sessão anônima) → upsells (pra sempre +47 → se recusar, pra sempre por 27 → vida a dois +19,90 →
 *   e-mail da(o) parceira(o)), 1 tela cada com "Não, obrigado" → 6 pós-compra: 1 campo de e-mail → a conta ganha o
 *   e-mail (ou entra na que já existe com código) → "Abrir meu CORE" (o app web logado, Finanças montada) + o bloco
 *   "Seu CORE também no celular" com os selos das lojas e o e-mail.
 *
 * Eventos (analytics_events; todos com hoje_session_id + ids do anúncio; utm_* o trackEvent junta):
 *   hoje_view {attr…, plataforma, in_app, retomou}            1ª carga da sessão
 *   funnel_view {funil:"hoje", step}                           cada tela
 *   funnel_click {funil:"hoje", cta}                           faixa · digitar · ver_numero · ver_core · plano · bump ·
 *                                                              pagar_pix · copiar_pix · ja_paguei · upsell_sim/nao ·
 *                                                              salvar_email · abrir_app
 *   hoje_faixa {faixa} · hoje_contas {n, contas} · hoje_resultado {aperto, por_dia, n, faixa}
 *   hoje_plano {plano} · hoje_bump {marcado} · hoje_pix_gerado {order_id, oferta, valor} · hoje_pix_copiado {ok}
 *   hoje_pago {oferta, order_id, valor} · hoje_upsell {oferta, acao: vista|aceitou|recusou|pago}
 *   hoje_parceiro {ok, motivo} · hoje_email_salvo {via} · hoje_financas {r} · hoje_app_aberto {} · hoje_erro {onde}
 * Meta: ViewContent (1ª carga) e InitiateCheckout (Pagar com Pix, com o valor) no pixel + CAPI (venda-capi), mesmo
 * event_id; Purchase pela CAPI do pagamento (event_id = id do QR) + pixel com o mesmo id (firePixPurchaseOnce).
 */
export type EtapaHoje =
  | "renda" | "contas" | "resultado" | "oferta" | "pix"
  | "up1" | "up1pix" | "down" | "downpix" | "up2" | "up2pix" | "parceiro" | "pago";
const ETAPAS: EtapaHoje[] = ["renda", "contas", "resultado", "oferta", "pix", "up1", "up1pix", "down", "downpix", "up2", "up2pix", "parceiro", "pago"];

export type Pago = { oferta: OfertaHoje; orderId: string; em: number };
export type EstadoHoje = {
  v: 1;
  etapa: EtapaHoje;
  faixa: string | null;
  renda: number;
  contas: Record<string, number>;
  plano: PlanoHoje;
  kit: boolean;
  /** o Pix da tela atual (qualquer oferta) */
  pix: PixSalvo | null;
  /** QRs do plano gerados antes (trocou de plano) — ainda podem ser pagos */
  anteriores: PixSalvo[];
  pagos: Pago[];
  recusou: OfertaHoje[];
  parceiro: string | null;
  email: string | null;
  /** 18/10: o e-mail OPCIONAL salvo na tela do Pix (via "conta" = já é o e-mail da conta; "destino" = já tinha conta,
   *  o servidor leva a compra pra ela) — o pós-compra vem com ele preenchido */
  emailPix?: { email: string; via: "conta" | "destino" } | null;
  /** a tela logo depois de um pagamento mostra "Pagamento confirmado · R$ X" (a seguinte, depois de um "Não", não) */
  banner?: boolean;
};

export const CHAVE_ESTADO_HOJE = "hoje-estado-v1";
let memoria: EstadoHoje | null = null;
/** Só testes. */
export function _zerarEstadoHoje(): void { memoria = null; memoriaSessao = null; }

const novoEstado = (): EstadoHoje => ({
  v: 1, etapa: "renda", faixa: null, renda: 0, contas: {}, plano: "anual", kit: false,
  pix: null, anteriores: [], pagos: [], recusou: [], parceiro: null, email: null,
});
function lerEstado(): EstadoHoje | null {
  if (memoria) return memoria;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_HOJE);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoHoje;
    if (e && e.v === 1 && ETAPAS.includes(e.etapa)) { memoria = { ...novoEstado(), ...e }; return memoria; }
  } catch { /* noop */ }
  return null;
}
function gravarEstado(e: EstadoHoje): void {
  memoria = e;
  try { localStorage.setItem(CHAVE_ESTADO_HOJE, JSON.stringify(e)); } catch { /* storage bloqueado: fica o heap */ }
}

/* a sessão do funil (separada da Porta e da venda) */
const CHAVE_SESSAO_HOJE = "hoje-sessao-v1";
let memoriaSessao: string | null = null;
function sessaoDoHoje(): { id: string; nova: boolean } {
  if (memoriaSessao) return { id: memoriaSessao, nova: false };
  try {
    const s = sessionStorage.getItem(CHAVE_SESSAO_HOJE);
    if (s) { memoriaSessao = s; return { id: s, nova: false }; }
  } catch { /* noop */ }
  try { memoriaSessao = crypto.randomUUID(); } catch { memoriaSessao = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
  try { sessionStorage.setItem(CHAVE_SESSAO_HOJE, memoriaSessao); } catch { /* noop */ }
  return { id: memoriaSessao, nova: true };
}

/** O próximo passo DEPOIS de um pagamento (o plano ou um upsell): cada oferta aparece no máximo 1 vez. */
export function proximoPosCompra(e: Pick<EstadoHoje, "pagos" | "recusou" | "parceiro">, aDois: boolean = UPSELL_A_DOIS): EtapaHoje {
  const pagou = (o: OfertaHoje) => e.pagos.some((p) => p.oferta === o);
  const recusou = (o: OfertaHoje) => e.recusou.includes(o);
  const praSempre = pagou("hv47") || pagou("hv27");
  if (UPSELL_PRA_SEMPRE && !praSempre && !recusou("hv47")) return "up1";
  if (UPSELL_PRA_SEMPRE && DOWNSELL_PRA_SEMPRE_27 && !praSempre && recusou("hv47") && !recusou("hv27")) return "down";
  if (aDois && !pagou("hc199") && !recusou("hc199")) return "up2";
  if (pagou("hc199") && !e.parceiro) return "parceiro";
  return "pago";
}

const plataformaDaWeb = (): "ios" | "android" | "web" => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};

export default function FunilHojeRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  const busca = typeof window === "undefined" ? "" : window.location.search;
  if (!funilHojeLigado(busca)) return <Navigate to={destinoNaLanding(busca)} replace />;
  return <FunilHoje />;
}

export function FunilHoje() {
  const { user, isSubscribed } = useAuth();
  const navigate = useNavigate();

  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    const s = sessaoDoHoje();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const ids = useCallback((): Record<string, unknown> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { hoje_session_id: sessao, ...resto };
  }, [sessao]);
  const clique = (cta: string, extra: Record<string, unknown> = {}) => trackEvent("funnel_click", { funil: "hoje", cta, ...extra, ...ids() });

  const [estado, setEstadoCru] = useState<EstadoHoje>(() => lerEstado() ?? novoEstado());
  const setEstado = useCallback((f: (e: EstadoHoje) => EstadoHoje) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const corpo = useRef<HTMLDivElement>(null);
  const ir = (etapa: EtapaHoje, extra: Partial<EstadoHoje> = {}) => setEstado((e) => ({ ...e, ...extra, etapa }));

  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);

  /* noindex + título, só enquanto a página está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-hoje", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Quanto posso gastar hoje";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  /* hoje_view + ViewContent: 1x por sessão */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    trackEvent("hoje_view", { ...a, atribuicao: origem, hoje_session_id: sessao, plataforma, in_app: emInApp, retomou: estado.etapa !== "renda" ? estado.etapa : null });
    eventoMeta("ViewContent", novoEventId("vc"), { content_name: "hoje", content_category: "venda" }, inicio.current.attr.fbc || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* funnel_view por tela + volta pro topo */
  useEffect(() => {
    trackEvent("funnel_view", { funil: "hoje", step: estado.etapa, ...ids() });
    try { corpo.current?.scrollTo({ top: 0 }); } catch { /* jsdom */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.etapa]);

  const escolhidas: Conta[] = contasEscolhidas(estado.contas);
  const r = calcular(estado.renda, escolhidas);
  const ofertaPlano = ofertaDoPlano(estado.plano, estado.kit);
  const valorPlano = VALOR_OFERTA[ofertaPlano];
  const pagoPlano = estado.pagos.find((p) => p.oferta === "h279" || p.oferta === "h149" || p.oferta === "h279k" || p.oferta === "h149k") ?? null;
  const planoPago: PlanoHoje = pagoPlano ? (pagoPlano.oferta.startsWith("h279") ? "anual" : "mensal") : estado.plano;
  const acesso = fimDoAcesso(planoPago, estado.pagos.map((p) => p.oferta), new Date(pagoPlano?.em ?? Date.now()));
  const acessoTxt = acesso.vitalicio ? "pra sempre" : `até ${dataCurta(acesso.fim)}`;

  /* ── pagamentos ── */
  const aoPagar = (p: PixSalvo) => {
    const s = estadoRef.current;
    if (s.pagos.some((x) => x.orderId === p.orderId)) return;
    const pagos = [...s.pagos, { oferta: p.oferta, orderId: p.orderId, em: Date.now() }];
    trackEvent("hoje_pago", { oferta: p.oferta, order_id: p.orderId, valor: VALOR_OFERTA[p.oferta], ...ids() });
    if (p.oferta === "hv47" || p.oferta === "hv27" || p.oferta === "hc199") trackEvent("hoje_upsell", { oferta: p.oferta, acao: "pago", ...ids() });
    const proximo = proximoPosCompra({ pagos, recusou: s.recusou, parceiro: s.parceiro });
    setEstado((e) => ({ ...e, pagos, pix: null, anteriores: [], etapa: proximo, banner: true }));
  };
  const onPix = (p: PixSalvo | null) => setEstado((e) => ({ ...e, pix: p }));

  const pagar = () => {
    clique("pagar_pix", { plano: estado.plano, kit: estado.kit, valor: valorPlano });
    eventoMeta("InitiateCheckout", novoEventId("ic"), {
      value: valorPlano, currency: "BRL", content_name: estado.kit ? PLANOS[estado.plano].conteudoKit : PLANOS[estado.plano].conteudo,
    }, inicio.current?.attr.fbc || null);
    // trocou de plano/kit depois de gerar um QR: o QR antigo (vivo) entra nos anteriores — pode ser pago ainda
    setEstado((e) => {
      const velho = e.pix && e.pix.oferta !== ofertaPlano && venceEm(e.pix) > Date.now() ? [e.pix] : [];
      return { ...e, etapa: "pix", anteriores: [...e.anteriores, ...velho].slice(-3), pix: e.pix && e.pix.oferta === ofertaPlano ? e.pix : null };
    });
  };

  const upsell = (oferta: OfertaHoje, sim: boolean) => {
    clique(sim ? "upsell_sim" : "upsell_nao", { oferta });
    trackEvent("hoje_upsell", { oferta, acao: sim ? "aceitou" : "recusou", ...ids() });
    if (sim) {
      const etapa: EtapaHoje = oferta === "hv47" ? "up1pix" : oferta === "hv27" ? "downpix" : "up2pix";
      setEstado((e) => ({ ...e, etapa, pix: e.pix && e.pix.oferta === oferta ? e.pix : null }));
      return;
    }
    setEstado((e) => {
      const recusou = [...new Set([...e.recusou, oferta])];
      return { ...e, recusou, pix: null, banner: false, etapa: proximoPosCompra({ pagos: e.pagos, recusou, parceiro: e.parceiro }) };
    });
  };

  /* vista de cada upsell (1 por chegada) */
  useEffect(() => {
    const o: Partial<Record<EtapaHoje, OfertaHoje>> = { up1: "hv47", down: "hv27", up2: "hc199" };
    const oferta = o[estado.etapa];
    if (oferta) trackEvent("hoje_upsell", { oferta, acao: "vista", ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.etapa]);

  const ultimoPago = estado.pagos[estado.pagos.length - 1] ?? null;
  const confirmado = ultimoPago && estado.banner ? (
    <div className="fn-confirmado" data-testid="hoje-confirmado"><Check size={15} strokeWidth={3} />Pagamento confirmado · {preco(VALOR_OFERTA[ultimoPago.oferta])}</div>
  ) : null;

  const e = estado;
  return (
    <div className={e.etapa === "up1" || e.etapa === "down" || e.etapa === "pago" ? "fn ua" : "fn"} data-etapa={e.etapa} data-testid="hoje">
      <div className="fn-corpo" ref={corpo}>
        {e.etapa === "renda" && (
          <TelaRenda
            faixa={e.faixa}
            onFaixa={(f) => {
              clique("faixa", { faixa: f.id });
              trackEvent("hoje_faixa", { faixa: f.id, ...ids() });
              setEstado((x) => ({ ...x, faixa: f.id, renda: f.valor }));
              window.setTimeout(() => ir("contas"), 160); // o realce aparece antes de trocar de tela
            }}
            onDigitado={(n) => {
              clique("faixa", { faixa: "digitou" });
              trackEvent("hoje_faixa", { faixa: "digitou", ...ids() });
              ir("contas", { faixa: "digitou", renda: n });
            }}
            onDigitar={() => clique("digitar")}
          />
        )}

        {e.etapa === "contas" && (
          <div className="fn-tela" key="contas">
            <div className="fn-topo">
              <button type="button" className="fn-voltar" onClick={() => ir("renda")}><ChevronLeft size={18} /><span>Voltar</span></button>
              <span className="fn-topo-dir">Entra {reais(e.renda)}</span>
            </div>
            <div className="fn-barra"><i data-on="" /><i data-on="" /></div>
            <div className="fn-q">
              <div className="fn-kicker">2 de 2</div>
              <h1>Quais contas chegam todo mês?</h1>
              <p>Toque nas suas. O valor é o típico — toque no número pra ajustar.</p>
            </div>
            <div className="fn-chips">
              {CONTAS.map((c) => (
                <button key={c.id} type="button" className="fn-chip" aria-pressed={c.id in e.contas} data-testid={`hoje-conta-${c.id}`}
                  onClick={() => setEstado((x) => { const m = { ...x.contas }; if (c.id in m) delete m[c.id]; else m[c.id] = c.valor; return { ...x, contas: m }; })}>
                  <span aria-hidden>{c.emoji}</span>{c.nome}<small>{reais(e.contas[c.id] ?? c.valor)}</small>
                </button>
              ))}
            </div>
            {escolhidas.length > 0 ? (
              <div className="fn-folha">
                <div className="fn-faixa-sec">Suas contas do mês <b>{reais(r.fixos)}</b></div>
                {escolhidas.map((c) => (
                  <div className="fn-linha" key={c.id}>
                    <span className="fn-linha-emoji" aria-hidden>{c.emoji}</span>
                    <span className="fn-linha-nome">{c.nome}</span>
                    <label className="fn-valor">
                      <small>R$</small>
                      <input inputMode="numeric" aria-label={`Valor de ${c.nome}`} value={c.valor ? c.valor.toLocaleString("pt-BR") : ""} data-testid={`hoje-valor-${c.id}`}
                        onChange={(ev) => { const n = reaisDigitados(ev.target.value); setEstado((x) => ({ ...x, contas: { ...x.contas, [c.id]: n } })); }} />
                    </label>
                    <button type="button" className="fn-tirar" style={{ background: "none" }} aria-label={`Tirar ${c.nome}`}
                      onClick={() => setEstado((x) => { const m = { ...x.contas }; delete m[c.id]; return { ...x, contas: m }; })}><X size={16} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fn-vazio">Nenhuma conta fixa? Tudo bem — o número sai do mesmo jeito.</div>
            )}
            <div className="fn-rodape">
              <button type="button" className="fn-cta" data-testid="hoje-ver-numero" onClick={() => {
                clique("ver_numero", { n: escolhidas.length });
                trackEvent("hoje_contas", { n: escolhidas.length, contas: escolhidas.map((c) => c.id).join(","), ...ids() });
                ir("resultado");
              }}>
                <span>{escolhidas.length > 0 ? "Ver quanto posso gastar" : "Não tenho conta fixa"}</span><ChevronRight size={18} strokeWidth={2.6} />
              </button>
            </div>
          </div>
        )}

        {e.etapa === "resultado" && (
          <TelaResultado r={r} onVisto={() => trackEvent("hoje_resultado", { aperto: r.aperto, por_dia: r.porDia, n: r.n, faixa: e.faixa, ...ids() })}
            onSeguir={() => { clique("ver_core"); ir("oferta"); }} onVoltar={() => ir("contas")} />
        )}

        {e.etapa === "oferta" && (
          <div className="fn-tela" key="oferta">
            <div className="fn-topo">
              <button type="button" className="fn-voltar" onClick={() => ir("resultado")}><ChevronLeft size={18} /><span>Voltar</span></button>
              <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
            </div>
            <div className="fn-oferta-topo">
              <h1>Seu CORE está pronto</h1>
              <span className="fn-recibo"><Check size={14} strokeWidth={3} />Finanças montada · {r.aperto ? "plano de corte" : `${reais(r.porDia)}/dia`} · {r.n} {r.n === 1 ? "conta" : "contas"}</span>
            </div>
            <div className="fn-planos" role="radiogroup" aria-label="Plano">
              <button type="button" className="fn-plano" aria-pressed={e.plano === "anual"} data-testid="hoje-plano-anual"
                onClick={() => { clique("plano", { plano: "anual" }); trackEvent("hoje_plano", { plano: "anual", ...ids() }); setEstado((x) => ({ ...x, plano: "anual" })); }}>
                <span className="fn-plano-selo">MELHOR PREÇO</span>
                <span className="fn-plano-nome">ANUAL<i>{e.plano === "anual" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>27,90</span>
                <span className="fn-plano-sub">1º ano, no Pix</span>
                <span className="fn-plano-mes">R$ 2,33/mês</span>
              </button>
              <button type="button" className="fn-plano" aria-pressed={e.plano === "mensal"} data-testid="hoje-plano-mensal"
                onClick={() => { clique("plano", { plano: "mensal" }); trackEvent("hoje_plano", { plano: "mensal", ...ids() }); setEstado((x) => ({ ...x, plano: "mensal" })); }}>
                <span className="fn-plano-nome">MENSAL<i>{e.plano === "mensal" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>14,90</span>
                <span className="fn-plano-sub">30 dias, no Pix</span>
                <span className="fn-plano-mes" data-cinza="">= R$ 178,80/ano</span>
              </button>
            </div>
            <ul className="fn-inclui">
              <li><Check size={17} strokeWidth={2.8} /><span>Finanças montada + 15 áreas da vida</span></li>
              <li><Check size={17} strokeWidth={2.8} /><span>No iPhone, no Android e no computador</span></li>
            </ul>
            {BUMP_KIT && (
              <button type="button" className="fn-postit" aria-pressed={e.kit} data-testid="hoje-bump"
                onClick={() => { const marcado = !e.kit; clique("bump", { marcado }); trackEvent("hoje_bump", { marcado, ...ids() }); setEstado((x) => ({ ...x, kit: marcado })); }}>
                <span className="fn-caixa">{e.kit && <Check size={15} strokeWidth={3.2} />}</span>
                <span className="fn-postit-txt">
                  <b>+ Kit Primeiro Mês Organizado</b>
                  <span>Plano de 30 dias dentro do seu CORE, planilha de dívidas e os desafios das 4 semanas.</span>
                </span>
                <span className="fn-postit-preco">+ {preco(PRECO_KIT)}</span>
              </button>
            )}
            <div className="fn-rodape" style={{ marginTop: 14 }}>
              {user && isSubscribed && !e.pagos.length ? (
                <>
                  <p className="fn-ja-tem" data-testid="hoje-ja-assinante">Você já tem o CORE ativo nesta conta. Não precisa pagar de novo.</p>
                  <button type="button" className="fn-cta" onClick={() => navigate("/financas")}>Abrir meu CORE</button>
                </>
              ) : (
                <>
                  <div className="fn-garantia-linha"><ShieldCheck size={15} strokeWidth={2.4} />Garantia de 7 dias: não gostou, devolvemos tudo</div>
                  <button type="button" className="fn-cta" onClick={pagar} data-testid="hoje-pagar">
                    <PixIcone /><span>Pagar {preco(valorPlano)} com Pix</span>
                  </button>
                  <p className="fn-renova" data-testid="hoje-renovacao">{LINHA_RENOVACAO[e.plano]}</p>
                </>
              )}
            </div>
          </div>
        )}

        {e.etapa === "pix" && (
          <PixHoje oferta={ofertaPlano} valor={valorPlano} rotulo={`${e.plano === "anual" ? "1º ano do CORE" : "30 dias de CORE"}${e.kit ? " + Kit Primeiro Mês" : ""}`}
            pix={e.pix} anteriores={e.anteriores} onPix={onPix} onPago={aoPagar} onVoltar={() => ir("oferta")} ids={ids}
            emailSalvo={e.emailPix?.email ?? null} onEmailSalvo={(email, via) => setEstado((x) => ({ ...x, emailPix: { email, via } }))} />
        )}

        {e.etapa === "up1" && (
          <TelaUpsell testid="hoje-up1" confirmado={confirmado}
            kicker="Só pra quem acabou de entrar"
            titulo={planoPago === "anual" ? "Troque o 1º ano pelo CORE pra sempre" : "Troque os 30 dias pelo CORE pra sempre"}
            texto="Pague uma vez e nunca mais renove. Tudo que o CORE ganhar daqui pra frente já é seu."
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv47} prefixo="+ "
            itens={["Acesso vitalício às 16 áreas", "No iPhone, no Android e no computador"]}
            visual="grafico" plano={planoPago}
            cta={`Quero o CORE pra sempre · ${preco(VALOR_OFERTA.hv47)}`}
            onSim={() => upsell("hv47", true)} onNao={() => upsell("hv47", false)} />
        )}
        {e.etapa === "down" && (
          <TelaUpsell testid="hoje-down" confirmado={confirmado}
            kicker="Última chance"
            titulo={`O CORE pra sempre por ${preco(VALOR_OFERTA.hv27)} — só agora`}
            texto={`Em vez de ${preco(VALOR_OFERTA.hv47)}, o mesmo acesso pra sempre por ${preco(VALOR_OFERTA.hv27)}. Esta oferta não aparece de novo depois desta tela.`}
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv27} prefixo="+ " riscado={VALOR_OFERTA.hv47}
            itens={["Acesso vitalício às 16 áreas", "Nunca mais renova, nunca mais paga"]}
            visual="etiqueta"
            cta={`Quero por ${preco(VALOR_OFERTA.hv27)}`}
            onSim={() => upsell("hv27", true)} onNao={() => upsell("hv27", false)} />
        )}
        {e.etapa === "up2" && (
          <TelaUpsell testid="hoje-up2" confirmado={confirmado}
            kicker="Pra quem divide a vida"
            titulo="Organize a vida a dois"
            texto={`Uma 2ª conta do CORE pra quem mora com você, pelo mesmo período do seu plano (${acessoTxt}).`}
            nome="2ª conta do CORE" valor={VALOR_OFERTA.hc199} prefixo="+ "
            itens={["Cada um com o seu CORE e os seus dados", "Finanças, casa e rotina de vocês no mesmo ritmo"]}
            cta={`Quero a 2ª conta · ${preco(VALOR_OFERTA.hc199)}`}
            onSim={() => upsell("hc199", true)} onNao={() => upsell("hc199", false)} />
        )}
        {(e.etapa === "up1pix" || e.etapa === "downpix" || e.etapa === "up2pix") && (() => {
          const oferta: OfertaHoje = e.etapa === "up1pix" ? "hv47" : e.etapa === "downpix" ? "hv27" : "hc199";
          const volta: EtapaHoje = e.etapa === "up1pix" ? "up1" : e.etapa === "downpix" ? "down" : "up2";
          return (
            <PixHoje key={oferta} oferta={oferta} valor={VALOR_OFERTA[oferta]} rotulo={oferta === "hc199" ? "2ª conta do CORE" : "CORE pra sempre"}
              pix={e.pix} onPix={onPix} onPago={aoPagar} onVoltar={() => ir(volta, { pix: null })} ids={ids} />
          );
        })()}

        {e.etapa === "parceiro" && (
          <TelaParceiro acessoTxt={acessoTxt} pedido={estado.pagos.find((p) => p.oferta === "hc199")?.orderId ?? ""} ids={ids}
            onPronto={(email) => setEstado((x) => ({ ...x, parceiro: email, etapa: proximoPosCompra({ ...x, parceiro: email }) }))} />
        )}

        {e.etapa === "pago" && (
          <TelaPago
            estado={e} r={r} acessoTxt={acessoTxt} ids={ids}
            totalPago={e.pagos.reduce((s, p) => s + VALOR_OFERTA[p.oferta], 0)}
            onEmail={(email) => setEstado((x) => ({ ...x, email }))}
            onAbrir={() => { clique("abrir_app"); trackEvent("hoje_app_aberto", { ...ids() }); navigate("/financas"); }}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── tela 1 ───────────────────────── */

function TelaRenda({ faixa, onFaixa, onDigitado, onDigitar }: { faixa: string | null; onFaixa: (f: Faixa) => void; onDigitado: (n: number) => void; onDigitar: () => void }) {
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const n = reaisDigitados(texto);
  return (
    <div className="fn-tela" key="renda">
      <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
      <p className="fn-promessa">Descubra <b>quanto você pode gastar hoje</b> — em 20 segundos.</p>
      <div className="fn-barra"><i data-on="" /><i /></div>
      <div className="fn-q">
        <div className="fn-kicker">1 de 2</div>
        <h1>Quanto entra por mês?</h1>
        <p>Mais ou menos. Salário, freela, pensão — tudo junto.</p>
      </div>
      {!digitando ? (
        <div className="fn-faixas">
          {FAIXAS.map((f) => (
            <button key={f.id} type="button" className="fn-faixa-btn" data-on={faixa === f.id ? "" : undefined} data-testid={`hoje-faixa-${f.id}`} onClick={() => onFaixa(f)}>
              <span>{f.rotulo}</span><ChevronRight size={20} strokeWidth={2.4} />
            </button>
          ))}
          <button type="button" className="fn-faixa-btn" data-digitar="" data-testid="hoje-digitar" onClick={() => { onDigitar(); setDigitando(true); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Pencil size={16} strokeWidth={2.2} />Prefiro digitar</span>
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <>
          <div className="fn-folha">
            <div className="fn-faixa-sec">💰 Renda do mês</div>
            <div className="fn-renda">
              <label>
                <small>R$</small>
                <input autoFocus inputMode="numeric" placeholder="0" aria-label="Quanto entra por mês" data-testid="hoje-renda"
                  value={texto} onChange={(ev) => { const v = reaisDigitados(ev.target.value); setTexto(v ? v.toLocaleString("pt-BR") : ""); }} />
              </label>
            </div>
          </div>
          <div style={{ padding: "0 20px" }}>
            <button type="button" className="fn-link" onClick={() => setDigitando(false)}>Voltar pras faixas</button>
          </div>
        </>
      )}
      {!digitando && <div className="fn-confia"><Lock size={13} strokeWidth={2.4} />Grátis · sem cadastro · resultado na hora</div>}
      {digitando && (
        <div className="fn-rodape">
          <button type="button" className="fn-cta" disabled={n <= 0} data-testid="hoje-renda-continuar" onClick={() => onDigitado(n)}>Continuar</button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── tela 3 ───────────────────────── */

/** Sobe do 0 ao número em ~0,9 s (sem animação pra quem pediu menos movimento). */
function useSobe(alvo: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof requestAnimationFrame !== "function") { setV(alvo); return; }
    let raf = 0; const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return v;
}

function TelaResultado({ r, onSeguir, onVoltar, onVisto }: { r: Resultado; onSeguir: () => void; onVoltar: () => void; onVisto: () => void }) {
  const falta = Math.abs(Math.round(r.livre));
  const n = useSobe(r.aperto ? falta : r.porDia);
  // 1 hoje_resultado por chegada na tela (não por re-render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onVisto(); }, []);
  const fimDoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const fimTxt = `${fimDoMes.getDate()}/${String(fimDoMes.getMonth() + 1).padStart(2, "0")}`;
  return (
    <div className="fn-tela" key="resultado">
      <div className="fn-topo">
        <button type="button" className="fn-voltar" onClick={onVoltar}><ChevronLeft size={18} /><span>Ajustar</span></button>
        <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
      </div>
      <div className="fn-res">
        {!r.aperto ? (
          <div className="fn-grande" data-testid="hoje-numero" data-valor={r.porDia}>
            <small>Você pode gastar hoje</small>
            <strong><span className="rs">R$</span>{n.toLocaleString("pt-BR")}<em>por dia</em></strong>
            <p>até o fim do mês ({fimTxt} · {r.dias} dias, contando hoje), já tirando as contas fixas.</p>
          </div>
        ) : (
          <div className="fn-grande" data-aperto="" data-testid="hoje-numero" data-valor={-falta}>
            <small>Suas contas passam da renda</small>
            <strong><span className="rs">R$</span>{n.toLocaleString("pt-BR")}<em>a mais por mês</em></strong>
            <p>Este mês não fecha sem cortar. No CORE você vê conta por conta e decide por onde começar.</p>
          </div>
        )}
        <div className="fn-folha">
          <div className="fn-faixa-sec">🧾 A conta do seu mês</div>
          <div className="fn-conta"><span>Entra no mês</span>{reais(r.renda)}</div>
          <div className="fn-conta"><span>Contas fixas ({r.n})</span>{r.fixos ? `− ${reais(r.fixos)}` : reais(0)}</div>
          <div className="fn-conta" data-forte=""><span>Livre pro mês</span>{r.livre < 0 ? `− ${reais(falta)}` : reais(Math.round(r.livre))}</div>
          {!r.aperto && <div className="fn-conta" data-dia=""><span>÷ {r.dias} dias</span><b>{reais(r.porDia)} por dia</b></div>}
        </div>
        <p className="fn-nota">É a mesma conta que o CORE faz todo dia. Lançou um gasto, o número se ajusta.</p>
        <div className="fn-mais">
          <p>Seu CORE já tem isso montado <span>— e mais 15 áreas: rotina, treino, saúde…</span></p>
          <div className="fn-ladrilhos">
            {AREAS.map((a, i) => (
              <div className="fn-ladrilho" key={a.nome} style={{ background: a.cor }} data-feito={i === 0 ? "" : undefined}><b aria-hidden>{a.emoji}</b>{a.nome}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="fn-rodape">
        <button type="button" className="fn-cta" onClick={onSeguir} data-testid="hoje-ver-core"><span>Ver meu CORE</span><ChevronRight size={18} strokeWidth={2.6} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── upsells ───────────────────────── */

/**
 * Upsell de 1 tela. 18/10 (dono aprovou o desenho): visual="grafico" (up1, pra sempre 47) troca o cartão de preço pelo
 * gráfico "quanto você paga" renovando × pra sempre se desenhando + a faixa do preço; visual="etiqueta" (down, 27) põe
 * a etiqueta de ingresso com o 47 riscado. Textos, valores, botões e eventos iguais; o vida a dois (up2) fica no cartão.
 */
function TelaUpsell({ testid, confirmado, kicker, titulo, texto, nome, valor, prefixo, riscado, itens, cta, onSim, onNao, visual, plano = "anual" }: {
  testid: string; confirmado: ReactNode; kicker: string; titulo: string; texto: string; nome: string; valor: number; prefixo: string;
  riscado?: number; itens: string[]; cta: string; onSim: () => void; onNao: () => void; visual?: "grafico" | "etiqueta"; plano?: PlanoHoje;
}) {
  const inclui = (atraso?: string) => (
    <ul className={atraso ? "fn-inclui ua-entra" : "fn-inclui"} style={atraso ? { animationDelay: atraso } : undefined}>
      {itens.map((t) => <li key={t}><Check size={17} strokeWidth={2.8} /><span>{t}</span></li>)}
    </ul>
  );
  return (
    <div className="fn-tela" key={testid} data-testid={testid}>
      <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
      {confirmado}
      {visual === "grafico" ? (
        <div className="fn-up">
          <div className="fn-kicker ua-entra">{kicker}</div>
          <h1 className="ua-entra">{titulo}</h1>
          <GraficoPraSempre plano={plano} />
          <div className="ua-preco ua-entra" style={{ animationDelay: "2.4s" }}>
            <div><b>{nome}</b><small>pagamento único no Pix</small></div>
            <strong>{riscado ? <s>{preco(riscado)}</s> : null}{prefixo}{preco(valor)}</strong>
          </div>
          <p className="ua-entra ua-texto" style={{ animationDelay: "2.5s" }}>{texto}</p>
          {inclui("2.6s")}
        </div>
      ) : visual === "etiqueta" ? (
        <>
          <div className="fn-up">
            <div className="fn-kicker ua-entra">{kicker}</div>
            <h1 className="ua-entra">{titulo}</h1>
          </div>
          <Etiqueta de={riscado ?? valor} por={valor} nome={nome} />
          <div className="fn-up" style={{ paddingTop: 14 }}>
            <p className="ua-entra" style={{ animationDelay: "1.9s" }}>{texto}</p>
            {inclui("2s")}
          </div>
        </>
      ) : (
        <div className="fn-up">
          <div className="fn-kicker">{kicker}</div>
          <h1>{titulo}</h1>
          <p>{texto}</p>
          <div className="fn-up-card">
            <span className="fn-up-nome">{nome}</span>
            <span className="fn-up-preco">{riscado ? <s>{preco(riscado)}</s> : null}{prefixo}{preco(valor)}</span>
            <span className="fn-up-sub">pagamento único no Pix</span>
          </div>
          {inclui()}
        </div>
      )}
      <div className="fn-rodape">
        <button type="button" className="fn-cta" onClick={onSim} data-testid={`${testid}-sim`}><PixIcone /><span>{cta}</span></button>
        <button type="button" className="fn-link" onClick={onNao} data-testid={`${testid}-nao`}><u>Não, obrigado</u></button>
      </div>
    </div>
  );
}

const MOTIVO_PARCEIRO: Record<string, string> = {
  email_invalido: "Esse e-mail parece errado. Confere e tenta de novo.",
  mesmo_email: "Esse é o e-mail da sua conta. A 2ª conta é pra outra pessoa.",
  nao_pago: "O pagamento ainda está chegando. Tenta de novo em alguns segundos.",
  ja_liberado: "Essa 2ª conta já foi liberada.",
};

function TelaParceiro({ acessoTxt, pedido, ids, onPronto }: { acessoTxt: string; pedido: string; ids: () => Record<string, unknown>; onPronto: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [fase, setFase] = useState<"form" | "enviando" | "ok">("form");
  const [erro, setErro] = useState<string | null>(null);
  const ok = EMAIL_OK.test(email.trim());
  const liberar = async () => {
    setFase("enviando"); setErro(null);
    trackEvent("funnel_click", { funil: "hoje", cta: "liberar_parceiro", ...ids() });
    let motivo = "erro";
    try {
      await sessaoViva();
      const { data } = await supabase.functions.invoke("asaas-pix", { body: { action: "parceiro", id: pedido, email: email.trim().toLowerCase() } });
      const d = data as { ok?: boolean; motivo?: string } | null;
      if (d?.ok) { trackEvent("hoje_parceiro", { ok: true, ...ids() }); setFase("ok"); return; }
      motivo = d?.motivo ?? "erro";
    } catch { /* cai no erro */ }
    trackEvent("hoje_parceiro", { ok: false, motivo, ...ids() });
    if (motivo === "ja_liberado") { setFase("ok"); return; }
    setErro(MOTIVO_PARCEIRO[motivo] ?? "Não consegui liberar agora. Tenta de novo em alguns segundos.");
    setFase("form");
  };
  return (
    <div className="fn-tela" key="parceiro" data-testid="hoje-parceiro" data-fase={fase}>
      <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
      <div className="fn-confirmado"><Check size={15} strokeWidth={3} />Pagamento confirmado · {preco(VALOR_OFERTA.hc199)}</div>
      {fase !== "ok" ? (
        <div className="fn-up">
          <h1>Pra quem é a 2ª conta?</h1>
          <p>Digite o e-mail da pessoa. Ela recebe o acesso ({acessoTxt}) e entra com um código no e-mail — sem senha.</p>
          <div className="fn-email fn-email-solto">
            <label htmlFor="hoje-email-parceiro">E-mail da outra pessoa</label>
            <input id="hoje-email-parceiro" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" placeholder="pessoa@email.com"
              value={email} onChange={(ev) => setEmail(ev.target.value)} data-testid="hoje-email-parceiro" />
            {erro && <p className="fn-erro" role="alert">{erro}</p>}
          </div>
        </div>
      ) : (
        <div className="fn-up">
          <h1>Pronto! A 2ª conta está liberada.</h1>
          <p><b>{email.trim().toLowerCase()}</b> já tem o CORE ({acessoTxt}). Mandamos o acesso pro e-mail dela(e).</p>
        </div>
      )}
      <div className="fn-rodape">
        {fase !== "ok"
          ? <button type="button" className="fn-cta" disabled={!ok || fase === "enviando"} onClick={() => { void liberar(); }} data-testid="hoje-liberar-parceiro">{fase === "enviando" ? "Liberando…" : "Liberar o acesso"}</button>
          : <button type="button" className="fn-cta" onClick={() => onPronto(email.trim().toLowerCase())} data-testid="hoje-parceiro-continuar"><span>Continuar</span><ChevronRight size={18} strokeWidth={2.6} /></button>}
      </div>
    </div>
  );
}

/* ───────────────────────── 6: pós-compra ───────────────────────── */

function TelaPago({ estado, r, acessoTxt, totalPago, ids, onEmail, onAbrir }: {
  estado: EstadoHoje; r: Resultado; acessoTxt: string; totalPago: number; ids: () => Record<string, unknown>;
  onEmail: (email: string) => void; onAbrir: () => void;
}) {
  const [email, setEmail] = useState(estado.email ?? estado.emailPix?.email ?? "");
  const [fase, setFase] = useState<"form" | "salvando" | "existe" | "pronto">(estado.email ? "pronto" : "form");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const finalizou = useRef(false);
  const pedidoPlano = estado.pagos.find((p) => !["hv47", "hv27", "hc199"].includes(p.oferta)) ?? null;
  const pedidoKit = estado.pagos.find((p) => temKit(p.oferta)) ?? null;
  const praSempre = estado.pagos.some((p) => p.oferta === "hv47" || p.oferta === "hv27");

  /** a conta final está pronta: Finanças, kit, atribuição, boas-vindas */
  const finalizar = async (emailFinal: string, via: string) => {
    if (finalizou.current) return;
    finalizou.current = true;
    const fin = await gravarFinancas(estado.renda, contasEscolhidas(estado.contas));
    trackEvent("hoje_financas", { r: fin, ...ids() });
    if (pedidoKit) await gravarKit(pedidoKit.orderId);
    await gravarAtribuicao({
      v: 1, attr: lerAtribuicao(), faixa: estado.faixa, contas: Object.keys(estado.contas).length, plano: estado.plano,
      pagos: estado.pagos.map((p) => p.oferta), hoje_session_id: ids().hoje_session_id, em: new Date().toISOString(),
    });
    if (pedidoPlano) void pedirBoasVindas(pedidoPlano.orderId);
    trackEvent("hoje_email_salvo", { via, ...ids() });
    onEmail(emailFinal);
    setFase("pronto");
  };

  /* já logada com e-mail (pagou na própria conta): não pede nada */
  useEffect(() => {
    if (estado.email) return;
    let vivo = true;
    void (async () => {
      await sessaoViva();
      const atual = await emailAtual();
      if (vivo && atual) { setEmail(atual); await finalizar(atual, "ja_logada"); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvar = async () => {
    setFase("salvando"); setErro(null);
    trackEvent("funnel_click", { funil: "hoje", cta: "salvar_email", ...ids() });
    const res = await salvarEmailDaCompra(email);
    if (res.ok === true) { await finalizar(email.trim().toLowerCase(), res.via); return; }
    if ("existe" in res) { trackEvent("hoje_email_existe", { ...ids() }); setFase("existe"); return; }
    setErro(res.erro);
    setFase("form");
  };

  const entrouComCodigo = async () => {
    const t = await trazerCompraParaConta();
    trackEvent("hoje_vincular", { r: t, ...ids() });
    // a compra já tinha ido pra esta conta pelo e-mail salvo na tela do Pix: não há o que mover, e está tudo certo
    const jaVeio = estado.emailPix?.via === "destino" && estado.emailPix.email === email.trim().toLowerCase();
    if (t === "nao_moveu" && !jaVeio) setAviso("Sua conta já tinha o CORE ativo, então a compra de agora ficou guardada à parte. Fale com o suporte pra devolvermos o valor.");
    await finalizar(email.trim().toLowerCase(), "codigo");
  };

  if (fase === "pronto") {
    const em = estado.email ?? email.trim().toLowerCase();
    return (
      <div className="fn-tela" key="pronto" data-testid="hoje-pronto">
        <div className="fn-pago fn-pago-curto">
          <div className="fn-pago-ok"><Check size={30} strokeWidth={3.2} /></div>
          <h1>Seu CORE está salvo</h1>
          <p>Entre sempre com <b data-testid="hoje-email-final">{em}</b></p>
        </div>
        {aviso && <p className="fn-aviso-fixo" role="status">{aviso}</p>}
        <div className="fn-lojas" data-testid="hoje-lojas">
          <div className="fn-lojas-titulo">Seu CORE também no celular</div>
          <p>O CORE é um app da <b>App Store</b> e da <b>Google Play</b>. Baixe e entre com este e-mail:</p>
          <div className="fn-email-chip">{em}</div>
          <SelosDasLojas onde="hoje_pos_compra" prefixo="web" altura={44} className="fn-selos" />
          <p className="fn-lojas-dica">No app: toque em <b>Entrar</b> → <b>Entrar sem senha</b> e use o código que chega no e-mail.</p>
        </div>
        <div className="fn-rodape">
          <button type="button" className="fn-cta" onClick={onAbrir} data-testid="hoje-abrir"><span>Abrir meu CORE</span><ChevronRight size={18} strokeWidth={2.6} /></button>
          <p className="fn-renova">Abre aqui no navegador, com as suas Finanças já montadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fn-tela" key="pago" data-testid="hoje-pago" data-fase={fase}>
      {/* 18/10 (dono aprovou): check que se desenha + 1 chuva de confete leve (só CSS; some com prefers-reduced-motion) */}
      <Confete />
      <div className="fn-pago">
        <SeloPago />
        <h1 className="ua-entra" style={{ animationDelay: ".5s" }}>Pronto! Seu CORE é seu.</h1>
        <p className="ua-entra" style={{ animationDelay: ".65s" }}>{preco(Math.round(totalPago * 100) / 100)} recebido · acesso {acessoTxt}</p>
        {praSempre && <span className="ua-pra-sempre" data-testid="hoje-pago-pra-sempre"><Sparkles size={13} strokeWidth={2.6} />CORE pra sempre · nunca mais renova</span>}
      </div>
      <div className="fn-folha fn-salvo ua-entra" style={{ animationDelay: ".85s" }}>
        <div className="fn-faixa-sec">💰 Suas Finanças, montadas <b>{r.aperto ? "" : `${reais(r.porDia)}/dia`}</b></div>
        <div className="fn-conta"><span>Entra no mês</span>{reais(r.renda)}</div>
        <div className="fn-conta"><span>Contas fixas ({r.n})</span>{r.fixos ? `− ${reais(r.fixos)}` : reais(0)}</div>
        {fase !== "existe" ? (
          <div className="fn-email">
            <label htmlFor="hoje-email">Seu e-mail, pra salvar seu CORE</label>
            <input id="hoje-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
              value={email} onChange={(ev) => setEmail(ev.target.value)} data-testid="hoje-email" />
            {erro ? <p className="fn-erro" role="alert">{erro}</p> : <p>É com ele que você entra no celular e no computador. Sem senha.</p>}
          </div>
        ) : (
          <div className="fn-email" data-testid="hoje-existe">
            <label>Esse e-mail já tem conta no CORE</label>
            <p style={{ marginTop: 0 }}>Confirme que é você com o código que vamos mandar pra <b>{email.trim().toLowerCase()}</b>. Sua compra vai pra essa conta.</p>
            <EntrarComCodigo email={email} funil="hoje_ja_tem_conta" rotulo="Receber código no e-mail" onSession={() => { void entrouComCodigo(); }} className="fn-codigo-email" />
            <button type="button" className="fn-link" onClick={() => setFase("form")}>Usar outro e-mail</button>
          </div>
        )}
      </div>
      {fase !== "existe" && (
        <div className="fn-rodape">
          <button type="button" className="fn-cta" disabled={!EMAIL_OK.test(email.trim()) || fase === "salvando"} onClick={() => { void salvar(); }} data-testid="hoje-salvar-email">
            <span>{fase === "salvando" ? "Salvando…" : "Salvar e continuar"}</span>{fase !== "salvando" && <ChevronRight size={18} strokeWidth={2.6} />}
          </button>
        </div>
      )}
    </div>
  );
}
