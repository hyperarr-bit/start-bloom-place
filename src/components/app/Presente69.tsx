/**
 * PRESENTE DE 69,90 (07/10, só iPhone) — o anual `core_anual_69` como presente
 * em dois momentos do caminho do dinheiro:
 *
 *  "cancelou_teste" — cancelou o teste de 3 dias, acesso ainda vivo. Entra no
 *                     lugar da save-offer do mensal (15 vistas, 0 aceites).
 *  "bloqueio"       — perdeu o acesso (teste acabou cancelado / expirou) e
 *                     caiu no gate do app, por cima do paywall de 97,90.
 *
 * Uma vez por pessoa POR LUGAR (marca no aparelho, no DESFECHO: "Agora não" ou
 * compra — app morto no meio não queima a chance). Folha cancelada/falhou:
 * continua aqui, com o erro quando é defeito, e "Agora não" sempre à mão.
 * Desligar sem versão nova: metadata `presente: "off"` na offering `anual_69`
 * (ver revenuecat.ts). A regra da Apple pra cada texto também está lá.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ehApple, erroFolhaNaoConcluiu, erroJaAtivo, erroNaoPermitido } from "@/lib/loja";
import type { LugarDoPresente, Presente69 } from "@/lib/revenuecat";

const CHAVES: Record<LugarDoPresente, string> = {
  cancelou_teste: "core-presente69-cancelou-visto", // nas 2 allowlists (use-auth / use-user-data)
  bloqueio: "core-presente69-bloqueio-visto",
};
export const presenteJaVisto = (lugar: LugarDoPresente): boolean => {
  try { return !!localStorage.getItem(CHAVES[lugar]); } catch { return false; }
};
const marcarVisto = (lugar: LugarDoPresente) => {
  try { localStorage.setItem(CHAVES[lugar], String(Date.now())); } catch { /* noop */ }
};

export type OfertaDoPresente = Presente69 & { precoDe: string | null; fimMs: number | null };

/** Carrega tudo que a folha precisa; null = não mostrar (desligado, sem loja, já visto, lugar errado). */
export async function prepararPresente(lugar: LugarDoPresente): Promise<OfertaDoPresente | null> {
  if (!ehApple() || presenteJaVisto(lugar)) return null;
  const rc = await import("@/lib/revenuecat");
  const situacao = await rc.situacaoDoPresente();
  if (situacao?.lugar !== lugar) return null;
  const dados = await rc.carregarPresente69();
  if (!dados) return null;
  let precoDe: string | null = null;
  try { await rc.prefetchAnualIos(); precoDe = rc.precoAnualIos(); } catch { /* sem o "de" */ }
  if (precoDe === dados.preco) precoDe = null; // a loja já serviu o 69 como anual: não riscar o próprio preço
  return { ...dados, precoDe, fimMs: situacao.fimMs };
}

const dataCurta = (ms: number) => {
  try { return new Date(ms).toLocaleDateString("pt-BR", { day: "numeric", month: "long" }); } catch { return ""; }
};

/* A caixa: grafite com fita magenta, tampa que levanta e o cartão do preço
 * saindo de dentro. Tudo transform/opacity (nada de layout) e curto: 1,4 s.
 * Com "reduzir movimento" ligado, nasce aberta. */
