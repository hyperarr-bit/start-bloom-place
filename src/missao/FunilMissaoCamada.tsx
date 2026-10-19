import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { EVENTO_MISSAO_DOSES, MODULOS, lerMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { EVENTO_MISSAO_WEB, gravarMissaoWeb, lerMissaoWeb, missaoWebConvidada, type EstadoMissaoWeb } from "@/lib/missao-web";
import {
  BUMP_KIT, DOWNSELL_PRA_SEMPRE_27, LINHA_RENOVACAO, PLANOS, PRECO_KIT, UPSELL_PRA_SEMPRE, VALOR_OFERTA, dataCurta, fimDoAcesso,
  ofertaDoPlano, preco, temKit, type OfertaHoje, type PlanoHoje,
} from "@/pages/hoje/conteudo";
import { PixHoje, PixIcone, venceEm, type PixSalvo } from "@/pages/hoje/PixHoje";
import { TelaUpsell, proximoPosCompra, type EtapaHoje } from "@/pages/hoje/FunilHoje";
import { Confete, SeloPago } from "@/pages/hoje/UpsellAnimado";
import {
  EMAIL_OK, emailAtual, gravarAtribuicao, gravarKit, pedirBoasVindas, salvarEmailDaCompra, sessaoViva, trazerCompraParaConta,
} from "@/pages/hoje/conta";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { lerAtribuicao } from "@/pages/porta/atribuicao";
import { eventoMeta, novoEventId } from "@/pages/venda/rastreio";
import { vigiarStorage } from "./seguranca";
import "@/pages/hoje/funil-hoje.css";
import "./missao.css";

/**
 * A CAMADA DO FUNIL DA MISSÃO (18/10) — montada no App, só faz algo com o convidado da missão ativo.
 *
 *   1. mede: o tutorial apareceu (missao_web_tutorial), a dose 1 (missao_web_dose1) e a festa "Dia 1 de 3"
 *      (missao_web_festa — o "aha");
 *   2. a OFERTA cobre o app:
 *        · depois que a festa fecha ("Continuar");
 *        · ou ela pulou a dose ("Pular" / "Ainda não gastei");
 *        · ou PAROU: 3 min sem tocar em nada no tutorial, ou tocou em "voltar" (o navegador/o gesto) antes da festa;
 *      o recibo do que ela fez + anual 27,90 (1º ano) × mensal 14,90 + o kit → Pix REAL na página (Asaas, as MESMAS
 *      ofertas do /hoje; a venda se separa pelo source_url = a URL do /missao) → upsells (pra sempre 47 → 27) →
 *      e-mail (a conta anônima do Pix ganha o e-mail; e-mail que já tem conta → código → a compra E os dados do dia 1
 *      vão pra ela, no servidor: pix-vincular) → "Seu CORE está salvo" com as lojas (App Store/Google Play + "entre
 *      com este e-mail") → "Continuar minha missão": a camada some e o app segue de onde parou.
 *   Paywall ENXUTO (dono, 18/10): sem o "CORE" do topo e sem "Ver o que fiz" — o recibo já mostra o que ela fez, e a
 *   trava é dura (a dose 2 e o resto só depois de ativar). Ver o relatório do funil.
 *
 * Dados: até pagar, tudo mora no guest:* (useUserData). "Pagar com Pix" abre a sessão anônima (pages/hoje/conta) e o
 * useUserData migra os guest:* pra ela sozinho. A cópia de segurança do storage (./seguranca) roda enquanto a camada
 * está montada.
 *
 * QA (só no servidor de desenvolvimento): `?missao-simular=1` simula o Pix (nada vai pra Asaas nem pro banco).
 */
type Etapa = "oferta" | "pix" | EtapaHoje | "pronto";
type Variante = "feito" | "pulou" | "parou";

const evento = (nome: string, dados: Record<string, unknown> = {}) => {
  const w = lerMissaoWeb();
  const d = { ...dados, area: w?.area ?? null, missao_session_id: w?.sessao ?? null };
  try { (window as unknown as { __eventosMissao?: unknown[] }).__eventosMissao?.push({ nome, ...d, t: Math.round(performance.now()) }); } catch { /* noop */ }
  trackEvent(nome, d);
};

/** O Pix simulado: SÓ no servidor de desenvolvimento, com `?missao-simular=1` (prints/vídeo). O build nunca simula. */
const CHAVE_SIMULAR = "missao-simular";
function simularPix(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const v = new URLSearchParams(window.location.search).get(CHAVE_SIMULAR);
    if (v === "1" || v === "0") localStorage.setItem(CHAVE_SIMULAR, v);
    return localStorage.getItem(CHAVE_SIMULAR) === "1";
  } catch { return false; }
}

