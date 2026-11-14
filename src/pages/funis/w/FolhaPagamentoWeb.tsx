/**
 * A FOLHA DE PAGAMENTO do paywall do app na web (14/11, /funil-app) — sobe POR CIMA do paywall, na mesma tela (sem página
 * de checkout). Decisões do dono (14/11): e-mail (1 campo, antes de pagar) + abas Pix | Cartão, tudo pela STRIPE.
 *
 *   vitalício R$ 97,90  Pix (marcado) ou cartão em até 3x. Pix: "Gerar Pix" → QR + copia e cola NA FOLHA; a tela confere
 *                       sozinha (stripe-status a cada 3 s e na volta pra aba). Cartão: o campo da Stripe + 1x/2x/3x.
 *   mensal R$ 34,90     SÓ cartão (assinatura). A folha abre no Cartão, com o link "Prefere Pix? Vitalício por R$ 97,90".
 *   trava (2×)          a ref do pedido mora no aparelho (lib/stripe-app-web): fechar/reabrir = o MESMO Pix; pagar no cartão
 *                       com um Pix vivo faz o SERVIDOR cancelar o Pix antes de cobrar (se ele já tinha caído → "pago").
 *   pago                Purchase no pixel (eventID = id do PI; no mensal, id da assinatura — o mesmo event_id da CAPI do
 *                       stripe-webhook), "Pagamento confirmado" ~1 s e o pós-compra (senha → lojas).
 *
 * Eventos (funil "app_web"; nunca e-mail, nunca dado de cartão): appweb_folha_aberta, appweb_email_ok, appweb_metodo,
 * appweb_parcelas, appweb_pagar, appweb_pix_gerado, appweb_pix_copiado, appweb_pago, appweb_cartao_recusado,
 * appweb_parcelas_indisponiveis, appweb_erro {etapa}, appweb_folha_fechada {fase}.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { garantirSessao } from "@/lib/sessao-anonima";
import { EMAIL_OK, sugestaoDeEmail } from "@/landing/regras";
import { JORNADA_APP_WEB, PARCELAS_MAX, PRECO_MENSAL_CENTAVOS, PRECO_VITALICIO_CENTAVOS, reaisDe } from "@/lib/funil-app-web";
import {
  api, aparenciaStripe, carregarStripe, emProducao, gravarPedido, lerCookie, lerPedido, pedidoNovo, valorDoPlano,
  type Elementos, type ElementoCartao, type Metodo, type Pedido, type Plano, type RespostaAcao, type StripeLike,
} from "@/lib/stripe-app-web";

const F = { funil: JORNADA_APP_WEB };
/** "3x sem juros" na tela: DESLIGADO até o dono decidir (ver LEIA.md — quem paga a taxa do parcelamento na Stripe Brasil) */
export const SEM_JUROS_NA_TELA = false;
const ATRIB = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl"];
const parcelaDe = (n: number) => reaisDe(Math.round(PRECO_VITALICIO_CENTAVOS / n));
const MSG_RECUSADO = "O banco recusou este cartão. Tente outro cartão";

function sessaoDaAba(): string {
  try { let s = sessionStorage.getItem("core-appweb-sessao"); if (!s) { s = crypto.randomUUID(); sessionStorage.setItem("core-appweb-sessao", s); } return s; } catch { return "s"; }
}

