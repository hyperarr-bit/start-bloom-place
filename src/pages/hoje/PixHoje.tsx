import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, ChevronLeft, Copy, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { EMPRESA } from "@/lib/empresa";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";
import { cookiesDaMeta } from "@/pages/venda/rastreio";
import { EMAIL_OK, abrirSessaoParaPagar, salvarEmailDaCompra, sessaoViva } from "./conta";
import { preco, type OfertaHoje } from "./conteudo";

/**
 * O PIX NA PÁGINA DO /hoje (18/10) — o mesmo componente pro plano e pros upsells.
 *
 * Cano: ASAAS (asaas-pix, QR estático sem CPF). `create` grava o `pix_order_created` (user_id da sessão — anônima, sem
 * e-mail — + id do QR + fbp/fbc/url): é o elo do pagamento com a conta. Confirmação: `check` a cada 3 s e na volta da
 * aba (depois do app do banco); o asaas-webhook e o pix-reconcile são as redes. Purchase: CAPI no servidor (event_id =
 * id do QR) + o pixel pelo firePixPurchaseOnce (mesmo id). Área de transferência SÓ no toque em "Copiar código Pix".
 * No lugar do antigo "o Pix aparece em nome de…": só "CORE · CNPJ …" (decisão do dono).
 */
export type PixSalvo = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number; oferta: OfertaHoje };

const VALIDADE_MS = 30 * 60_000; // EXPIRA_SEGUNDOS = 1800 na asaas-pix
export const venceEm = (p: Pick<PixSalvo, "expiresAt" | "criadoEm">): number => {
  const t = p.expiresAt ? Date.parse(p.expiresAt) : NaN;
  return Number.isFinite(t) ? t : p.criadoEm + VALIDADE_MS;
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Copiar no navegador do Instagram: clipboard API e, se negar, o textarea de sempre. */
async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* plano B */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

export function PixIcone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="currentColor" />
    </svg>
  );
}