/** Os planos/upsells pagos: a assinatura muda AGORA — o useAuth relê no "focus" (como na volta do app do banco). */
const relerAssinatura = () => { try { window.dispatchEvent(new Event("focus")); } catch { /* noop */ } };

const TUTORIAL_NA_TELA = "html[data-montar-financas], html[data-montar-rotina], html[data-missao-dose], [data-testid='missao-doses-festa'], [data-testid='missao-doses-passo']";
/** Parada no tutorial sem chegar na festa → a oferta entra. */
export const PARADA_MS = 3 * 60_000;

export function FunilMissaoCamada() {
  const [ativa, setAtiva] = useState(() => missaoWebConvidada());
  useEffect(() => {
    const reler = () => setAtiva(missaoWebConvidada());
    window.addEventListener(EVENTO_MISSAO_WEB, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_WEB, reler);
  }, []);
  return ativa ? <Camada /> : null;
}

function Camada() {
  const navigate = useNavigate();
  const [web, setWeb] = useState<EstadoMissaoWeb | null>(() => lerMissaoWeb());
  const [missao, setMissao] = useState<EstadoMissaoDoses | null>(() => lerMissao());
  const [festaFechou, setFestaFechou] = useState(false);
  const [tutorialNaTela, setTutorialNaTela] = useState(() => document.documentElement.hasAttribute("data-missao-tutorial"));

  useEffect(() => {
    const reler = () => { setMissao(lerMissao()); setWeb(lerMissaoWeb()); };
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    window.addEventListener(EVENTO_MISSAO_WEB, reler);
    return () => { window.removeEventListener(EVENTO_MISSAO_DOSES, reler); window.removeEventListener(EVENTO_MISSAO_WEB, reler); };
  }, []);

  /* a cópia de segurança do storage (o Instagram zera com a página viva) */
  useEffect(() => vigiarStorage(), []);

  /* a MESMA animação em todo passo do tutorial: marca o <html> e reinicia a entrada do corpo da folha quando o passo
     (data-etapa da folha do Montar) muda — sem tocar no componente do app */
  useEffect(() => {
    document.documentElement.setAttribute("data-funil-missao", "1");
    const obs = new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        if (m.attributeName !== "data-etapa" || !(el.classList.contains("mf") || el.classList.contains("mrt"))) continue;
        const corpo = el.querySelector<HTMLElement>(".mf-corpo, .mrt-corpo");
        if (!corpo) continue;
        corpo.style.animation = "none"; void corpo.offsetWidth; corpo.style.animation = "";
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-etapa"], subtree: true });
    return () => { obs.disconnect(); document.documentElement.removeAttribute("data-funil-missao"); };
  }, []);

  /* o tutorial apareceu (1x): é o "app aberto" do funil — e a marca que o HTML leve e a medição esperam */
  useEffect(() => {
    const olhar = () => {
      const marcado = document.documentElement.hasAttribute("data-missao-tutorial"); // o HTML leve pode ter marcado antes
      if (!marcado && !document.querySelector(TUTORIAL_NA_TELA)) return false;
      if (!marcado) document.documentElement.setAttribute("data-missao-tutorial", "1");
      setTutorialNaTela(true);
      const w = lerMissaoWeb();
      if (w && !w.tutorial) {
        gravarMissaoWeb({ ...w, tutorial: Date.now() });
        evento("missao_web_tutorial", { rota: window.location.pathname, ms: Math.round(performance.now()) });
      }
      return true;
    };
    if (olhar()) return;
    const obs = new MutationObserver(() => { if (olhar()) obs.disconnect(); });
    obs.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  /* dose 1 feita (o "aha") */
  const dose1 = !!missao?.feitos[1];
  useEffect(() => {
    const w = lerMissaoWeb();
    if (!dose1 || !w || w.dose1) return;
    gravarMissaoWeb({ ...w, dose1: Date.now() });
    evento("missao_web_dose1", { modulo: missao?.modulos[0], rotulo: missao?.feitos[1]?.rotulo ?? null, segundos: Math.round((Date.now() - w.em) / 1000) });
  }, [dose1, missao]);

  /* a festa fechou? (a oferta entra DEPOIS do "Continuar", nunca por cima da comemoração) */
  useEffect(() => {
    if (!dose1 || festaFechou) return;
    const t = window.setInterval(() => {
      const festa = document.querySelector("[data-testid='missao-doses-festa']");
      const w = lerMissaoWeb();
      if (festa && w && !w.festa) {
        const texto = (festa.querySelector("[data-testid='missao-doses-festa-texto']")?.textContent ?? "").trim();
        gravarMissaoWeb({ ...w, festa: { em: Date.now(), texto } });
        evento("missao_web_festa", { segundos: Math.round((Date.now() - w.em) / 1000) });
      }
      const naTela = !!festa || document.documentElement.hasAttribute("data-missao-dose");
      if (!naTela) setFestaFechou(true);
    }, 250);
    return () => window.clearInterval(t);
  }, [dose1, festaFechou]);

  // pulou a dose ("Pular" no Montar / "Ainda não gastei") também chega na oferta — sem o recibo de "feito"
  const pulou = !dose1 && !!missao?.pulados?.[1];
  const parou = !dose1 && !pulou && !!web?.parou;

  /* TEMPO-LIMITE: parada no tutorial sem chegar na festa (3 min sem tocar em nada) ou "voltar" → a oferta */
  const vigiaParada = tutorialNaTela && !dose1 && !pulou && !parou && !web?.pago;
  useEffect(() => {
    if (!vigiaParada) return;
    let timer = 0;
    const parar = (via: "tempo" | "saida") => {
      const w = lerMissaoWeb();
      if (!w || w.parou || w.pago) return;
      gravarMissaoWeb({ ...w, parou: { em: Date.now(), via } });
      evento("missao_web_parou", { via, segundos: Math.round((Date.now() - w.em) / 1000), rota: window.location.pathname });
    };
    const jaDispensou = !!lerMissaoWeb()?.parouDispensou; // escolheu terminar o dia 1: o relógio não volta (o "voltar" sim)
    const armar = () => { if (jaDispensou) return; window.clearTimeout(timer); timer = window.setTimeout(() => parar("tempo"), PARADA_MS); };
    const mexeu = () => armar();
    // "voltar" (botão/gesto do navegador): a entrada anterior do histórico é o /missao (o app montou com replaceState
    // em cima da tela 2) — voltar pra lá é sair do tutorial: a oferta entra e a rota /missao devolve pro módulo
    const voltou = () => { if (window.location.pathname.startsWith("/missao")) parar("saida"); };
    armar();
    const opcoes = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", mexeu, opcoes);
    window.addEventListener("keydown", mexeu, opcoes);
    window.addEventListener("scroll", mexeu, opcoes);
    window.addEventListener("popstate", voltou);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", mexeu, opcoes);
      window.removeEventListener("keydown", mexeu, opcoes);
      window.removeEventListener("scroll", mexeu, opcoes);
      window.removeEventListener("popstate", voltou);
    };
  }, [vigiaParada]);

  const pagou = !!web?.pago;
  const terminou = pagou && !!web?.continuou;
  if (!(dose1 && festaFechou) && !pulou && !parou) return null;
  if (terminou) return null;
  const variante: Variante = dose1 ? "feito" : pulou ? "pulou" : "parou";

  return (
    <div className="mo-camada">
      <OfertaMissao
        missao={missao!}
        variante={variante}
        onFim={() => {
          evento("missao_web_continuar", { variante });
          const w = lerMissaoWeb();
          if (w) gravarMissaoWeb({ ...w, continuou: Date.now() });
          // fez a dose 1: a missão segue pela Home (plano de amanhã, tour); parou no meio: volta pro tutorial onde estava
          if (dose1 && window.location.pathname !== "/home") navigate("/home");
          else if (!dose1) { const rota = MODULOS[missao!.modulos[0]].rota; if (window.location.pathname !== rota) navigate(rota, { replace: true }); }
        }}
      />
    </div>
  );
}

/* ───────────────────────── a oferta (o /hoje, depois do aha) ───────────────────────── */

type Pago = { oferta: OfertaHoje; orderId: string; em: number };
type EstadoOferta = {
  etapa: Etapa; plano: PlanoHoje; kit: boolean; pix: PixSalvo | null; anteriores: PixSalvo[]; pagos: Pago[]; recusou: OfertaHoje[];
  emailPix?: { email: string; via: "conta" | "destino" } | null; vc?: boolean;
};
/** No localStorage (sobrevive a fechar o navegador do Instagram e abrir o link de novo: o Pix que ela copiou continua). */
export const CHAVE_OFERTA = "missao-web-oferta-v1";
const ETAPAS: Etapa[] = ["oferta", "pix", "up1", "up1pix", "down", "downpix", "pago", "pronto"];
let memoriaOferta: EstadoOferta | null = null;
const novaOferta = (): EstadoOferta => ({ etapa: "oferta", plano: "anual", kit: false, pix: null, anteriores: [], pagos: [], recusou: [] });
function lerOferta(): EstadoOferta {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE_OFERTA) || "null") as EstadoOferta | null;
    if (e && ETAPAS.includes(e.etapa)) { memoriaOferta = { ...novaOferta(), ...e }; return memoriaOferta; }
  } catch { /* noop */ }
  return memoriaOferta ?? novaOferta();
}
const gravarOferta = (e: EstadoOferta) => { memoriaOferta = e; try { localStorage.setItem(CHAVE_OFERTA, JSON.stringify(e)); } catch { /* fica o heap */ } };
/** Só testes. */
export const _zerarOferta = (): void => { memoriaOferta = null; };

