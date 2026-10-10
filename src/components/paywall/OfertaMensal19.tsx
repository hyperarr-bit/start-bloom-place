/**
 * MENSAL DE 19,90 (10/10, só iPhone, 1.0.14) — "Prefere ir devagar?"
 *
 * O produto `core_mensal_19` (offering `mensal_19`, pacote $rc_monthly) em três lugares,
 * cada um atrás da própria chave (lib/ofertas-saida) e 1x por aparelho POR LUGAR:
 *
 *  "mensal_paywall" — escolheu o mensal no paywall do funil e cancelou a folha da Apple
 *                     (OFERTA_MENSAL_19). Compra NA HORA: a pessoa não tem assinatura.
 *  "cancelou_teste" — cancelou o teste de 3 dias e recusou o presente de 69,90
 *                     (SAIDA_TESTE_ESCADA). É DOWNGRADE dentro do grupo CORE Pro
 *                     (core_mensal_19 em nível abaixo do anual): a Apple aplica no FIM do
 *                     período atual = fim do teste. Nada é cobrado hoje; o texto diz isso.
 *  "bloqueio"       — perdeu o acesso e recusou o 69,90 (SAIDA_TESTE_ESCADA). Compra na hora.
 *
 * Preço SEMPRE do priceString da loja. Se a offering `mensal_19` não existir no RevenueCat
 * (ou vier sem o produto / com `presente: "off"`), prepararMensal19 devolve null e nada
 * aparece — a chave sozinha não inventa oferta. Marca de "visto" no DESFECHO (compra ou
 * "Agora não"), como no presente: app morto no meio não queima a chance.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ehApple, erroFolhaNaoConcluiu, erroJaAtivo, erroNaoPermitido } from "@/lib/loja";
import type { LugarDoMensal19, Mensal19 } from "@/lib/revenuecat";

const CHAVES: Record<LugarDoMensal19, string> = {
  mensal_paywall: "core-mensal19-mensal-paywall-visto", // nas 2 allowlists (use-auth / use-user-data)
  cancelou_teste: "core-mensal19-cancelou-visto",
  bloqueio: "core-mensal19-bloqueio-visto",
};
export const mensal19JaVisto = (lugar: LugarDoMensal19): boolean => {
  try { return !!localStorage.getItem(CHAVES[lugar]); } catch { return false; }
};
const marcarVisto = (lugar: LugarDoMensal19) => {
  try { localStorage.setItem(CHAVES[lugar], String(Date.now())); } catch { /* noop */ }
};

/** Como a oferta chegou (campo `segunda_chance` de todo evento mensal19_*). */
export const segundaChanceDoMensal19 = (lugar: LugarDoMensal19): "imediata" | "proxima_abertura" =>
  lugar === "mensal_paywall" ? "imediata" : "proxima_abertura";

export type OfertaDoMensal19 = Mensal19 & {
  /** O mensal de sempre (24,90) pra riscar, se a loja já disse e for diferente. */
  precoDe: string | null;
  /** Fim do teste, só no "cancelou_teste" (quando a 1ª cobrança do 19,90 cai). */
  fimMs: number | null;
};

/** Carrega tudo que a folha precisa; null = não mostrar (sem offering, já visto, não é iPhone). */
export async function prepararMensal19(lugar: LugarDoMensal19, fimMs: number | null = null): Promise<OfertaDoMensal19 | null> {
  if (!ehApple() || mensal19JaVisto(lugar)) return null;
  const rc = await import("@/lib/revenuecat");
  let dados: Mensal19 | null = null;
  try { dados = await rc.carregarMensal19(); } catch { return null; } // módulo sem a função (mock antigo) = sem oferta
  if (!dados) return null;
  let precoDe: string | null = null;
  try { await rc.prefetchAnualIos(); precoDe = rc.precoMensalIos() ?? null; } catch { /* sem o "de" */ }
  if (precoDe === dados.preco) precoDe = null;
  return { ...dados, precoDe, fimMs };
}

const dataCurta = (ms: number) => {
  try { return new Date(ms).toLocaleDateString("pt-BR", { day: "numeric", month: "long" }); } catch { return ""; }
};

