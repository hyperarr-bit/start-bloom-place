import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";
import { BotaoCard, MAGENTA, TituloCard } from "@/pages/porta/telas";
import { BOTAO_COPIAR_PIX, OFERTA_PIX_ANUAL, PIX_ESPERANDO, PIX_TITULO, PLANOS } from "./conteudo";
import { cookiesDaMeta } from "./rastreio";

/**
 * O PIX NA PÁGINA (/assinar, 15/10) — QR + copia-e-cola, sem sair do site.
 *
 * Cano: ASAAS (QR estático, sem CPF), oferta `a97` = R$ 97,90 e 365 dias de acesso (a mesma tabela nas 3 funções
 * de dinheiro: asaas-pix, asaas-webhook, pix-reconcile). O `create` grava o `pix_order_created` (user_id + id do QR
 * + fbp/fbc/url) — é ele que liga o pagamento à conta. Confirmação: `check` a cada 3 s (e na volta da aba, depois do
 * app do banco); o webhook da Asaas e o pix-reconcile são as redes. Purchase: CAPI no servidor (event_id = id do QR)
 * + o pixel pelo firePixPurchaseOnce (mesmo id, só se a assinatura desta conta tiver esse pedido).
 *
 * Área de transferência: SÓ no toque em "Copiar código Pix" (a pessoa pediu). Nada lê o clipboard.
 */
export type PixGerado = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number };