export function PixHoje({ oferta, valor, rotulo, pix, anteriores = [], emailSalvo = null, onEmailSalvo, onPix, onPago, onVoltar, ids }: {
  oferta: OfertaHoje;
  valor: number;
  /** a linha embaixo do valor ("1º ano do CORE", "CORE pra sempre"…) */
  rotulo: string;
  pix: PixSalvo | null;
  /** QRs ANTERIORES desta compra que ainda não venceram (trocou de plano depois de copiar): a conferência reveza com
   *  eles — quem paga o QR antigo no banco não pode ficar esperando o novo. */
  anteriores?: PixSalvo[];
  onPix: (p: PixSalvo | null) => void;
  /** QUAL pedido caiu (o atual ou um anterior) — é ele que define a oferta paga */
  onPago: (p: PixSalvo) => void;
  onVoltar: (() => void) | null;
  ids: () => Record<string, unknown>;
  /** o e-mail OPCIONAL já salvo nesta compra (some o campo) */
  emailSalvo?: string | null;
  onEmailSalvo?: (email: string, via: "conta" | "destino") => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [aindaNao, setAindaNao] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const pago = useRef(false);
  const pedindo = useRef(false);
  const onPagoRef = useRef(onPago);
  onPagoRef.current = onPago;
  const pixAtual = pix && pix.oferta === oferta ? pix : null;

  const gerar = useCallback(async () => {
    if (pedindo.current) return;
    pedindo.current = true;
    setGerando(true);
    setErro(null);
    try {
      const s = await abrirSessaoParaPagar();
      if (s === "indisponivel") {
        trackEvent("hoje_erro", { onde: "sessao", oferta, ...ids() });
        setErro("Não consegui abrir o pagamento agora. Tenta de novo em alguns segundos.");
        return;
      }
      const c = cookiesDaMeta();
      const { data, error } = await supabase.functions.invoke("asaas-pix", {
        body: { action: "create", offer: oferta, fbp: c.fbp, fbc: c.fbc, sourceUrl: window.location.href.slice(0, 300) },
      });
      const d = data as { orderId?: string; qrCode?: string; qrCodeBase64?: string | null; expiresAt?: string | null } | null;
      if (error || !d?.orderId || !d?.qrCode) {
        trackEvent("hoje_erro", { onde: "pix_create", oferta, msg: String(error?.message || (data as { error?: string } | null)?.error || "sem_qr").slice(0, 160), ...ids() });
        setErro("Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.");
        return;
      }
      const novo: PixSalvo = { orderId: d.orderId, qrCode: d.qrCode, qrCodeBase64: d.qrCodeBase64 ?? null, expiresAt: d.expiresAt ?? null, criadoEm: Date.now(), oferta };
      markPixPurchasePending({ offer: oferta, orderId: novo.orderId });
      onPix(novo);
      trackEvent("hoje_pix_gerado", { order_id: novo.orderId, oferta, valor, ...ids() });
    } catch (e) {
      trackEvent("hoje_erro", { onde: "pix_create", oferta, msg: String(e).slice(0, 160), ...ids() });
      setErro("Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.");
    } finally {
      pedindo.current = false;
      setGerando(false);
    }
  }, [ids, onPix, oferta, valor]);

  /* sem QR desta oferta (ou o salvo venceu) → gera na montagem */
  useEffect(() => {
    if (!pixAtual || venceEm(pixAtual) <= Date.now()) void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oferta]);

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const anterioresRef = useRef(anteriores);
  anterioresRef.current = anteriores;
  const vez = useRef(0);
  /** Uma conferência (o atual; com anteriores vivos, reveza: atual, anterior 1, atual, anterior 2…). true = pago. */
  const conferirUmaVez = useCallback(async (): Promise<boolean> => {
    if (!pixAtual || pago.current) return pago.current;
    const vivos = anterioresRef.current.filter((a) => a.orderId !== pixAtual.orderId && venceEm(a) > Date.now());
    const fila: PixSalvo[] = vivos.length ? vivos.flatMap((v) => [pixAtual, v]) : [pixAtual];
    const alvo = fila[vez.current++ % fila.length];
    await sessaoViva();
    const c = cookiesDaMeta();
    const { data } = await supabase.functions.invoke("asaas-pix", {
      body: { action: "check", id: alvo.orderId, offer: alvo.oferta, fbp: c.fbp, fbc: c.fbc, sourceUrl: window.location.href.slice(0, 300) },
    });
    if ((data as { paid?: boolean } | null)?.paid && !pago.current) {
      pago.current = true;
      void firePixPurchaseOnce("checkout");
      onPagoRef.current(alvo);
      return true;
    }
    return false;
  }, [pixAtual]);

  /* confirmação: check a cada 3 s + na volta da aba */
  useEffect(() => {
    if (!pixAtual) return;
    let parado = false;
    let timer: number | null = null;
    let rodando = false;
    const conferir = async () => {
      if (parado || pago.current || rodando) return;
      rodando = true;
      try { if (await conferirUmaVez()) return; } catch { /* tenta de novo */ } finally { rodando = false; }
      if (!parado && !pago.current) timer = window.setTimeout(conferir, 3000);
    };
    timer = window.setTimeout(conferir, 3000);
    const aoVoltar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    return () => {
      parado = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
  }, [pixAtual, conferirUmaVez]);

  const copiar = async () => {
    if (!pixAtual) return;
    const ok = await copiarTexto(pixAtual.qrCode);
    setCopiado(true); // o código está visível embaixo pra copiar na mão se o navegador negar
    trackEvent("funnel_click", { funil: "hoje", cta: "copiar_pix", oferta, ...ids() });
    trackEvent("hoje_pix_copiado", { ok, order_id: pixAtual.orderId, oferta, ...ids() });
  };

  const jaPaguei = async () => {
    setConferindo(true);
    setAindaNao(false);
    trackEvent("funnel_click", { funil: "hoje", cta: "ja_paguei", oferta, ...ids() });
    let ok = false;
    try { ok = await conferirUmaVez(); } catch { ok = false; }
    setConferindo(false);
    if (!ok) setAindaNao(true);
  };

  /* 18/10: o e-mail OPCIONAL (a rede de quem paga e fecha a aba). Não bloqueia nada; só aparece com o código na tela.
   *   e-mail livre → entra NA PRÓPRIA conta anônima (a compra já é dela; as boas-vindas saem quando o Pix cair);
   *   e-mail com conta → `email_pedido`: o servidor guarda como destino e, quando creditar, leva a compra pra essa
   *   conta e manda o acesso por e-mail (_shared/destino-hoje.ts). */
  const [emailOpc, setEmailOpc] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const salvarEmailOpcional = async () => {
    if (!pixAtual) return;
    setSalvandoEmail(true); setErroEmail(null);
    const limpo = emailOpc.trim().toLowerCase();
    let via: "conta" | "destino" | null = null;
    let erro: string | null = null;
    try {
      const r = await salvarEmailDaCompra(limpo);
      if (r.ok === true) via = "conta";
      else if ("existe" in r) {
        await sessaoViva();
        const { data } = await supabase.functions.invoke("asaas-pix", { body: { action: "email_pedido", id: pixAtual.orderId, email: limpo } });
        if ((data as { ok?: boolean } | null)?.ok) via = "destino";
      } else erro = r.erro;
    } catch { /* cai no erro abaixo */ }
    setSalvandoEmail(false);
    trackEvent("hoje_email_pix", { ok: !!via, via, oferta, ...ids() });
    if (via) onEmailSalvo?.(limpo, via);
    else setErroEmail(erro ?? "Não consegui salvar agora. Pode seguir — o e-mail também pode ir depois do pagamento.");
  };

  const resta = pixAtual ? venceEm(pixAtual) - agora : 0;
  const vencido = !!pixAtual && resta <= 0;

  const topo = (
    <div className="fn-topo">
      {onVoltar ? <button type="button" className="fn-voltar" onClick={onVoltar}><ChevronLeft size={18} /><span>Voltar</span></button> : null}
      <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
    </div>
  );

  if (!pixAtual || gerando) {
    return (
      <div className="fn-tela" data-testid="hoje-pix" data-fase={erro ? "erro" : "gerando"}>
        {topo}
        <div className="fn-pix-topo" style={{ paddingTop: 40 }}>
          <small>PAGAMENTO COM PIX</small>
          <div className="fn-pix-valor">{preco(valor)}</div>
          {erro ? (
            <>
              <p className="fn-erro" role="alert">{erro}</p>
              <div style={{ padding: "16px 0 0" }}>
                <button type="button" className="fn-cta" onClick={() => { void gerar(); }} data-testid="hoje-pix-tentar">Tentar de novo</button>
              </div>
            </>
          ) : (
            <span className="fn-status"><Loader2 size={13} className="fn-gira" />Gerando seu Pix…</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fn-tela" data-testid="hoje-pix" data-fase={vencido ? "vencido" : "qr"} data-oferta={oferta}>
      {topo}
      <div className="fn-pix-topo">
        <small>PAGAMENTO COM PIX</small>
        <div className="fn-pix-valor" data-testid="hoje-pix-valor">{preco(valor)}</div>
        <div className="fn-pix-rotulo">{rotulo}</div>
        {vencido
          ? <span className="fn-status" data-vencido="">Este código venceu</span>
          : <span className="fn-status"><i />Esperando o Pix</span>}
      </div>
      {vencido ? (
        <div className="fn-copiar">
          <button type="button" className="fn-copiar-btn" onClick={() => { onPix(null); void gerar(); }} data-testid="hoje-pix-outro">Gerar outro Pix</button>
        </div>
      ) : (
        <>
          <ol className="fn-passos">
            <li data-feito={copiado ? "" : undefined}><i>{copiado ? <Check size={13} strokeWidth={3.4} /> : 1}</i><span>Copie o código</span></li>
            <li><i>2</i><span>No app do banco: Pix → <b>Copia e Cola</b></span></li>
            <li><i>3</i><span>Volte aqui — a tela muda sozinha</span></li>
          </ol>
          <div className="fn-copiar">
            <button type="button" className="fn-copiar-btn" data-ok={copiado ? "" : undefined} onClick={() => { void copiar(); }} data-testid="hoje-copiar">
              {copiado ? <><Check size={21} strokeWidth={3} /><span>Código copiado!</span></> : <><Copy size={20} strokeWidth={2.4} /><span>Copiar código Pix</span></>}
            </button>
            <div className="fn-copiado-dica">{copiado ? "Agora é só colar no app do seu banco." : ""}</div>
          </div>
          {onEmailSalvo && (emailSalvo ? (
            <div className="fn-email-opc fn-email-opc-ok" data-testid="hoje-email-pix-ok"><Check size={14} strokeWidth={3} /><span>O acesso vai pra <b>{emailSalvo}</b> quando o Pix cair.</span></div>
          ) : (
            <div className="fn-email-opc" data-testid="hoje-email-pix">
              <label htmlFor="hoje-email-pix-campo">Quer receber o acesso por e-mail? <span>(opcional)</span></label>
              <div className="fn-email-opc-linha">
                <input id="hoje-email-pix-campo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
                  value={emailOpc} onChange={(ev) => { setEmailOpc(ev.target.value); setErroEmail(null); }} data-testid="hoje-email-pix-campo" />
                <button type="button" className="fn-email-opc-btn" disabled={!EMAIL_OK.test(emailOpc.trim()) || salvandoEmail} onClick={() => { void salvarEmailOpcional(); }} data-testid="hoje-email-pix-salvar">
                  {salvandoEmail ? "…" : "Salvar"}
                </button>
              </div>
              {erroEmail && <p className="fn-erro" role="alert">{erroEmail}</p>}
            </div>
          ))}
          <div className="fn-codigo" data-testid="hoje-pix-codigo">{pixAtual.qrCode}</div>
          <div className="fn-cnpj" data-testid="hoje-cnpj"><ShieldCheck size={15} strokeWidth={2.4} /><span>CORE · CNPJ {EMPRESA.cnpj}</span></div>
          <div className="fn-validade">Este código vale por <b>{mmss(resta)}</b></div>
          <details className="fn-qr" data-testid="hoje-qr">
            <summary><QrCode size={18} strokeWidth={2.2} />Pagar com QR Code<span>de outro aparelho</span></summary>
            <div className="fn-qr-caixa"><div>
              {pixAtual.qrCodeBase64
                ? <img src={pixAtual.qrCodeBase64} alt="QR code do Pix" width={156} height={156} style={{ display: "block" }} />
                : <QRCodeSVG value={pixAtual.qrCode} size={156} level="M" />}
            </div></div>
          </details>
          <div className="fn-rodape" style={{ marginTop: 10 }}>
            {aindaNao && <p className="fn-ainda" role="status" data-testid="hoje-ainda-nao">Ainda não chegou. Confere no app do banco — quando cair, a tela muda sozinha.</p>}
            <button type="button" className="fn-sec" onClick={() => { void jaPaguei(); }} disabled={conferindo} data-testid="hoje-ja-paguei">
              {conferindo ? "Conferindo seu Pix…" : "Já paguei"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