export function FolhaPagamentoWeb({ plano, onPlano, onFechar, onPago, voltaDoBanco }: {
  plano: Plano; onPlano: (p: Plano) => void; onFechar: () => void; onPago: () => void;
  voltaDoBanco?: { pi: string; status: string } | null;
}) {
  const [pedido, setPedidoCru] = useState<Pedido>(() => {
    const p = lerPedido();
    if (p && p.fase !== "pago") return gravarPedido({ ...p, plano, metodo: plano === "mensal" ? "card" : p.metodo });
    return gravarPedido(pedidoNovo(plano));
  });
  const pedidoRef = useRef(pedido); pedidoRef.current = pedido;
  const setPedido = useCallback((mudar: (p: Pedido) => Pedido) => { setPedidoCru((p) => gravarPedido(mudar(p))); }, []);
  const [email, setEmail] = useState(pedido.email);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [fase, setFase] = useState<"form" | "pix" | "confirmando" | "pago">(() => (voltaDoBanco ? "confirmando" : pedido.fase === "pix" && pedido.pix ? "pix" : "form"));
  const [copiado, setCopiado] = useState(false);
  const [parcelas, setParcelas] = useState(pedido.parcelas || 1);
  const [maxParcelas, setMaxParcelas] = useState(PARCELAS_MAX);
  const mensal = plano === "mensal";
  const metodo: Metodo = mensal ? "card" : pedido.metodo;
  const valor = valorDoPlano(plano);

  /* ── o campo do cartão (Stripe) — montado uma vez, escondido quando o Pix está marcado ── */
  const caixaCartao = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<StripeLike | null>(null);
  const elementosRef = useRef<Elementos | null>(null);
  const elementoRef = useRef<ElementoCartao | null>(null);
  const [cartaoPronto, setCartaoPronto] = useState(false);
  const [cartaoFalhou, setCartaoFalhou] = useState(false);
  const montarCartao = useCallback(async () => {
    if (elementoRef.current || !caixaCartao.current) return;
    setCartaoFalhou(false);
    try {
      const s = await carregarStripe();
      if (!caixaCartao.current || elementoRef.current) return;
      stripeRef.current = s;
      const els = s.elements({ mode: "payment", amount: PRECO_VITALICIO_CENTAVOS, currency: "brl", paymentMethodCreation: "manual", paymentMethodTypes: ["card"], locale: "pt-BR", appearance: aparenciaStripe });
      elementosRef.current = els;
      const pe = els.create("payment", { layout: { type: "tabs" }, fields: { billingDetails: { email: "never", address: "if_required" } }, wallets: { applePay: "never", googlePay: "never", link: "never" } });
      elementoRef.current = pe;
      pe.on("ready", () => setCartaoPronto(true));
      pe.on("loaderror", () => { setCartaoFalhou(true); trackEvent("appweb_erro", { ...F, etapa: "cartao_carregar" }); });
      pe.mount(caixaCartao.current);
    } catch {
      setCartaoFalhou(true);
      trackEvent("appweb_erro", { ...F, etapa: "stripe_js" });
    }
  }, []);
  useEffect(() => { if (metodo === "card" && fase === "form") void montarCartao(); }, [metodo, fase, montarCartao]);
  useEffect(() => () => { try { elementoRef.current?.destroy?.(); } catch { /* já saiu */ } }, []);

  /* ── abrir: 1 evento + InitiateCheckout 1× por pedido ── */
  useEffect(() => {
    trackEvent("appweb_folha_aberta", { ...F, plano, fase, retomada: pedido.fase === "pix" || !!voltaDoBanco });
    const chave = `core-appweb-ic-${pedido.ref}`;
    let jaFoi = false; try { jaFoi = sessionStorage.getItem(chave) === "1"; sessionStorage.setItem(chave, "1"); } catch { /* noop */ }
    if (!jaFoi && emProducao()) fireMetaEvent("InitiateCheckout", { value: valor / 100, currency: "BRL", content_name: `appweb_${plano}` }, `ic-${pedido.ref}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── pago (1× por pedido): evento + Purchase com o MESMO id da CAPI ── */
  const concluir = useCallback((r: { metodo: Metodo; plano: Plano; pi?: string | null; sub?: string | null; parcelas?: number }) => {
    const p = pedidoRef.current;
    if (p.fase === "pago") { setFase("pago"); return; }
    const v = valorDoPlano(r.plano);
    const idCompra = r.plano === "mensal" ? (r.sub ?? p.sub) : (r.pi ?? p.pi);
    trackEvent("appweb_pago", { ...F, metodo: r.metodo, plano: r.plano, parcelas: r.parcelas ?? 1, valor_cents: v, pi: r.pi ?? p.pi ?? null, sub: r.sub ?? null });
    if (idCompra && !p.purchaseFeito && emProducao()) fireMetaEvent("Purchase", { value: v / 100, currency: "BRL", content_name: r.plano === "mensal" ? "appweb_mensal" : "appweb_vitalicio" }, idCompra);
    setPedido((x) => ({ ...x, fase: "pago", plano: r.plano, metodo: r.metodo, pi: r.pi ?? x.pi, sub: r.sub ?? x.sub, pix: null, valor: v, purchaseFeito: true }));
    setFase("pago");
    window.setTimeout(() => onPago(), 1100);
  }, [onPago, setPedido]);

  /* ── conferir o pagamento (Pix vivo / volta do banco): a cada 3 s e na volta pra aba ── */
  const conferir = useCallback(async () => {
    const p = pedidoRef.current;
    if (!p.pi || p.fase === "pago") return;
    const r = await api().status({ ref: p.ref, pi: p.pi }).catch(() => null);
    if (r?.pago) concluir({ metodo: r.metodo === "card" ? "card" : "pix", plano: p.plano === "mensal" && r.metodo === "card" ? "mensal" : (p.metodo === "pix" ? "vitalicio" : p.plano), pi: p.pi, sub: p.sub });
  }, [concluir]);
  // o Pix vivo segue pagável mesmo com a aba Cartão aberta: a conferência continua enquanto o pedido estiver no Pix
  const conferindo = fase === "pix" || fase === "confirmando" || pedido.fase === "pix";
  useEffect(() => {
    if (!conferindo) return;
    const t = window.setInterval(() => { void conferir(); }, 3000);
    const aoVoltar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    void conferir();
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [conferindo, conferir]);

  /* ── volta do banco (3DS com redirecionamento) ── */
  useEffect(() => {
    if (!voltaDoBanco) return;
    setPedido((x) => ({ ...x, pi: voltaDoBanco.pi }));
    if (voltaDoBanco.status === "failed") { setFase("form"); setErro(`O banco não aprovou. ${MSG_RECUSADO}${mensal ? "." : " ou pague no Pix."}`); trackEvent("appweb_cartao_recusado", { ...F, plano, code: "3ds_falhou" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── o corpo comum (sinais da Meta e atribuição; o preço NUNCA vai daqui) ── */
  const corpo = (acao: "pix" | "cartao" | "assinar", extra: Record<string, unknown> = {}) => {
    const a = getAttributionParams();
    const atrib: Record<string, string> = {};
    for (const k of ATRIB) if (typeof a[k] === "string" && a[k]) atrib[k] = String(a[k]).slice(0, 200);
    let device: string | null = null; try { device = localStorage.getItem("core-device-id"); } catch { /* noop */ }
    return {
      acao, ref: pedidoRef.current.ref, email: email.trim().toLowerCase(), pagina: "app_web",
      fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc"), fbclid: a.fbclid ?? null, url: window.location.href.slice(0, 500),
      landing_session_id: sessaoDaAba(), landing_device_id: device, atrib, ...extra,
    };
  };

  const validarEmail = (): string | null => {
    const e = email.trim().toLowerCase();
    if (!e) { setErroEmail("Coloque seu e-mail: é por ele que você entra no CORE."); return null; }
    if (!EMAIL_OK.test(e) || e.length > 254) { setErroEmail("Esse e-mail parece errado. Confere?"); return null; }
    setErroEmail(null);
    if (pedidoRef.current.email !== e) { setPedido((x) => ({ ...x, email: e })); trackEvent("appweb_email_ok", { ...F, plano }); }
    return e;
  };

  /** a sessão (anônima, se preciso) que vira dona da compra — sem ela o servidor acha/cria a conta pelo e-mail */
  const comSessao = async () => { try { await garantirSessao(); } catch { /* o webhook acha pelo e-mail */ } };

  const tratarResposta = async (r: RespostaAcao, m: Metodo) => {
    if (r.pago) return concluir({ metodo: (r.metodo as Metodo) ?? m, plano: r.plano ?? plano, pi: r.pi ?? null, sub: r.sub ?? null, parcelas });
    if (r.pix && (r.pix.data || r.pix.image_url_png)) {
      setPedido((x) => ({ ...x, fase: "pix", pi: r.pi ?? x.pi, pix: r.pix ?? null, metodo: "pix", plano: "vitalicio" }));
      setFase("pix");
      trackEvent("appweb_pix_gerado", { ...F, mesmo: !!r.mesmo, pi: r.pi ?? null });
      return;
    }
    if (r.acao && r.client_secret && stripeRef.current) {
      setPedido((x) => ({ ...x, pi: r.pi ?? x.pi, sub: r.sub ?? x.sub }));
      const a = await stripeRef.current.handleNextAction({ clientSecret: r.client_secret });
      if (a.error) { setErro(a.error.message ?? `${MSG_RECUSADO}.`); trackEvent("appweb_cartao_recusado", { ...F, plano, code: String(a.error.code ?? "3ds").slice(0, 40) }); return; }
      if (a.paymentIntent?.status === "succeeded") return concluir({ metodo: "card", plano, pi: r.pi ?? null, sub: r.sub ?? null, parcelas });
      setFase("confirmando");
      return;
    }
    if (r.processando) { setPedido((x) => ({ ...x, pi: r.pi ?? x.pi, sub: r.sub ?? x.sub })); setFase("confirmando"); return; }
    if (r.recusado) {
      setErro(`${MSG_RECUSADO}${mensal ? "." : " ou pague no Pix."}`);
      trackEvent("appweb_cartao_recusado", { ...F, plano, code: String(r.code ?? "").slice(0, 40) });
      return;
    }
    if (r.erro === "parcelas_indisponiveis") {
      const max = Math.max(1, Math.min(PARCELAS_MAX, Number(r.max) || 1));
      setMaxParcelas(max); setParcelas(1);
      setErro(max > 1 ? `Este cartão parcela em até ${max}x. Escolha de novo.` : "Este cartão não parcela. Pague à vista ou use outro cartão.");
      trackEvent("appweb_parcelas_indisponiveis", { ...F, pediu: parcelas, max });
      return;
    }
    if (r.erro === "pix_vivo") { setErro("Seu Pix ainda está valendo. Pague o Pix ou espere uns segundos e tente de novo."); trackEvent("appweb_erro", { ...F, etapa: "pix_vivo" }); return; }
    if (r.erro === "mensal_indisponivel") { setErro("O mensal não está disponível agora. O vitalício segue valendo."); trackEvent("appweb_erro", { ...F, etapa: "mensal_indisponivel" }); return; }
    setErro("Não deu pra concluir agora. Tente de novo em instantes.");
    trackEvent("appweb_erro", { ...F, etapa: m === "pix" ? "pix" : "cartao", code: String(r.code ?? r.erro ?? "").slice(0, 40) });
  };

  const gerarPix = async () => {
    if (pagando) return;
    const e = validarEmail(); if (!e) return;
    setPagando(true); setErro(null);
    trackEvent("appweb_pagar", { ...F, metodo: "pix", plano: "vitalicio" });
    try {
      await comSessao();
      const r = await api().acao(corpo("pix"));
      await tratarResposta(r, "pix");
    } catch { setErro("Não deu pra gerar o Pix. Tente de novo."); trackEvent("appweb_erro", { ...F, etapa: "pix_excecao" }); }
    finally { setPagando(false); }
  };

  const pagarCartao = async () => {
    if (pagando) return;
    const e = validarEmail(); if (!e) return;
    const s = stripeRef.current, els = elementosRef.current;
    if (!s || !els || !cartaoPronto) { setErro("O cartão ainda está carregando. Tente de novo em instantes."); return; }
    setPagando(true); setErro(null);
    trackEvent("appweb_pagar", { ...F, metodo: "card", plano, parcelas: mensal ? 1 : parcelas });
    try {
      const sub = await els.submit();
      if (sub.error) { setErro(sub.error.message ?? "Confira os dados do cartão."); return; }
      const [, criado] = await Promise.all([comSessao(), s.createPaymentMethod({ elements: els, params: { billing_details: { email: e } } })]);
      if (criado.error || !criado.paymentMethod) { setErro(criado.error?.message ?? "Confira os dados do cartão."); return; }
      const r = await api().acao(mensal ? corpo("assinar", { pm: criado.paymentMethod.id }) : corpo("cartao", { pm: criado.paymentMethod.id, parcelas }));
      await tratarResposta(r, "card");
    } catch { setErro("Não deu pra concluir agora. Tente de novo em instantes."); trackEvent("appweb_erro", { ...F, etapa: "cartao_excecao" }); }
    finally { setPagando(false); }
  };

  const escolherMetodo = (m: Metodo) => {
    if (mensal || m === metodo || pagando) return;
    setErro(null);
    setPedido((x) => ({ ...x, metodo: m }));
    trackEvent("appweb_metodo", { ...F, metodo: m, via: "toque", pix_vivo: fase === "pix" });
    if (fase === "pix" && m === "card") setFase("form"); // o Pix continua salvo; o servidor cancela ele se o cartão for pago
    if (m === "pix" && pedido.fase === "pix" && pedido.pix) setFase("pix"); // voltou pro Pix vivo: o MESMO QR
  };
  const voltarProPix = () => { setPedido((x) => ({ ...x, metodo: "pix" })); setFase("pix"); };

  const fechar = () => { trackEvent("appweb_folha_fechada", { ...F, fase, plano, metodo }); onFechar(); };

  const copiar = async () => {
    const codigo = pedido.pix?.data ?? "";
    let ok = false;
    try { await navigator.clipboard.writeText(codigo); ok = true; } catch { ok = false; }
    setCopiado(ok);
    trackEvent("appweb_pix_copiado", { ...F, ok });
  };

  const titulo = mensal ? `CORE mensal · ${reaisDe(PRECO_MENSAL_CENTAVOS)}/mês` : `CORE vitalício · ${reaisDe(PRECO_VITALICIO_CENTAVOS)}`;
  const sugestao = sugestaoDeEmail(email);
  const vence = pedido.pix?.expires_at ? new Date(pedido.pix.expires_at * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/40 text-left" role="dialog" aria-modal="true" aria-labelledby="appweb-folha-titulo" data-testid="appweb-folha">
      <div className="mt-auto max-h-[100dvh] h-[100dvh] sm:h-auto w-full bg-white text-[#16121c] flex flex-col animate-in slide-in-from-bottom duration-200">
        <div className="flex-none flex items-center justify-between gap-2 h-[52px] px-2 border-b border-black/10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <button type="button" onClick={fechar} className="h-11 px-2 inline-flex items-center gap-1 text-[14px] font-semibold" aria-label="Voltar" data-testid="appweb-folha-voltar">
            <ArrowLeft className="w-5 h-5" /> Voltar
          </button>
          <span className="inline-flex items-center gap-1.5 pr-3 text-[12.5px] font-semibold text-black/55"><Lock className="w-3.5 h-3.5" /> Pagamento seguro</span>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <div className="max-w-sm mx-auto">
            {fase === "pago" ? (
              <div className="text-center pt-10" data-testid="appweb-pago">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#16a34a] text-white grid place-items-center shadow-[0_0_0_10px_#ecfdf3]"><Check className="w-8 h-8" strokeWidth={3} /></div>
                <h2 id="appweb-folha-titulo" className="mt-5 text-[22px] font-extrabold tracking-tight">Pagamento confirmado</h2>
                <p className="mt-1.5 text-[14px] text-black/55">Liberando seu CORE…</p>
              </div>
            ) : fase === "confirmando" ? (
              <div className="text-center pt-10" data-testid="appweb-confirmando">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-black/40" />
                <h2 id="appweb-folha-titulo" className="mt-4 text-[20px] font-extrabold tracking-tight">Confirmando o pagamento…</h2>
                <p className="mt-1.5 text-[14px] text-black/55">Não feche esta tela. O acesso também chega no seu e-mail.</p>
              </div>
            ) : (
              <>
                <h2 id="appweb-folha-titulo" className="text-[19px] font-extrabold tracking-tight" data-testid="appweb-folha-titulo">{titulo}</h2>
                {mensal && <p className="mt-1 text-[13.5px] text-black/55">{reaisDe(PRECO_MENSAL_CENTAVOS)} por mês no cartão. Cancele quando quiser.</p>}

                {fase === "pix" && pedido.email ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-black/10 px-3.5 py-2.5 text-[13px] text-black/55">
                    <span className="min-w-0 break-all">O acesso chega em <b className="block text-[15px] text-[#16121c]">{pedido.email}</b></span>
                  </div>
                ) : (
                  <>
                    <label htmlFor="appweb-email" className="block mt-4 mb-1.5 text-[14px] font-bold">Seu e-mail <span className="font-medium text-black/50">(o acesso chega nele)</span></label>
                    <input
                      id="appweb-email" data-testid="appweb-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254}
                      placeholder="nome@email.com" value={email}
                      onChange={(ev) => { setEmail(ev.target.value); setErroEmail(null); }}
                      className="w-full h-[50px] rounded-xl border-[1.5px] border-black/15 px-3.5 text-[16px] bg-white focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
                    />
                    {sugestao && <button type="button" className="mt-1.5 text-[13.5px] font-bold text-accent" onClick={() => setEmail(sugestao)}>Você quis dizer {sugestao}?</button>}
                    {erroEmail && <p className="mt-1.5 text-[13.5px] font-semibold text-[#b42318]" role="alert" data-testid="appweb-erro-email">{erroEmail}</p>}
                  </>
                )}

                {!mensal && (
                  <div className="grid grid-cols-2 gap-2.5 mt-4" role="radiogroup" aria-label="Forma de pagamento">
                    {(["pix", "card"] as const).map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={metodo === m} data-testid={`appweb-aba-${m}`} onClick={() => escolherMetodo(m)}
                        className={`min-h-[54px] rounded-[14px] text-[16px] font-extrabold border-[1.5px] ${metodo === m ? "border-accent border-2 bg-accent/5 text-accent" : "border-black/15 bg-white"}`}>
                        {m === "pix" ? "Pix" : "Cartão"}{metodo === m ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                )}

                {/* Pix */}
                {!mensal && metodo === "pix" && (fase === "pix" && pedido.pix ? (
                  <div className="mt-4 text-center" data-testid="appweb-pix-qr">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#fff7e6] text-[#8a5a00] text-[13px] font-bold px-3 py-1.5"><i className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />Esperando o Pix</span>
                    <div className="mx-auto mt-3 w-[212px] h-[212px] rounded-2xl border-[1.5px] border-black/10 grid place-items-center bg-white">
                      {pedido.pix.image_url_png ? <img src={pedido.pix.image_url_png} alt="QR code do Pix" width={180} height={180} /> : <QRCodeSVG value={pedido.pix.data ?? ""} size={180} level="M" />}
                    </div>
                    <button type="button" onClick={() => void copiar()} data-testid="appweb-copiar"
                      className="mt-3 w-full h-[52px] rounded-2xl bg-accent text-accent-foreground font-extrabold text-[16px] inline-flex items-center justify-center gap-2">
                      <Copy className="w-4 h-4" /> {copiado ? "Código copiado ✓" : "Copiar código Pix"}
                    </button>
                    <p className="mt-3 text-[14px] text-black/60">Confirmamos sozinhos em segundos.</p>
                    {vence && <p className="mt-1 text-[12.5px] text-black/45">Vale até {vence}.</p>}
                  </div>
                ) : (
                  <button type="button" disabled={pagando} onClick={() => void gerarPix()} data-testid="appweb-gerar-pix"
                    className="mt-5 w-full min-h-[56px] rounded-2xl bg-[#16121c] text-white text-[17px] font-extrabold shadow-[0_8px_20px_-6px_rgba(0,0,0,.35)] disabled:opacity-70 inline-flex items-center justify-center gap-2">
                    {pagando ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</> : `Gerar Pix de ${reaisDe(PRECO_VITALICIO_CENTAVOS)}`}
                  </button>
                ))}

                {/* Cartão (montado sempre que já foi aberto; some quando o Pix está marcado) */}
                <div className={metodo === "card" ? "mt-4" : "hidden"} data-testid="appweb-painel-cartao">
                  {!mensal && pedido.pix && pedido.fase === "pix" && (
                    <p className="mb-3 rounded-xl bg-[#f7f5f8] px-3 py-2.5 text-[12.5px] text-black/60">Ao pagar no cartão, o Pix que você gerou é cancelado. <button type="button" className="font-bold underline" onClick={voltarProPix}>Voltar pro Pix</button></p>
                  )}
                  {!cartaoPronto && !cartaoFalhou && <div className="grid place-items-center h-[120px] text-[13.5px] text-black/50"><Loader2 className="w-5 h-5 animate-spin" /></div>}
                  {cartaoFalhou && <p className="text-[13.5px] font-semibold text-[#b42318]">O cartão não carregou. {mensal ? "Confira a internet e tente de novo." : "Tente de novo ou use o Pix."}</p>}
                  <div ref={caixaCartao} />
                  {!mensal && (
                    <div className="mt-3" data-testid="appweb-parcelas">
                      <span className="block mb-1.5 text-[13px] font-bold">Parcelas</span>
                      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Parcelas">
                        {Array.from({ length: PARCELAS_MAX }, (_, i) => i + 1).map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={parcelas === n} disabled={n > maxParcelas}
                            data-testid={`appweb-parcela-${n}`}
                            onClick={() => { setParcelas(n); setPedido((x) => ({ ...x, parcelas: n })); trackEvent("appweb_parcelas", { ...F, parcelas: n }); }}
                            className={`rounded-xl px-1 py-2 text-[12.5px] leading-tight border-[1.5px] disabled:opacity-40 ${parcelas === n ? "border-accent border-2 bg-accent/5 text-accent font-extrabold" : "border-black/15 font-semibold"}`}>
                            {n}x<br /><span className="text-[11.5px]">{parcelaDe(n)}</span>
                          </button>
                        ))}
                      </div>
                      {SEM_JUROS_NA_TELA && <p className="mt-1 text-[11.5px] text-black/50 text-center">sem juros</p>}
                    </div>
                  )}
                  <button type="button" disabled={pagando || (!cartaoPronto && !cartaoFalhou)} onClick={() => (cartaoFalhou ? (elementoRef.current = null, void montarCartao()) : void pagarCartao())} data-testid="appweb-pagar-cartao"
                    className="mt-4 w-full min-h-[56px] rounded-2xl bg-[#16121c] text-white text-[17px] font-extrabold shadow-[0_8px_20px_-6px_rgba(0,0,0,.35)] disabled:opacity-60 inline-flex items-center justify-center gap-2">
                    {pagando ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
                      : cartaoFalhou ? "Tentar de novo"
                      : mensal ? `Assinar por ${reaisDe(PRECO_MENSAL_CENTAVOS)}/mês`
                      : parcelas > 1 ? `Pagar ${parcelas}x de ${parcelaDe(parcelas)}` : `Pagar ${reaisDe(PRECO_VITALICIO_CENTAVOS)}`}
                  </button>
                </div>

                {erro && <p className="mt-3 text-[13.5px] font-semibold text-[#b42318]" role="alert" data-testid="appweb-erro">{erro}</p>}
                {mensal && (
                  <button type="button" className="block mx-auto mt-4 min-h-[44px] text-[14px] font-bold text-black/70 underline underline-offset-2" data-testid="appweb-prefere-pix"
                    onClick={() => { onPlano("vitalicio"); setPedido((x) => ({ ...x, plano: "vitalicio", metodo: "pix" })); setErro(null); trackEvent("appweb_metodo", { ...F, metodo: "pix", via: "prefere_pix" }); }}>
                    Prefere Pix? Vitalício por {reaisDe(PRECO_VITALICIO_CENTAVOS)}
                  </button>
                )}
                <p className="mt-4 text-center text-[12.5px] text-black/60" data-testid="appweb-garantia">🛡️ Garantia de 7 dias: não gostou, devolvemos 100%.</p>
                <p className="mt-2 text-center text-[11px] text-black/40">Processado pela Stripe · CORE · CNPJ 55.041.112/0001-82</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
