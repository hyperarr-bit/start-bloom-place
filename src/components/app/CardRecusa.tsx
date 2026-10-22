/**
 * O CARD DA RECUSA (1.0.18, dono 22/10) — tela inteira, 1x por recusa. Regras e a pesquisa da Apple em lib/card-recusa.
 *
 * Copy minimalista, títulos sem ponto final, neutra de gênero. Nunca fala de horário/antecedência da cobrança e
 * nunca de Pix/site (é o app da loja). O 19,90 só aparece com a oferta carregada da loja (`oferta`); o botão diz
 * "Mudar pro mensal" porque a troca anual → mensal é DOWNGRADE e vale na próxima cobrança, não na hora.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CreditCard, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { erroFolhaNaoConcluiu, erroJaAtivo, erroNaoPermitido, nomeLoja } from "@/lib/loja";
import type { OfertaDoMensal19 } from "@/components/paywall/OfertaMensal19";

export type CampoDoCard = { com_acesso: boolean; dias_restantes: number | null };

export function CardRecusa({ href, comAcesso, oferta, campos, onFechar }: {
  /** A forma de pagamento da loja (urlAtualizarPagamento). */
  href: string;
  comAcesso: boolean;
  /** O mensal 19,90 da loja; null = só "Atualizar meu cartão". */
  oferta: OfertaDoMensal19 | null;
  campos: CampoDoCard;
  /** Fechou o card (qualquer saída). Depois dele, nesta abertura, a faixa de sempre. */
  onFechar: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trocou, setTrocou] = useState(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const comMensal = !!oferta;
  const extra = { ...campos, com_mensal19: comMensal };

  const atualizar = () => {
    trackEvent("card_recusa_cartao", extra);
    // o link abre a loja (target _blank); o card sai — na volta, a faixa de sempre se o cartão ainda não passou
    onFechar();
  };
  const agoraNao = () => { trackEvent("card_recusa_agora_nao", extra); onFechar(); };

  const mudar = async () => {
    if (comprando || !oferta) return;
    setComprando(true);
    setErro(null);
    trackEvent("card_recusa_mensal19", { ...extra, preco: oferta.preco });
    const rc = await import("@/lib/revenuecat");
    rc.marcarToqueDeCompra();
    const ok = await rc.comprarMensal19("recusa");
    if (!vivo.current) return;
    setComprando(false);
    const motivo = ok ? null : rc.motivoUltimaCompra();
    trackEvent("card_recusa_compra", { ...extra, resultado: ok ? "sucesso" : motivo === "cancelou" || motivo === null ? "cancelou" : "falhou", motivo, preco: oferta.preco });
    if (ok) { setTrocou(true); return; }
    if (motivo === "cancelou" || motivo === null) return;
    if (motivo === "ja_ativo") setErro(erroJaAtivo());
    else if (motivo === "nao_permitido") setErro(erroNaoPermitido());
    else setErro(erroFolhaNaoConcluiu());
  };

  const tela = (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="card-recusa-titulo"
      data-testid="card-recusa"
      data-com-mensal19={comMensal ? "1" : "0"}
      data-aviso-cobranca=""
      initial={reduzir ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[320] flex flex-col bg-background text-foreground px-7"
      style={{ paddingTop: "calc(var(--app-safe-top, 0px) + 1.5rem)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 1.25rem)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-6" aria-hidden>
          <CreditCard className="w-8 h-8" strokeWidth={1.75} />
        </div>
        {trocou ? (
          <>
            <h2 id="card-recusa-titulo" className="text-[26px] font-bold tracking-tight leading-tight">Plano trocado</h2>
            <p data-testid="card-recusa-trocou" className="text-muted-foreground text-[15px] leading-relaxed mt-3 max-w-[300px]">
              Agora é {oferta?.preco} por mês. A {nomeLoja()} cobra o valor novo na próxima tentativa.
            </p>
          </>
        ) : (
          <>
            <h2 id="card-recusa-titulo" className="text-[26px] font-bold tracking-tight leading-tight">Seu cartão não passou</h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed mt-3 max-w-[300px]">
              {comMensal
                ? <>Atualize o cartão na {nomeLoja()} ou mude pro plano mensal.</>
                : <>Atualize o cartão na {nomeLoja()} pra continuar com o CORE.</>}
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col items-stretch gap-2">
        {trocou ? (
          <button type="button" onClick={onFechar} data-testid="card-recusa-entendi" className="h-14 rounded-2xl bg-foreground text-background text-[16px] font-semibold">
            Entendi
          </button>
        ) : (
          <>
            {erro && <p role="alert" className="text-[13px] text-destructive text-center mb-1">{erro}</p>}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={atualizar}
              data-testid="card-recusa-cartao"
              className="h-14 rounded-2xl bg-foreground text-background text-[16px] font-semibold flex items-center justify-center"
            >
              Atualizar meu cartão
            </a>
            {oferta && (
              <>
                <button
                  type="button"
                  onClick={() => void mudar()}
                  disabled={comprando}
                  data-testid="card-recusa-mensal19"
                  className="h-14 rounded-2xl border border-border text-[16px] font-semibold flex items-center justify-center disabled:opacity-60"
                >
                  {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Mudar pro mensal de {oferta.preco}</>}
                </button>
                <p data-testid="card-recusa-regra" className="text-[12px] text-muted-foreground text-center leading-snug px-2">
                  {comAcesso
                    ? <>Você segue usando enquanto a {nomeLoja()} tenta cobrar o valor menor. Renova todo mês até você cancelar.</>
                    : <>O acesso volta quando a {nomeLoja()} conseguir cobrar o valor menor. Renova todo mês até você cancelar.</>}
                </p>
              </>
            )}
            <button type="button" onClick={agoraNao} disabled={comprando} data-testid="card-recusa-agora-nao" className="h-11 text-[14px] font-medium text-muted-foreground">
              Agora não
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
  return typeof document !== "undefined" ? createPortal(tela, document.body) : tela;
}
