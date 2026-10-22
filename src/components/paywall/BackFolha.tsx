/**
 * A TELA DO BACK (21/10) — o que aparece quando a pessoa aperta VOLTAR na oferta ou no Pix gerado dos funis web
 * (/inicio e /hoje). Mesmo estilo do presente do iPhone (Presente69: chip, caixa, cartão magenta, botão grafite,
 * saída em texto), mas SEM mudar o preço: a mesma oferta de R$ 27,90, ou o MESMO Pix (nada de Pix novo).
 * Mecânica do voltar e chave em src/lib/back-funil.ts.
 *
 *   oferta: "Quero meu CORE" → o Pix de sempre (quem chama decide) · "Sair mesmo assim" → o voltar de verdade
 *   pix:    "Copiar código Pix" → copia o MESMO código e volta pra tela do Pix · "Sair mesmo assim" → o voltar
 *   Esc (teclado) = fica (fecha a tela). Apertar voltar DE NOVO com ela aberta = sai (não há segundo degrau).
 */
import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy } from "lucide-react";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import type { EtapaDoBack, FunilDoBack, VarianteDoBack } from "@/lib/back-funil";
import { CaixaDePresente } from "./CaixaDePresente";

type TextoDoBack = { chip: string; titulo: string; sub?: string; itens?: string[]; miudo: string; cta: string };

export const COPY_DO_BACK: Record<EtapaDoBack, Record<VarianteDoBack, TextoDoBack>> = {
  oferta: {
    a: {
      chip: "Antes de ir",
      titulo: "Espera, seu CORE pra sempre ainda tá aqui",
      itens: ["Os 16 módulos, nada bloqueado", "No celular e no computador", "Garantia de 7 dias"],
      miudo: "Pix · acesso na hora · sem mensalidade",
      cta: "Quero meu CORE",
    },
    b: {
      chip: "Antes de ir",
      titulo: "Sua vida organizada, sem mensalidade",
      itens: ["Finanças, rotina, treino e mais 13 áreas", "No celular e no computador", "Não gostou em 7 dias? Devolvemos"],
      miudo: "Pix · acesso na hora",
      cta: "Quero meu CORE",
    },
  },
  pix: {
    a: {
      chip: "Seu Pix está pronto",
      titulo: "Espera, seu Pix continua valendo",
      sub: "Copie, cole no app do banco e o CORE é seu pra sempre",
      miudo: "O acesso libera sozinho quando o Pix cair",
      cta: "Copiar código Pix",
    },
    b: {
      chip: "Seu Pix está pronto",
      titulo: "Falta só colar o Pix",
      sub: "É o mesmo código de antes. Leva 1 minuto",
      miudo: "O acesso libera sozinho quando o Pix cair",
      cta: "Copiar código Pix",
    },
  },
};

const PixSelo = () => (
  <div className="w-[84px] h-[84px] rounded-[26px] grid place-items-center shadow-[0_18px_36px_-12px_rgba(210,41,122,.55)]" style={{ background: "linear-gradient(135deg,#e2559a,#c21f6b)" }} aria-hidden>
    <svg width="40" height="40" viewBox="0 0 24 24">
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="#fff" strokeWidth="2.2" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="#fff" />
    </svg>
  </div>
);