const CaixaDePresente = ({ aberta, reduzir }: { aberta: boolean; reduzir: boolean }) => {
  const t = (delay: number, dur: number) => (reduzir ? { duration: 0 } : { delay, duration: dur, ease: [0.2, 0.9, 0.3, 1] as const });
  return (
    <motion.svg
      viewBox="0 0 220 200" width="220" height="200" aria-hidden
      initial={reduzir ? false : { scale: 0.6, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18 }}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="p69-caixa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2433" />
          <stop offset="1" stopColor="#16121c" />
        </linearGradient>
        <linearGradient id="p69-fita" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2559a" />
          <stop offset="1" stopColor="#c21f6b" />
        </linearGradient>
        <linearGradient id="p69-tampa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3346" />
          <stop offset="1" stopColor="#221c2b" />
        </linearGradient>
      </defs>
      {/* sombra no chão */}
      <ellipse cx="110" cy="188" rx="78" ry="9" fill="#16121c" opacity="0.12" />
      {/* corpo */}
      <motion.g
        initial={false}
        animate={aberta && !reduzir ? { rotate: [0, -2.5, 2.5, -1.5, 0] } : { rotate: 0 }}
        transition={reduzir ? { duration: 0 } : { delay: 0.35, duration: 0.5, ease: "easeInOut" }}
        style={{ transformOrigin: "110px 180px" }}
      >
        <rect x="40" y="86" width="140" height="96" rx="14" fill="url(#p69-caixa)" />
        <rect x="98" y="86" width="24" height="96" fill="url(#p69-fita)" />
        <rect x="40" y="118" width="140" height="18" fill="url(#p69-fita)" opacity="0.92" />
        {/* luz fina na borda */}
        <rect x="40.5" y="86.5" width="139" height="95" rx="13.5" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
      </motion.g>
      {/* o cartão que sai de dentro (só a luz dele; o cartão real é HTML) */}
      <motion.rect
        x="62" y="60" width="96" height="40" rx="8" fill="#ffffff"
        initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={aberta ? { opacity: [0, 0.9, 0], y: -30 } : { opacity: 0, y: 40 }}
        transition={t(0.95, 0.45)}
      />
      {/* tampa + laço */}
      <motion.g
        initial={false}
        animate={aberta ? { y: -46, rotate: -12, x: 10 } : { y: 0, rotate: 0, x: 0 }}
        transition={t(0.8, 0.45)}
        style={{ transformOrigin: "180px 86px" }}
      >
        <rect x="30" y="66" width="160" height="28" rx="10" fill="url(#p69-tampa)" />
        <rect x="98" y="66" width="24" height="28" fill="url(#p69-fita)" />
        <rect x="30.5" y="66.5" width="159" height="27" rx="9.5" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
        {/* laço */}
        <path d="M110 66 C 96 50, 72 48, 74 60 C 76 70, 98 68, 110 66 Z" fill="url(#p69-fita)" />
        <path d="M110 66 C 124 50, 148 48, 146 60 C 144 70, 122 68, 110 66 Z" fill="url(#p69-fita)" />
        <circle cx="110" cy="65" r="6" fill="#f0a3c7" />
      </motion.g>
      {/* faíscas */}
      {[[52, 54], [172, 48], [92, 30], [140, 24], [30, 100], [192, 108]].map(([x, y], i) => (
        <motion.circle
          key={i} cx={x} cy={y} r={i % 2 ? 2.2 : 3} fill={i % 3 === 0 ? "#f0a3c7" : "#d2297a"}
          initial={{ opacity: 0, scale: 0 }}
          animate={aberta ? { opacity: [0, 1, 0], scale: [0, 1.2, 0.6] } : { opacity: 0, scale: 0 }}
          transition={reduzir ? { duration: 0 } : { delay: 0.9 + i * 0.06, duration: 0.7 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </motion.svg>
  );
};

export function Presente69Folha({ lugar, oferta, onFechar, onSucesso }: {
  lugar: LugarDoPresente;
  oferta: OfertaDoPresente;
  /** "Agora não" (já marcado como visto). */
  onFechar: () => void;
  /** Folha fechou com sucesso e o acesso sincronizou (já marcado como visto). */
  onSucesso: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [aberta, setAberta] = useState(reduzir);
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    trackEvent("presente69_view", { lugar, preco: oferta.preco, de: oferta.precoDe, trial: oferta.comTrial });
    const t = window.setTimeout(() => { if (vivo.current) setAberta(true); }, reduzir ? 0 : 420);
    return () => { vivo.current = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fechar = () => {
    marcarVisto(lugar);
    trackEvent("presente69_fechou", { lugar });
    onFechar();
  };

  const comprar = async () => {
    if (comprando) return;
    setComprando(true);
    setErro(null);
    trackEvent("presente69_toque", { lugar });
    const rc = await import("@/lib/revenuecat");
    rc.marcarToqueDeCompra();
    const ok = await rc.comprarPresente69(lugar);
    if (!vivo.current) return;
    setComprando(false);
    if (ok) {
      marcarVisto(lugar);
      trackEvent("presente69_sucesso", { lugar, preco: oferta.preco });
      if (lugar === "cancelou_teste") {
        // o teste virou ano pago: o "acaba amanhã" não tem mais por quê
        try { (await import("@/lib/notificacoes")).cancelarLembreteDoTeste().catch(() => { /* noop */ }); } catch { /* noop */ }
      }
      onSucesso();
      return;
    }
    const motivo = rc.motivoUltimaCompra();
    trackEvent("presente69_falhou", { lugar, motivo });
    // fechou a folha = normal, sem alarde; o resto precisa de uma frase
    if (motivo === "cancelou" || motivo === null) return;
    if (motivo === "ja_ativo") setErro(erroJaAtivo());
    else if (motivo === "nao_permitido") setErro(erroNaoPermitido());
    else setErro(erroFolhaNaoConcluiu());
  };

  const mes = oferta.precoMes;
  const entra = reduzir ? { duration: 0 } : undefined;
  const cartao = reduzir
    ? { initial: false as const, animate: { opacity: 1, y: 0, scale: 1 } }
    : { initial: { opacity: 0, y: 28, scale: 0.92 }, animate: aberta ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 28, scale: 0.92 } };

  return (
    <div
      data-testid="presente69"
      data-lugar={lugar}
      data-aberta={aberta ? "1" : "0"}
      className="fixed inset-0 z-[320] overflow-y-auto"
      style={{ background: "linear-gradient(180deg,#fbf0f6 0%,#ffffff 52%)" }}
    >
      <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 pb-8 pt-[calc(var(--app-safe-top)+28px)]">
        <motion.div initial={reduzir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={entra} className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider">
            {lugar === "bloqueio" ? "Pra você voltar" : "Pra você ficar"}
          </span>
          <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.12] text-[#16121c] mt-3">
            {lugar === "bloqueio" ? <>Seu teste acabou.<br />Um presente pra voltar.</> : <>Antes de ir,<br />um presente.</>}
          </h1>
          <p className="text-[13.5px] text-[#4f5a64] mt-2.5 leading-snug">
            {lugar === "bloqueio"
              ? <>Tudo o que você construiu continua aqui. O ano inteiro{oferta.precoDe ? <> sai de <s>{oferta.precoDe}</s></> : null} por <b className="text-[#16121c]">{oferta.preco}</b>{mes ? <> — {mes} por mês</> : null}.</>
              : <>Você cancelou a renovação — tudo bem. Se quiser ficar, o ano inteiro{oferta.precoDe ? <> sai de <s>{oferta.precoDe}</s></> : null} por <b className="text-[#16121c]">{oferta.preco}</b>{mes ? <> — {mes} por mês</> : null}.</>}
          </p>
        </motion.div>

        <div className="grid place-items-center mt-2 -mb-2" aria-hidden>
          <CaixaDePresente aberta={aberta} reduzir={reduzir} />
        </div>

        <motion.div
          {...cartao}
          transition={reduzir ? { duration: 0 } : { delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-3xl bg-white border-2 border-accent p-5 shadow-[0_24px_48px_-18px_rgba(210,41,122,.35)]"
          data-testid="presente69-cartao"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-extrabold text-[#16121c]">CORE Anual</span>
            <span className="text-right">
              {oferta.precoDe && <s className="block text-[12px] font-bold text-[#8a93a0] leading-none">{oferta.precoDe}</s>}
              <span className="text-[24px] font-black tracking-tight text-[#16121c] leading-none">
                {oferta.preco}<small className="text-[12px] font-bold text-[#8a93a0]">/ano</small>
              </span>
            </span>
          </div>
          <p className="text-[12px] font-semibold text-[#4f5a64] mt-1.5">
            {mes ? <>{mes} por mês · </> : null}os 16 módulos, sem limite
          </p>
        </motion.div>

        <motion.p
          initial={reduzir ? false : { opacity: 0 }} animate={{ opacity: aberta ? 1 : 0 }} transition={reduzir ? { duration: 0 } : { delay: 0.25 }}
          className="text-[12px] text-[#4f5a64] text-center leading-snug mt-4"
          data-testid="presente69-regra"
        >
          {lugar === "cancelou_teste"
            ? <>Entra na hora: a App Store cobra <b className="text-[#16121c]">{oferta.preco}</b> hoje e troca o teste{oferta.fimMs ? <> (que iria até {dataCurta(oferta.fimMs)})</> : null} pelo ano inteiro, já liberado.</>
            : oferta.comTrial
              ? <>{oferta.dias} dias grátis, depois <b className="text-[#16121c]">{oferta.preco}</b> por ano pela App Store.</>
              : <>Cobrado hoje pela App Store: <b className="text-[#16121c]">{oferta.preco}</b>, sem teste grátis (você já usou o seu).</>}
        </motion.p>

        {erro && <p className="text-[12.5px] text-destructive text-center mt-3" role="alert">{erro}</p>}

        <div className="mt-auto pt-6">
          <motion.button
            initial={reduzir ? false : { opacity: 0, y: 10 }} animate={{ opacity: aberta ? 1 : 0, y: aberta ? 0 : 10 }} transition={reduzir ? { duration: 0 } : { delay: 0.3 }}
            disabled={comprando || !aberta}
            onClick={() => void comprar()}
            data-testid="presente69-cta"
            className="w-full min-h-[54px] rounded-full text-[16px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform grid place-items-center disabled:opacity-60"
          >
            {comprando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <span className="flex items-center gap-1.5">{lugar === "bloqueio" ? "Voltar com o presente" : "Quero o presente"} — {oferta.preco}/ano <ArrowRight className="w-4 h-4" /></span>}
          </motion.button>
          <p className="text-[10.5px] text-[#8a93a0] text-center mt-2 leading-snug">
            Assinatura pela App Store · renova automaticamente por {oferta.preco}/ano até você cancelar
          </p>
          <button
            onClick={fechar}
            disabled={comprando}
            data-testid="presente69-agora-nao"
            className="w-full text-center text-[13px] font-semibold text-[#4f5a64] mt-3 py-2"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O presente no BLOQUEIO: montado dentro do gate do TrialBanner (app nativo),
 * por cima do paywall de 97,90. Só iPhone, só quem perdeu o acesso depois de
 * já ter assinado/testado, nunca com cartão recusado, uma vez por pessoa.
 * "Agora não" tira a folha e o paywall de sempre fica embaixo, intacto.
 */
export const PresenteNoBloqueio = () => {
  const [oferta, setOferta] = useState<OfertaDoPresente | null>(null);
  useEffect(() => {
    let vivo = true;
    void prepararPresente("bloqueio").then((o) => { if (vivo && o) setOferta(o); }).catch(() => { /* paywall de sempre */ });
    return () => { vivo = false; };
  }, []);
  if (!oferta) return null;
  return (
    <Presente69Folha
      lugar="bloqueio"
      oferta={oferta}
      onFechar={() => setOferta(null)}
      onSucesso={() => { window.location.href = "/"; }}
    />
  );
};