function OfertaMissao({ missao, variante, onFim }: { missao: EstadoMissaoDoses; variante: Variante; onFim: () => void }) {
  const { get } = useUserData();
  const { user, isSubscribed } = useAuth();
  const [e, setE] = useState<EstadoOferta>(lerOferta);
  const set = useCallback((f: (x: EstadoOferta) => EstadoOferta) => setE((x) => { const n = f(x); gravarOferta(n); return n; }), []);
  const ir = (etapa: Etapa, extra: Partial<EstadoOferta> = {}) => set((x) => ({ ...x, ...extra, etapa }));
  const ids = useCallback(() => { const w = lerMissaoWeb(); return { missao_session_id: w?.sessao ?? null, area: w?.area ?? null, funil: "missao" }; }, []);
  const simular = simularPix();
  const fonteUrl = lerMissaoWeb()?.landing ?? null;
  const corpo = useRef<HTMLDivElement>(null);

  /* vista de cada etapa (+ a oferta: ViewContent no pixel e na CAPI, 1x) */
  useEffect(() => {
    evento(e.etapa === "oferta" ? "missao_web_oferta_view" : "missao_web_etapa", { etapa: e.etapa, variante });
    if (e.etapa === "oferta" && !e.vc) {
      eventoMeta("ViewContent", novoEventId("vc"), { content_name: "missao", content_category: "venda" }, lerAtribuicao()?.fbc || null);
      set((x) => ({ ...x, vc: true }));
    }
    const o: Partial<Record<Etapa, OfertaHoje>> = { up1: "hv47", down: "hv27" };
    if (o[e.etapa]) evento("missao_web_upsell", { oferta: o[e.etapa], acao: "vista" });
    try { corpo.current?.scrollTo({ top: 0 }); } catch { /* jsdom */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  const oferta = ofertaDoPlano(e.plano, e.kit);
  const valor = VALOR_OFERTA[oferta];
  const modulo = missao.modulos[0];
  const cfg = MODULOS[modulo];
  const amanha = MODULOS[missao.modulos[1]];
  const recibo = reciboDoDia(modulo, missao.feitos[1]?.rotulo ?? "", get, lerMissaoWeb()?.festa?.texto ?? "");
  const pagoPlano = e.pagos.find((p) => !["hv47", "hv27", "hc199"].includes(p.oferta)) ?? null;
  const planoPago: PlanoHoje = pagoPlano ? (pagoPlano.oferta.startsWith("h279") ? "anual" : "mensal") : e.plano;
  const acesso = fimDoAcesso(planoPago, e.pagos.map((p) => p.oferta), new Date(pagoPlano?.em ?? Date.now()));
  const acessoTxt = acesso.vitalicio ? "pra sempre" : `até ${dataCurta(acesso.fim)}`;

  const aoPagar = (p: PixSalvo) => {
    const s = memoriaOferta ?? e;
    if (s.pagos.some((x) => x.orderId === p.orderId)) return;
    const pagos = [...s.pagos, { oferta: p.oferta, orderId: p.orderId, em: Date.now() }];
    evento("missao_web_pago", { oferta: p.oferta, valor: VALOR_OFERTA[p.oferta], order_id: p.orderId, simulado: simular });
    if (p.oferta === "hv47" || p.oferta === "hv27") evento("missao_web_upsell", { oferta: p.oferta, acao: "pago" });
    const w = lerMissaoWeb();
    if (w) gravarMissaoWeb({ ...w, pago: { em: w.pago?.em ?? Date.now(), ofertas: pagos.map((x) => x.oferta) } });
    relerAssinatura();
    const prox = proximoPosCompra({ pagos, recusou: s.recusou, parceiro: null }, false);
    set((x) => ({ ...x, pagos, pix: null, anteriores: [], etapa: prox }));
  };
  const pagar = () => {
    evento("missao_web_pagar", { plano: e.plano, kit: e.kit, valor, variante });
    eventoMeta("InitiateCheckout", novoEventId("ic"), {
      value: valor, currency: "BRL", content_name: e.kit && BUMP_KIT ? PLANOS[e.plano].conteudoKit : PLANOS[e.plano].conteudo,
    }, lerAtribuicao()?.fbc || null);
    // trocou de plano/kit depois de gerar um QR: o QR antigo (vivo) entra nos anteriores — ainda pode ser pago
    set((x) => {
      const velho = x.pix && x.pix.oferta !== oferta && venceEm(x.pix) > Date.now() ? [x.pix] : [];
      return { ...x, etapa: "pix", anteriores: [...x.anteriores, ...velho].slice(-3), pix: x.pix && x.pix.oferta === oferta ? x.pix : null };
    });
  };
  const upsell = (o: OfertaHoje, sim: boolean) => {
    evento("missao_web_upsell", { oferta: o, acao: sim ? "aceitou" : "recusou" });
    if (sim) { ir(o === "hv47" ? "up1pix" : "downpix", { pix: null }); return; }
    set((x) => { const recusou = [...new Set([...x.recusou, o])]; return { ...x, recusou, pix: null, etapa: proximoPosCompra({ pagos: x.pagos, recusou, parceiro: null }, false) }; });
  };
  const ultimo = e.pagos[e.pagos.length - 1];
  const confirmado = ultimo ? <div className="fn-confirmado"><Check size={15} strokeWidth={3} />Pagamento confirmado · {preco(VALOR_OFERTA[ultimo.oferta])}</div> : null;
  const total = e.pagos.reduce((s, p) => s + VALOR_OFERTA[p.oferta], 0);
  const praSempre = e.pagos.some((p) => p.oferta === "hv47" || p.oferta === "hv27");

  const sub = variante === "feito"
    ? <>Amanhã vem o dia 2: <b>{amanha.emoji} {amanha.nome}</b>. Ativando, o que você fez fica salvo.</>
    : variante === "pulou"
      ? <>Seu plano de 3 dias começa por <b>{cfg.emoji} {cfg.nome}</b>, no seu ritmo.</>
      : <>Continue de onde parou: <b>{cfg.emoji} {cfg.nome}</b>, dia 1 de 3.</>;
  const jaAssinante = !!user && isSubscribed && !e.pagos.length;

  return (
    <div className={e.etapa === "up1" || e.etapa === "down" || e.etapa === "pago" ? "fn ua" : "fn"} data-testid="missao-oferta" data-etapa={e.etapa} data-variante={variante}>
      <div className="fn-corpo" ref={corpo}>
        {e.etapa === "oferta" && (
          <div className="fn-tela mo-oferta" key="oferta">
            {variante === "feito" && (
              <div className="mo-recibo" data-testid="missao-recibo">
                <div className="mo-recibo-tit"><Check size={14} strokeWidth={3.2} />Dia 1 de 3 feito · {cfg.emoji} {cfg.nome}</div>
                <ul>{recibo.map((t) => <li key={t}><Check size={15} strokeWidth={3} /><span>{t}</span></li>)}</ul>
              </div>
            )}
            <div className="mo-oferta-h1">
              <h1>Ative seu CORE pra continuar</h1>
              <p data-testid="missao-oferta-sub">{sub}</p>
            </div>
            <div className="fn-planos mo-planos" role="radiogroup" aria-label="Plano">
              <button type="button" className="fn-plano" aria-pressed={e.plano === "anual"} data-testid="missao-plano-anual" onClick={() => { evento("missao_web_plano", { plano: "anual" }); set((x) => ({ ...x, plano: "anual" })); }}>
                <span className="fn-plano-selo">MELHOR PREÇO</span>
                <span className="fn-plano-nome">ANUAL<i>{e.plano === "anual" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>27,90</span>
                <span className="fn-plano-sub">1º ano, no Pix</span>
                <span className="fn-plano-mes">R$ 2,33/mês</span>
              </button>
              <button type="button" className="fn-plano" aria-pressed={e.plano === "mensal"} data-testid="missao-plano-mensal" onClick={() => { evento("missao_web_plano", { plano: "mensal" }); set((x) => ({ ...x, plano: "mensal" })); }}>
                <span className="fn-plano-nome">MENSAL<i>{e.plano === "mensal" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>14,90</span>
                <span className="fn-plano-sub">30 dias, no Pix</span>
                <span className="fn-plano-mes" data-cinza="">= R$ 178,80/ano</span>
              </button>
            </div>
            {BUMP_KIT && (
              <button type="button" className="fn-postit mo-postit" aria-pressed={e.kit} data-testid="missao-bump" onClick={() => { const marcado = !e.kit; evento("missao_web_bump", { marcado }); set((x) => ({ ...x, kit: marcado })); }}>
                <span className="fn-caixa">{e.kit && <Check size={15} strokeWidth={3.2} />}</span>
                <span className="fn-postit-txt">
                  <b>+ Kit Primeiro Mês Organizado</b>
                  <span>Plano de 30 dias, planilha de dívidas e os desafios das 4 semanas.</span>
                </span>
                <span className="fn-postit-preco">+ {preco(PRECO_KIT)}</span>
              </button>
            )}
            <div className="fn-rodape mo-rodape">
              {jaAssinante ? (
                <>
                  <p className="fn-ja-tem" data-testid="missao-ja-assinante">Você já tem o CORE ativo nesta conta. Não precisa pagar de novo.</p>
                  <button type="button" className="fn-cta" onClick={onFim}>Continuar minha missão</button>
                </>
              ) : (
                <>
                  <div className="fn-garantia-linha"><ShieldCheck size={15} strokeWidth={2.4} /><span className="mo-garantia-longa">Garantia de 7 dias: não gostou, devolvemos tudo</span><span className="mo-garantia-curta">Garantia de 7 dias · devolvemos tudo</span></div>
                  <button type="button" className="fn-cta" onClick={pagar} data-testid="missao-pagar">
                    <PixIcone /><span>Pagar {preco(valor)} com Pix</span>
                  </button>
                  <p className="fn-renova" data-testid="missao-renovacao">{LINHA_RENOVACAO[e.plano]}</p>
                  {variante === "parou" && (
                    /* parou ANTES do aha: a saída quieta pra terminar o dia 1 (quem chega na festa vê a oferta de novo) */
                    <button type="button" className="fn-link mo-terminar" data-testid="missao-terminar-dia1" onClick={() => {
                      evento("missao_web_parou_voltou");
                      const w = lerMissaoWeb();
                      if (w) gravarMissaoWeb({ ...w, parou: null, parouDispensou: Date.now() });
                    }}><u>Terminar o dia 1 primeiro</u></button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {e.etapa === "pix" && (
          <PixHoje simular={simular} fonteUrl={fonteUrl} oferta={oferta} valor={valor}
            rotulo={`${e.plano === "anual" ? "1º ano do CORE" : "30 dias de CORE"}${e.kit && BUMP_KIT ? " + Kit Primeiro Mês" : ""}`}
            pix={e.pix} anteriores={e.anteriores} onPix={(p) => set((x) => ({ ...x, pix: p }))} onPago={aoPagar} onVoltar={() => ir("oferta")} ids={ids}
            emailSalvo={e.emailPix?.email ?? null} onEmailSalvo={(email, via) => set((x) => ({ ...x, emailPix: { email, via } }))} />
        )}

        {e.etapa === "up1" && UPSELL_PRA_SEMPRE && (
          <TelaUpsell testid="missao-up1" confirmado={confirmado} kicker="Só pra quem acabou de entrar"
            titulo={planoPago === "anual" ? "Troque o 1º ano pelo CORE pra sempre" : "Troque os 30 dias pelo CORE pra sempre"}
            texto="Pague uma vez e nunca mais renove. Tudo que o CORE ganhar daqui pra frente já é seu."
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv47} prefixo="+ " itens={["Acesso vitalício às 16 áreas", "No iPhone, no Android e no computador"]}
            visual="grafico" plano={planoPago} cta={`Quero o CORE pra sempre · ${preco(VALOR_OFERTA.hv47)}`}
            onSim={() => upsell("hv47", true)} onNao={() => upsell("hv47", false)} />
        )}
        {e.etapa === "down" && DOWNSELL_PRA_SEMPRE_27 && (
          <TelaUpsell testid="missao-down" confirmado={confirmado} kicker="Última chance"
            titulo={`O CORE pra sempre por ${preco(VALOR_OFERTA.hv27)} — só agora`}
            texto={`Em vez de ${preco(VALOR_OFERTA.hv47)}, o mesmo acesso pra sempre por ${preco(VALOR_OFERTA.hv27)}. Esta oferta não aparece de novo depois desta tela.`}
            nome="CORE pra sempre" valor={VALOR_OFERTA.hv27} prefixo="+ " riscado={VALOR_OFERTA.hv47}
            itens={["Acesso vitalício às 16 áreas", "Nunca mais renova, nunca mais paga"]} visual="etiqueta"
            cta={`Quero por ${preco(VALOR_OFERTA.hv27)}`} onSim={() => upsell("hv27", true)} onNao={() => upsell("hv27", false)} />
        )}
        {(e.etapa === "up1pix" || e.etapa === "downpix") && (() => {
          const o: OfertaHoje = e.etapa === "up1pix" ? "hv47" : "hv27";
          return <PixHoje simular={simular} fonteUrl={fonteUrl} key={o} oferta={o} valor={VALOR_OFERTA[o]} rotulo="CORE pra sempre" pix={e.pix} onPix={(p) => set((x) => ({ ...x, pix: p }))} onPago={aoPagar} onVoltar={() => ir(o === "hv47" ? "up1" : "down", { pix: null })} ids={ids} />;
        })()}

        {(e.etapa === "pago" || e.etapa === "parceiro" || e.etapa === "up2" || e.etapa === "up2pix" || e.etapa === "pronto") && (
          <TelaPagoMissao
            total={total} praSempre={praSempre} acessoTxt={acessoTxt} modulo={`${cfg.emoji} ${cfg.nome}`} pagos={e.pagos} plano={planoPago}
            emailPix={e.emailPix ?? null} simular={simular} pronto={e.etapa === "pronto"} ids={ids}
            onPronto={() => ir("pronto")} onFim={onFim} />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── depois de pagar: o e-mail → "Seu CORE está salvo" + as lojas ───────────────────────── */

function TelaPagoMissao({ total, praSempre, acessoTxt, modulo, pagos, plano, emailPix, simular, pronto, ids, onPronto, onFim }: {
  total: number; praSempre: boolean; acessoTxt: string; modulo: string; pagos: Pago[]; plano: PlanoHoje;
  emailPix: { email: string; via: "conta" | "destino" } | null; simular: boolean; pronto: boolean;
  ids: () => Record<string, unknown>; onPronto: () => void; onFim: () => void;
}) {
  const { tentarDeNovo } = useUserData();
  const salvo = lerMissaoWeb()?.email ?? null;
  const [email, setEmail] = useState(salvo ?? emailPix?.email ?? "");
  const [fase, setFase] = useState<"form" | "salvando" | "existe">("form");
  const [erro, setErro] = useState<string | null>(null);
  const finalizou = useRef(false);
  const pedidoPlano = pagos.find((p) => !["hv47", "hv27", "hc199"].includes(p.oferta)) ?? null;
  const pedidoKit = pagos.find((p) => temKit(p.oferta)) ?? null;

  /** a conta final está pronta: kit, atribuição, boas-vindas (com as lojas); os dados do dia 1 já estão nela */
  const finalizar = async (emailFinal: string, via: string) => {
    if (finalizou.current) return;
    finalizou.current = true;
    if (!simular) {
      if (pedidoKit) await gravarKit(pedidoKit.orderId);
      const w = lerMissaoWeb();
      await gravarAtribuicao({
        v: 1, funil: "missao", attr: lerAtribuicao(), area: w?.area ?? null, plano, pagos: pagos.map((p) => p.oferta),
        missao_session_id: w?.sessao ?? null, landing: w?.landing ?? null, em: new Date().toISOString(),
      });
      if (pedidoPlano) void pedirBoasVindas(pedidoPlano.orderId);
    }
    const w = lerMissaoWeb();
    if (w) gravarMissaoWeb({ ...w, email: emailFinal });
    evento("missao_web_email", { via });
    onPronto();
  };

  /* já logada com e-mail (pagou na própria conta): não pede nada */
  useEffect(() => {
    if (pronto || salvo || simular) return;
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
    if (simular) { await new Promise((r) => window.setTimeout(r, 500)); await finalizar(email.trim().toLowerCase(), "simulado"); return; }
    const res = await salvarEmailDaCompra(email);
    if (res.ok === true) { await finalizar(email.trim().toLowerCase(), res.via); return; }
    if ("existe" in res) { evento("missao_web_email_existe"); setFase("existe"); return; }
    setErro(res.erro);
    setFase("form");
  };

  /** entrou na conta que já existia: a compra E os dados do dia 1 vêm junto (pix-vincular, no servidor) */
  const entrouComCodigo = async () => {
    const t = await trazerCompraParaConta();
    evento("missao_web_vincular", { r: t });
    relerAssinatura();
    // a leitura da conta pode ter saído ANTES de os dados chegarem nela: lê de novo (agora, em 2 s e em 5 s)
    try { tentarDeNovo?.(); } catch { /* noop */ }
    window.setTimeout(() => { try { tentarDeNovo?.(); } catch { /* noop */ } }, 2000);
    window.setTimeout(() => { try { tentarDeNovo?.(); } catch { /* noop */ } }, 5000);
    await finalizar(email.trim().toLowerCase(), "codigo");
  };

  if (pronto) {
    const em = lerMissaoWeb()?.email ?? email.trim().toLowerCase();
    return (
      <div className="fn-tela" key="pronto" data-testid="missao-pronto">
        <div className="fn-pago fn-pago-curto">
          <div className="fn-pago-ok"><Check size={30} strokeWidth={3.2} /></div>
          <h1>Seu CORE está salvo</h1>
          <p>Entre sempre com <b data-testid="missao-email-final">{em}</b></p>
        </div>
        <LojasDoCore email={em} onde="missao_pos_compra" />
        <div className="fn-rodape">
          <button type="button" className="fn-cta" onClick={onFim} data-testid="missao-continuar"><span>Continuar minha missão</span><ChevronRight size={18} strokeWidth={2.6} /></button>
          <p className="fn-renova">Continua aqui no navegador, de onde você parou. {modulo} · dia 1 salvo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fn-tela" key="pago" data-testid="missao-pago" data-fase={fase}>
      <Confete />
      <div className="fn-pago">
        <SeloPago />
        <h1 className="ua-entra" style={{ animationDelay: ".5s" }}>Pronto! Seu CORE é seu.</h1>
        <p className="ua-entra" style={{ animationDelay: ".65s" }}>{preco(Math.round(total * 100) / 100)} recebido · acesso {acessoTxt}</p>
        {praSempre && <span className="ua-pra-sempre"><Sparkles size={13} strokeWidth={2.6} />CORE pra sempre · nunca mais renova</span>}
      </div>
      <div className="fn-folha fn-salvo ua-entra" style={{ animationDelay: ".85s" }}>
        <div className="fn-faixa-sec">Dia 1 salvo · {modulo}</div>
        {fase !== "existe" ? (
          <div className="fn-email">
            <label htmlFor="missao-email">Seu e-mail, pra salvar seu CORE</label>
            <input id="missao-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
              value={email} onChange={(ev) => setEmail(ev.target.value)} data-testid="missao-email" />
            {erro ? <p className="fn-erro" role="alert">{erro}</p> : <p>É com ele que você entra no app do celular e no computador. Sem senha.</p>}
          </div>
        ) : (
          <div className="fn-email" data-testid="missao-existe">
            <label>Esse e-mail já tem conta no CORE</label>
            <p style={{ marginTop: 0 }}>Confirme que é você com o código que vamos mandar pra <b>{email.trim().toLowerCase()}</b>. Sua compra e o que você fez hoje vão pra essa conta.</p>
            <EntrarComCodigo email={email} funil="missao_ja_tem_conta" rotulo="Receber código no e-mail" onSession={() => { void entrouComCodigo(); }} className="fn-codigo-email" />
            <button type="button" className="fn-link" onClick={() => setFase("form")}>Usar outro e-mail</button>
          </div>
        )}
      </div>
      {fase !== "existe" && (
        <div className="fn-rodape">
          <button type="button" className="fn-cta" disabled={!EMAIL_OK.test(email.trim()) || fase === "salvando"} onClick={() => { void salvar(); }} data-testid="missao-salvar-email">
            <span>{fase === "salvando" ? "Salvando…" : "Salvar e continuar"}</span>{fase !== "salvando" && <ChevronRight size={18} strokeWidth={2.6} />}
          </button>
        </div>
      )}
    </div>
  );
}

/** O bloco "Seu CORE também no celular" do /hoje: os selos oficiais (App Store / Google Play) + "entre com este e-mail". */
export function LojasDoCore({ email, onde }: { email: string | null; onde: string }) {
  return (
    <div className="fn-lojas" data-testid="missao-lojas">
      <div className="fn-lojas-titulo">Seu CORE também no celular</div>
      <p>O CORE é um app da <b>App Store</b> e da <b>Google Play</b>. Baixe e entre com este e-mail:</p>
      {email ? <div className="fn-email-chip">{email}</div> : null}
      <SelosDasLojas onde={onde} prefixo="web" altura={44} className="fn-selos" />
      <p className="fn-lojas-dica">No app: toque em <b>Entrar</b> → <b>Entrar sem senha</b> e use o código que chega no e-mail.</p>
    </div>
  );
}

/** O recibo do dia 1, com o que ela fez de verdade (lido do guest:* pelo useUserData). */
export function reciboDoDia(modulo: string, rotuloDoMontar: string, get: <T>(k: string, f: T) => T, textoDaFesta: string): string[] {
  // o número da FESTA (depois do 1º gasto) vence o do Montar (antes dele): "Pode gastar R$ 131 por dia"
  const porDia = textoDaFesta.match(/R\$\s?[\d.]+ por dia/)?.[0];
  const rotulo = modulo === "financas" && porDia ? `Pode gastar ${porDia}` : rotuloDoMontar;
  const n = (k: string) => { try { const v = get<unknown>(k, []); return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : 0; } catch { return 0; } };
  const linhas: string[] = [];
  if (modulo === "financas") {
    if (n("finance-incomes") || n("finance-fixed-expenses")) linhas.push(`Renda e ${n("finance-fixed-expenses") || "as"} contas do mês montadas`);
    if (rotulo) linhas.push(rotulo);
    if (n("finance-expenses")) linhas.push("1º gasto anotado");
  } else if (modulo === "rotina") {
    if (n("rotina-habits")) linhas.push(`Rotina montada · ${n("rotina-habits")} hábitos`);
    if (rotulo) linhas.push(`1º marcado hoje: ${rotulo}`);
  } else if (modulo === "treino") {
    linhas.push("Treino da semana escolhido");
    if (rotulo) linhas.push(rotulo);
  } else {
    if (rotulo) linhas.push(rotulo);
    else linhas.push("1ª meta escrita");
  }
  return linhas.length ? linhas : ["Primeiro passo feito"];
}

export default FunilMissaoCamada;