export function BackFolha({ funil, etapa, variante, preco, codigo, validade, extra, onQuero, onFicar, onSair }: {
  funil: FunilDoBack;
  etapa: EtapaDoBack;
  variante: VarianteDoBack;
  /** "27,90" — o MESMO preço da tela de baixo */
  preco: string;
  /** pix: o código copia-e-cola já gerado */
  codigo?: string | null;
  /** pix: "24:13" (quanto falta pro código vencer) */
  validade?: string | null;
  /** o que mais vai nos eventos (ids do funil) */
  extra?: Record<string, unknown>;
  /** oferta: abrir o Pix · pix: copiar o código. Chamado DENTRO do toque (o clipboard exige). */
  onQuero: () => void;
  /** fechar e ficar na tela de baixo */
  onFicar: () => void;
  /** "Sair mesmo assim" — quem chama faz o voltar de verdade */
  onSair: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const c = COPY_DO_BACK[etapa][variante];
  const idTitulo = useId();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const decidiu = useRef(false);
  const base = () => ({ funil, etapa, variante, ...(extra ?? {}) });
  const baseRef = useRef(base);
  baseRef.current = base;

  // vista + foco no título (leitor de tela lê o porquê da tela) + devolve o foco ao sair
  useEffect(() => {
    trackEvent("back_view", baseRef.current());
    const antes = document.activeElement as HTMLElement | null;
    try { tituloRef.current?.focus({ preventScroll: true }); } catch { /* noop */ }
    // apertou voltar de novo / fechou a aba com a tela aberta = saiu (o próximo voltar não tem degrau)
    const aoFechar = () => {
      if (decidiu.current) return;
      decidiu.current = true;
      trackEventBeacon("back_saiu", { ...baseRef.current(), via: "fechou_pagina" });
    };
    window.addEventListener("pagehide", aoFechar);
    return () => {
      window.removeEventListener("pagehide", aoFechar);
      if (!decidiu.current) {
        decidiu.current = true;
        trackEventBeacon("back_saiu", { ...baseRef.current(), via: "voltar_de_novo" });
      }
      try { antes?.focus?.({ preventScroll: true }); } catch { /* noop */ }
    };
  }, []);

  const ficar = (acao: "quero" | "copiou" | "fechou") => {
    if (decidiu.current) return;
    decidiu.current = true;
    trackEvent("back_ficou", { ...base(), acao });
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { ficar("fechou"); onFicar(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFicar]);

  const entra = (i: number) => (reduzir ? { initial: false as const } : {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 + i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      data-testid="back-folha"
      data-funil={funil}
      data-etapa={etapa}
      data-variante={variante}
      className="fixed inset-0 z-[450] overflow-y-auto text-[#16121c]"
      style={{ background: "linear-gradient(180deg,#fbf0f6 0%,#ffffff 52%)", fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}
    >
      <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 pb-7 pt-[max(40px,calc(env(safe-area-inset-top)+28px))]">
        <motion.div {...entra(0)} className="text-center">
          <span className="inline-flex px-3 py-1 rounded-full bg-[rgba(210,41,122,.1)] text-[#d2297a] text-[11px] font-extrabold uppercase tracking-[0.08em]">
            {c.chip}
          </span>
          <h1 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-[27px] font-black tracking-[-0.03em] leading-[1.12] mt-3 outline-none">
            {c.titulo}
          </h1>
          {c.sub && <p className="text-[14px] text-[#4f5a64] leading-snug mt-2">{c.sub}</p>}
        </motion.div>

        <div className={`grid place-items-center ${etapa === "pix" ? "my-5" : "mt-3 -mb-1"}`} aria-hidden>
          {etapa === "pix" ? <PixSelo /> : <CaixaDePresente aberta reduzir={reduzir} largura={150} />}
        </div>

        <motion.div {...entra(1)} className="rounded-3xl bg-white border-2 border-[#d2297a] px-5 py-[18px] shadow-[0_24px_48px_-18px_rgba(210,41,122,.35)]" data-testid="back-cartao">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-extrabold">{etapa === "pix" ? "Pix do CORE" : "CORE pra sempre"}</span>
            <span className="text-[30px] font-black tracking-[-0.02em] leading-none" data-testid="back-preco">
              <small className="text-[14px] font-extrabold text-[#8a93a0] mr-0.5">R$</small>{preco}
            </span>
          </div>
          {etapa === "pix" ? (
            <>
              {codigo && (
                <div className="mt-3 font-mono text-[11px] text-[#6b6470] bg-[#f6f3f7] rounded-xl px-3 py-2.5 whitespace-nowrap overflow-hidden text-ellipsis" data-testid="back-codigo">
                  {codigo}
                </div>
              )}
              {validade && (
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#16a34a] mt-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] shadow-[0_0_0_4px_rgba(22,163,74,.15)]" aria-hidden />
                  Vale por mais {validade}
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] font-bold text-[#4f5a64] mt-1.5">Pague 1x, é seu pra sempre</p>
          )}
        </motion.div>

        {c.itens && (
          <motion.ul {...entra(2)} className="mt-[18px] flex flex-col gap-2.5 px-1">
            {c.itens.map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[#2b2533]">
                <span className="w-5 h-5 rounded-full bg-[rgba(210,41,122,.12)] grid place-items-center shrink-0" aria-hidden>
                  <Check className="w-3 h-3 text-[#d2297a]" strokeWidth={3.5} />
                </span>
                {t}
              </li>
            ))}
          </motion.ul>
        )}

        <div className="mt-auto pt-6">
          <button
            onClick={() => { ficar(etapa === "pix" ? "copiou" : "quero"); onQuero(); }}
            data-testid="back-quero"
            className="w-full min-h-[56px] rounded-full text-[16.5px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform flex items-center justify-center gap-2"
          >
            {etapa === "pix" ? <><Copy className="w-[18px] h-[18px]" aria-hidden />{c.cta}</> : <>{c.cta}<ArrowRight className="w-4 h-4" aria-hidden /></>}
          </button>
          <p className="text-[11.5px] text-[#8a93a0] text-center mt-2">{c.miudo}</p>
          <button
            onClick={() => {
              if (!decidiu.current) { decidiu.current = true; trackEvent("back_saiu", { ...base(), via: "botao" }); }
              onSair();
            }}
            data-testid="back-sair"
            className="w-full text-center text-[13.5px] font-semibold text-[#4f5a64] mt-2.5 py-2"
          >
            Sair mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}