export function Mensal19Folha({ lugar, oferta, onFechar, onSucesso }: {
  lugar: LugarDoMensal19;
  oferta: OfertaDoMensal19;
  /** "Agora não" (já marcado como visto). */
  onFechar: () => void;
  /** Folha fechou com sucesso e o acesso sincronizou (já marcado como visto). */
  onSucesso: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = useRef(true);
  const extra = { lugar, segunda_chance: segundaChanceDoMensal19(lugar) };

  useEffect(() => {
    vivo.current = true;
    trackEvent("mensal19_view", { ...extra, preco: oferta.preco, de: oferta.precoDe });
    return () => { vivo.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fechar = () => {
    marcarVisto(lugar);
    trackEvent("mensal19_fechou", extra);
    onFechar();
  };

  const comprar = async () => {
    if (comprando) return;
    setComprando(true);
    setErro(null);
    trackEvent("mensal19_toque", extra);
    const rc = await import("@/lib/revenuecat");
    rc.marcarToqueDeCompra();
    const ok = await rc.comprarMensal19(lugar);
    if (!vivo.current) return;
    setComprando(false);
    if (ok) {
      marcarVisto(lugar);
      trackEvent("mensal19_sucesso", { ...extra, preco: oferta.preco });
      if (lugar === "cancelou_teste") {
        // o teste vai virar mensal pago: o "acaba amanhã" do anual não tem mais por quê
        try { (await import("@/lib/notificacoes")).cancelarLembreteDoTeste().catch(() => { /* noop */ }); } catch { /* noop */ }
      }
      onSucesso();
      return;
    }
    const motivo = rc.motivoUltimaCompra();
    trackEvent("mensal19_falhou", { ...extra, motivo });
    if (motivo === "cancelou" || motivo === null) return;
    if (motivo === "ja_ativo") setErro(erroJaAtivo());
    else if (motivo === "nao_permitido") setErro(erroNaoPermitido());
    else setErro(erroFolhaNaoConcluiu());
  };

  const entra = (delay: number) => (reduzir ? { duration: 0 } : { delay });
  const inicial = (y = 0) => (reduzir ? false : { opacity: 0, y });

  return (
    <div
      data-testid="mensal19"
      data-lugar={lugar}
      className="fixed inset-0 z-[320] overflow-y-auto"
      style={{ background: "linear-gradient(180deg,#f3f0fb 0%,#ffffff 52%)" }}
    >
      <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 pb-8 pt-[calc(var(--app-safe-top)+28px)]">
        <motion.div initial={inicial(8)} animate={{ opacity: 1, y: 0 }} transition={entra(0)} className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider">
            {lugar === "bloqueio" ? "Pra você voltar" : "Sem pressa"}
          </span>
          <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.12] text-[#16121c] mt-3">
            Prefere ir<br />devagar?
          </h1>
          <p className="text-[13.5px] text-[#4f5a64] mt-2.5 leading-snug">
            <b className="text-[#16121c]">{oferta.preco} por mês</b>{oferta.precoDe ? <> (em vez de {oferta.precoDe})</> : null}, cancela quando quiser.
            {lugar === "bloqueio" ? <> Tudo o que você construiu continua aqui.</> : null}
          </p>
        </motion.div>

        <motion.div
          initial={reduzir ? false : { opacity: 0, y: 28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduzir ? { duration: 0 } : { delay: 0.15, type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-3xl bg-white border-2 border-accent p-5 mt-7 shadow-[0_24px_48px_-18px_rgba(210,41,122,.35)]"
          data-testid="mensal19-cartao"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-extrabold text-[#16121c]">CORE Mensal</span>
            <span className="text-right">
              {oferta.precoDe && <s className="block text-[12px] font-bold text-[#8a93a0] leading-none">{oferta.precoDe}</s>}
              <span className="text-[24px] font-black tracking-tight text-[#16121c] leading-none">
                {oferta.preco}<small className="text-[12px] font-bold text-[#8a93a0]">/mês</small>
              </span>
            </span>
          </div>
          <p className="text-[12px] font-semibold text-[#4f5a64] mt-1.5">os 16 módulos, sem limite · cancela em 1 toque</p>
        </motion.div>

        <motion.p
          initial={inicial()} animate={{ opacity: 1, y: 0 }} transition={entra(0.3)}
          className="text-[12px] text-[#4f5a64] text-center leading-snug mt-4"
          data-testid="mensal19-regra"
        >
          {lugar === "cancelou_teste"
            ? <>Nada é cobrado hoje: você continua no teste e só paga <b className="text-[#16121c]">{oferta.preco}</b>{oferta.fimMs ? <> quando ele acabar, em {dataCurta(oferta.fimMs)}</> : <> quando ele acabar</>}. Depois, renova todo mês até você cancelar.</>
            : <>Cobrado hoje pela App Store: <b className="text-[#16121c]">{oferta.preco}</b>. Renova todo mês até você cancelar.</>}
        </motion.p>

        {erro && <p className="text-[12.5px] text-destructive text-center mt-3" role="alert">{erro}</p>}

        <div className="mt-auto pt-6">
          <motion.button
            initial={inicial(10)} animate={{ opacity: 1, y: 0 }} transition={entra(0.35)}
            disabled={comprando}
            onClick={() => void comprar()}
            data-testid="mensal19-cta"
            className="w-full min-h-[54px] rounded-full text-[16px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform grid place-items-center disabled:opacity-60"
          >
            {comprando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <span className="flex items-center gap-1.5">{lugar === "cancelou_teste" ? "Mudar pro mensal" : "Começar"} — {oferta.preco}/mês <ArrowRight className="w-4 h-4" /></span>}
          </motion.button>
          <p className="text-[10.5px] text-[#8a93a0] text-center mt-2 leading-snug">
            Assinatura pela App Store · renova automaticamente por {oferta.preco}/mês até você cancelar
          </p>
          <button
            onClick={fechar}
            disabled={comprando}
            data-testid="mensal19-agora-nao"
            className="w-full text-center text-[13px] font-semibold text-[#4f5a64] mt-3 py-2"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