/** Validade do QR da Asaas (EXPIRA_SEGUNDOS = 1800 na asaas-pix). Sem `expiresAt`, conta 30 min da criação. */
const VALIDADE_MS = 30 * 60_000;
export const venceEm = (p: PixGerado): number => {
  const t = p.expiresAt ? Date.parse(p.expiresAt) : NaN;
  return Number.isFinite(t) ? t : p.criadoEm + VALIDADE_MS;
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function PixVenda({ pix, onPix, onPago, ids, celular }: {
  pix: PixGerado | null;
  onPix: (p: PixGerado | null) => void;
  onPago: () => void;
  ids: () => Record<string, string>;
  /** no celular o copia-e-cola vem primeiro; no computador, o QR grande */
  celular: boolean;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const pago = useRef(false);
  const pedindo = useRef(false);
  const onPagoRef = useRef(onPago);
  onPagoRef.current = onPago;

  const gerar = useCallback(async () => {
    if (pedindo.current) return;
    pedindo.current = true;
    setGerando(true);
    setErro(null);
    try {
      const c = cookiesDaMeta();
      const { data, error } = await supabase.functions.invoke("asaas-pix", {
        body: { action: "create", offer: OFERTA_PIX_ANUAL, fbp: c.fbp, fbc: c.fbc, sourceUrl: window.location.href.slice(0, 300) },
      });
      const d = data as { orderId?: string; qrCode?: string; qrCodeBase64?: string | null; expiresAt?: string | null } | null;
      if (error || !d?.orderId || !d?.qrCode) {
        trackEvent("venda_erro", { onde: "pix_create", msg: String(error?.message || (data as { error?: string } | null)?.error || "sem_qr").slice(0, 160), ...ids() });
        setErro("Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.");
        return;
      }
      const novo: PixGerado = { orderId: d.orderId, qrCode: d.qrCode, qrCodeBase64: d.qrCodeBase64 ?? null, expiresAt: d.expiresAt ?? null, criadoEm: Date.now() };
      markPixPurchasePending({ offer: OFERTA_PIX_ANUAL, orderId: novo.orderId });
      onPix(novo);
      trackEvent("venda_pix_qr_view", { order_id: novo.orderId, plano: "anual", valor: PLANOS.anual.valor, ...ids() });
    } catch (e) {
      trackEvent("venda_erro", { onde: "pix_create", msg: String(e).slice(0, 160), ...ids() });
      setErro("Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.");
    } finally {
      pedindo.current = false;
      setGerando(false);
    }
  }, [ids, onPix]);

  /* sem QR (ou o salvo venceu) → gera na montagem */
  useEffect(() => {
    if (!pix || venceEm(pix) <= Date.now()) void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* relógio do QR */
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* confirmação: check a cada 3 s + na volta da aba */
  useEffect(() => {
    if (!pix) return;
    let parado = false;
    let timer: number | null = null;
    let rodando = false;
    const conferir = async () => {
      if (parado || pago.current || rodando) return;
      rodando = true;
      try {
        const c = cookiesDaMeta();
        const { data } = await supabase.functions.invoke("asaas-pix", {
          body: { action: "check", id: pix.orderId, offer: OFERTA_PIX_ANUAL, fbp: c.fbp, fbc: c.fbc, sourceUrl: window.location.href.slice(0, 300) },
        });
        if ((data as { paid?: boolean } | null)?.paid && !pago.current) {
          pago.current = true;
          void firePixPurchaseOnce("checkout");
          onPagoRef.current();
          return;
        }
      } catch { /* tenta de novo */ } finally { rodando = false; }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix?.orderId]);

  /* o ÚNICO uso da área de transferência: o toque da pessoa em "Copiar código Pix" */
  const copiar = async () => {
    if (!pix) return;
    let ok = false;
    try { await navigator.clipboard.writeText(pix.qrCode); ok = true; } catch { /* sem permissão: o código está visível pra copiar na mão */ }
    setCopiado(ok);
    trackEvent("venda_pix_copiado", { ok, order_id: pix.orderId, ...ids() });
    if (ok) window.setTimeout(() => setCopiado(false), 2500);
  };

  const resta = pix ? venceEm(pix) - agora : 0;
  const vencido = !!pix && resta <= 0;

  if (!pix || gerando) {
    return (
      <div className="pt-8 pb-4 text-center" data-testid="venda-pix" data-fase={erro ? "erro" : "gerando"}>
        {erro ? (
          <>
            <TituloCard testid="venda-pix-titulo">O Pix não saiu</TituloCard>
            <p className="mt-2 text-[15px] text-[#6b6670]" role="alert">{erro}</p>
            <BotaoCard texto="Tentar de novo" onClick={() => { void gerar(); }} testid="venda-pix-tentar" className="mt-5" />
          </>
        ) : (
          <>
            <Loader2 className="mx-auto w-8 h-8 animate-spin text-[#16121c]" aria-hidden />
            <TituloCard testid="venda-pix-titulo" className="mt-4">Gerando seu Pix…</TituloCard>
            <p className="mt-2 text-[15px] text-[#6b6670]">Anual · R$ {PLANOS.anual.preco}</p>
          </>
        )}
      </div>
    );
  }

  const qr = (
    <div className="mx-auto w-fit rounded-[14px] border border-[#ebe8ee] bg-white p-3" data-testid="venda-pix-qr">
      {pix.qrCodeBase64
        ? <img src={pix.qrCodeBase64} alt="QR code do Pix" width={celular ? 168 : 208} height={celular ? 168 : 208} className="block" />
        : <QRCodeSVG value={pix.qrCode} size={celular ? 168 : 208} level="M" />}
    </div>
  );

  return (
    <div className="mt-6" data-testid="venda-pix" data-fase={vencido ? "vencido" : "qr"}>
      <TituloCard testid="venda-pix-titulo">{vencido ? "Esse Pix venceu" : PIX_TITULO}</TituloCard>
      <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]">
        Anual · <b className="text-[#16121c]">R$ {PLANOS.anual.preco}</b> · 1 ano de acesso
      </p>

      {vencido ? (
        <BotaoCard texto="Gerar outro Pix" onClick={() => { onPix(null); void gerar(); }} testid="venda-pix-outro" className="mt-5" />
      ) : (
        <>
          {!celular && <div className="mt-5">{qr}</div>}
          <div className="mt-5 rounded-[12px] border border-[#e3e0e6] bg-[#faf9fb] px-3.5 py-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#8a8490]">Pix copia e cola</p>
            <p className="mt-1 text-[13px] leading-snug text-[#3d3842] break-all line-clamp-2 font-mono" data-testid="venda-pix-codigo">{pix.qrCode}</p>
          </div>
          <BotaoCard
            texto={copiado ? "Código copiado" : BOTAO_COPIAR_PIX} onClick={() => { void copiar(); }} testid="venda-pix-copiar" className="mt-3"
            icone={copiado ? <Check className="w-[18px] h-[18px]" strokeWidth={2.6} aria-hidden /> : <Copy className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden />}
          />
          <ol className="mt-4 flex flex-col gap-1.5 text-[14px] leading-snug text-[#4f4a55]" data-testid="venda-pix-passos">
            <li><b className="text-[#16121c]">1.</b> Abra o app do seu banco e escolha Pix.</li>
            <li><b className="text-[#16121c]">2.</b> {celular ? "Cole o código em “Pix copia e cola”." : "Leia o QR code com a câmera do banco."}</li>
            <li><b className="text-[#16121c]">3.</b> Confirme. Seu CORE libera aqui na hora.</li>
          </ol>
          {celular && (
            <details className="mt-3" data-testid="venda-pix-ver-qr">
              <summary className="cursor-pointer text-[13.5px] text-[#6b6670] list-none text-center">Vai pagar por outro aparelho? <b className="text-[#16121c]">Ver QR code</b></summary>
              <div className="mt-3">{qr}</div>
            </details>
          )}
          <div className="mt-4 rounded-[12px] bg-[#fdf2f8] px-3 py-2.5 text-center" data-testid="venda-pix-esperando" aria-live="polite">
            <p className="flex items-center justify-center gap-2 text-[14px] font-semibold" style={{ color: MAGENTA }}>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />{PIX_ESPERANDO}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[#8a8490]">O código vence em {mmss(resta)}</p>
          </div>
        </>
      )}
    </div>
  );
}
