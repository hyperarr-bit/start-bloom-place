import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { Anel, BotaoSeguir, Confete, ContaSubindo, PostItDaMissao } from "@/components/demo-guiada/pecas";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { alvoDaMissao, gravacoesDoChip, itemDoChip, type AlvoDaMissao, type ChipDaMissao, type Numero } from "@/components/demo-guiada/alvos";
import { rotuloCurto } from "@/lib/demo-guiada";
import { HORAS_DO_LEMBRETE, MODULOS, eventoDaMissao, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao } from "@/lib/missao-doses";
import "./missao-doses.css";

/** O "Pular" da faixa só aparece depois disto (ou ao 2º toque na faixa) — seção 5 do estudo. */
export const PULAR_DEPOIS_DE_MS = 20_000;
export const TEMPOS_DO_PASSO = {
  antesDoAnel: 300,
  /** o chip vira ✓ e a linha aparece ANTES de a comemoração entrar (causa → efeito) */
  registrou: 550,
  /** o "olhar explicado" anda sozinho depois disso ("Entendi" adianta) */
  olhar: 15_000,
};

type Fase = "achar" | "anotar" | "registrou" | "olhar" | "festa";
export type ViaDoPulo = "link_boas_vindas" | "faixa_20s" | "toque_fora" | "passo";

const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
const significativo = (v: unknown): boolean => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v > 0;
  return !!v;
};
const tamanho = (v: unknown): number => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : typeof v === "number" ? v : significativo(v) ? 1 : 0);

/**
 * O PASSO DO DIA dentro do módulo de verdade (D3/D7 → olhar → D4): a faixa
 * grudada no topo ("Missão · dia 1 de 3 · Finanças"), o anel no botão de
 * adicionar com o post-it de chips (1 toque = um registro DE VERDADE na conta,
 * pelo mesmo `set` do módulo), o "olhar explicado" no resumo que recalculou
 * (Entendi / Pular este passo) e a comemoração com o de amanhã combinado.
 *
 * Nada aqui trava: o escuro do anel não intercepta toque (é a sombra do anel),
 * toque fora solta o anel (a instrução fica na faixa, com "mostrar onde"), o
 * "Pular" da faixa só aparece aos 20 s ou no 2º toque nela, e a missão escuta
 * o registro por qualquer caminho (chip, campo, quadradinho).
 */
export function PassoDoDia({ missao, n, modulo, hoje, aoFeito, aoPular, aoCombinar, aoAmanhaAgora, aoVerFim }: {
  missao: EstadoMissaoDoses;
  n: DiaDaMissao;
  modulo: ModuloDaMissao;
  hoje: string;
  aoFeito: (rotulo: string, segundos: number) => void;
  aoPular: (via: ViaDoPulo, passo: "toque" | "olhar", segundos: number) => void;
  aoCombinar: (lembrete: Lembrete) => void;
  aoAmanhaAgora: () => void;
  aoVerFim: () => void;
}) {
  const cfg = MODULOS[modulo];
  const alvoCfg: AlvoDaMissao | null = cfg.tipo ? alvoDaMissao(cfg.tipo) : null;
  const { get, set } = useUserData();
  const reduzir = !!useReducedMotion();
  const [fase, setFase] = useState<Fase>("achar");
  const faseRef = useRef<Fase>("achar");
  faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  const [acende, setAcende] = useState(0);
  const [perdeuAlvo, setPerdeuAlvo] = useState(false);
  const [tocado, setTocado] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [numero, setNumero] = useState<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  const [pularVisivel, setPularVisivel] = useState(false);
  const toquesNaFaixa = useRef(0);
  const viaRef = useRef<"chip" | null>(null);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);

  // a página desce a altura da faixa enquanto o passo está na tela
  useEffect(() => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "view" }));
    return () => { document.documentElement.removeAttribute("data-missao-doses-faixa"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Pular" na faixa: aos 20 s
  useEffect(() => {
    const t = window.setTimeout(() => setPularVisivel(true), PULAR_DEPOIS_DE_MS);
    return () => window.clearTimeout(t);
  }, []);

  /* ACHAR o botão de adicionar (a aba do módulo como reserva). Módulo pesado monta tarde: procura
   * a cada 300 ms por ~5 s; não achou → segue só com a faixa e o post-it solto (fail-open). */
  useEffect(() => {
    if (fase !== "achar") return;
    let vivo = true;
    let tentativas = 0;
    let tocouAba = false;
    const timers: number[] = [];
    const passos = alvoCfg?.passos ?? (cfg.seletor ? [{ seletor: cfg.seletor }] : []);
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      const [principal, ...reservas] = passos;
      const el = principal ? document.querySelector(principal.seletor) : null;
      if (el && visivel(el)) {
        setAlvo(alvoCfg?.anel ? alvoCfg.anel(el) : el);
        setAnelVivo(true);
        setFase("anotar");
        return;
      }
      const aba = reservas.find((p) => p.aba && document.querySelector(p.seletor));
      if (aba && !tocouAba) { tocouAba = true; document.querySelector<HTMLElement>(aba.seletor)?.click(); }
      if (++tentativas >= 17 || !principal) { setFase("anotar"); return; }
      timers.push(window.setTimeout(procurar, 300));
    };
    timers.push(window.setTimeout(procurar, reduzir ? 100 : TEMPOS_DO_PASSO.antesDoAnel));
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* O REGISTRO: a missão escuta as chaves do módulo na conta dela. Algo novo numa chave = o toque
   * aconteceu (chip, campo ou quadradinho — qualquer caminho). O número do "olhar" é lido AGORA. */
  const anterior = useRef<Record<string, unknown> | null>(null);
  const assinatura = cfg.chaves.map((k) => { try { return JSON.stringify(get<unknown>(k, undefined) ?? null); } catch { return ""; } }).join("|");
  useEffect(() => {
    if (!anterior.current) {
      anterior.current = Object.fromEntries(cfg.chaves.map((k) => [k, get<unknown>(k, undefined)]));
      return;
    }
    for (const k of cfg.chaves) {
      const valor = get<unknown>(k, undefined);
      const ant = anterior.current[k];
      let mudou = false;
      try { mudou = JSON.stringify(valor ?? null) !== JSON.stringify(ant ?? null); } catch { mudou = valor !== ant; }
      if (!mudou) continue;
      anterior.current[k] = valor;
      const f = faseRef.current;
      if (f !== "achar" && f !== "anotar") continue;
      let rot: string | null = null;
      let num: Numero | null = null;
      let via: string = "digitado";
      if (alvoCfg) {
        try {
          const achado = alvoCfg.achar(k, valor, ant, (kk) => get<unknown>(kk, undefined));
          if (!achado) continue;
          rot = rotuloCurto(achado.item);
          via = viaRef.current === "chip" ? "chip" : achado.via;
          try { num = alvoCfg.numero(k, valor, ant, achado.item); } catch { num = null; }
        } catch { continue; }
      } else {
        // sem tipo da demo: vale "entrou algo novo" (lista/objeto cresceu ou passou a existir)
        if (!significativo(valor) || tamanho(valor) <= tamanho(ant)) continue;
        rot = `${cfg.toque} anotado`;
        via = "modulo";
      }
      faseRef.current = "registrou";
      setRotulo(rot);
      setNumero(num);
      setFase("registrou");
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "feito", via, segundos: segundos() }));
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  /* REGISTROU → o chip ficou ✓ e a linha apareceu; depois, o OLHAR (ou direto a festa). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const t = window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      const el = alvoCfg?.olhar?.achar() ?? null;
      if (el && visivel(el)) {
        setOlharEm(el);
        setFase("olhar");
        trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view" }));
      } else {
        setFase("festa");
      }
    }, reduzir ? 150 : TEMPOS_DO_PASSO.registrou);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  useEffect(() => {
    if (fase !== "festa") return;
    aoFeito(rotulo, segundos());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* CHIPS — 1 toque grava NA CONTA pelo mesmo `set` do módulo, no formato que ele já lê (alvos.ts). */
  const tocarChip = (chip: ChipDaMissao) => {
    if (!cfg.tipo) return;
    const item = itemDoChip(cfg.tipo, chip);
    trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: chip.nome, valor: chip.valor, ok: !!item }));
    if (!item) return;
    viaRef.current = "chip";
    setTocado(chip.nome);
    try {
      for (const g of gravacoesDoChip(item, chip)) {
        const proximo = g.proximo(get<unknown>(g.chave, undefined));
        if (proximo === undefined) continue;
        set(g.chave, proximo);
      }
    } catch { /* a missão nunca derruba o módulo */ }
  };
  const escreverOMeu = () => {
    trackEvent("missao_doses_escrever", eventoDaMissao({ dia: n, modulo }));
    const campo = alvo?.querySelector<HTMLInputElement>("input, textarea");
    try { campo?.focus(); } catch { /* noop */ }
  };

  const pularPelaFaixa = () => aoPular("faixa_20s", faseRef.current === "olhar" ? "olhar" : "toque", segundos());
  const toqueNaFaixa = () => {
    toquesNaFaixa.current += 1;
    if (toquesNaFaixa.current >= 2) setPularVisivel(true);
  };
  const mostrarOnde = () => { setPerdeuAlvo(false); setAcende((x) => x + 1); setAnelVivo(true); };
  const entendi = useCallback((via: "botao" | "auto") => {
    if (faseRef.current !== "olhar") return;
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "feito", via }));
    setFase("festa");
  }, [n, modulo]);
  const pularOlhar = () => {
    if (faseRef.current !== "olhar") return;
    aoPular("passo", "olhar", segundos());
    setFase("festa");
  };

  const feitos = ([1, 2, 3] as DiaDaMissao[]).filter((k) => missao.feitos[k] || (k === n && fase === "festa")).length;
  const faixa = (
    <div className="md-faixa" data-testid="missao-doses-faixa" data-fase={fase} onClick={toqueNaFaixa} role="presentation">
      <span className="md-faixa-quadros" aria-label={`${feitos} de 3 feitos`} role="img">
        {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitos} claro tam={14} />)}
      </span>
      <span className="md-faixa-titulo">Missão · dia {n} de 3 · <b>{cfg.nome}</b></span>
      {perdeuAlvo && fase === "anotar" && (
        <button type="button" className="md-faixa-onde" data-testid="missao-doses-onde" onClick={(e) => { e.stopPropagation(); mostrarOnde(); }}>mostrar onde</button>
      )}
      {pularVisivel && fase !== "festa" && (
        <button type="button" className="md-faixa-pular" data-testid="missao-doses-pular" onClick={(e) => { e.stopPropagation(); pularPelaFaixa(); }}>Pular</button>
      )}
    </div>
  );

  const postIt = (
    <PostItDaMissao
      rotulo="Agora · 1 toque"
      pergunta={alvoCfg?.pergunta ?? cfg.pedido}
      descricao={cfg.tipo === "gasto" ? "Toca num pronto ou escreve o seu. Cada gasto entra na linha de cima e o mês soma sozinho." : cfg.tipo === "habito" ? "Toca num quadradinho da linha de HOJE." : undefined}
      chips={alvoCfg?.chips ?? []}
      tocado={tocado}
      aoChip={tocarChip}
      aoEscrever={alvoCfg?.escrever ? escreverOMeu : undefined}
      dica={alvoCfg?.chips.length && alvoCfg.escrever ? "Ou escreve o seu ali no campo e toca no +." : undefined}
    />
  );

  return (
    <>
      {createPortal(faixa, document.body)}
      <AnimatePresence>
        {anelVivo && alvo && (fase === "anotar" || fase === "registrou") && (
          <Anel
            key={`anotar-${acende}`} interativo duracao={60_000} alvo={alvo} testid="missao-doses-anel" abaixo={!!alvoCfg?.postItAbaixo}
            aoSair={(motivo) => {
              setAnelVivo(false);
              if (faseRef.current !== "anotar") return;
              setPerdeuAlvo(true);
              if (motivo === "toque_fora") aoPular("toque_fora", "toque", segundos());
              else trackEvent("missao_doses_anel_saiu", eventoDaMissao({ dia: n, modulo, motivo }));
            }}
            balao={postIt}
          />
        )}
        {!alvo && fase === "anotar" && createPortal(
          <motion.div key="postit-solto" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 64px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="missao-doses-postit-solto">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{postIt}</div>
          </motion.div>,
          document.body,
        )}
        {fase === "olhar" && olharEm && (
          <Anel
            key="olhar" fixo interativo alvo={olharEm} recorte={alvoCfg?.olhar?.recorte} duracao={TEMPOS_DO_PASSO.olhar} testid="missao-doses-anel-olhar"
            aoSair={() => entendi("auto")}
            balao={(
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="missao-doses-olhar">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">Olha · 1 de 1</span>
                <span className="block text-[15px] font-extrabold leading-snug">{cfg.olhar.titulo}</span>
                <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{cfg.olhar.texto}</span>
                {numero && (
                  <span className="flex items-baseline gap-2 mt-2">
                    <span className="text-[12px] text-white/50">{numero.titulo}:</span>
                    <span className="text-[13px] text-white/50 line-through tabular-nums">{numero.formatar(numero.antes)}</span>
                    <span className="text-white/50 text-[13px]">→</span>
                    <span className="text-[22px] font-black tracking-tight leading-none"><ContaSubindo de={numero.antes} para={numero.depois} formatar={numero.formatar} /></span>
                  </span>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <BotaoSeguir claro onClick={() => entendi("botao")} testid="missao-doses-entendi">Entendi</BotaoSeguir>
                  <button type="button" className="text-[12.5px] font-semibold text-white/70 underline underline-offset-2 min-h-10" data-testid="missao-doses-pular-passo" onClick={pularOlhar}>Pular este passo</button>
                </div>
              </div>
            )}
          />
        )}
        {fase === "festa" && (
          <ComemoracaoDoDia
            key="festa"
            n={n}
            missao={missao}
            modulo={modulo}
            rotulo={rotulo}
            hoje={hoje}
            aoCombinar={aoCombinar}
            aoAmanhaAgora={aoAmanhaAgora}
            aoVerFim={aoVerFim}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * A COMEMORAÇÃO DO DIA (D4): "Dia 1 da missão ✓ · Primeiro registro feito!",
 * o que ela fez já está no módulo + a explicação, a barra 1/3, e o de AMANHÃ
 * combinado com a hora do lembrete. "Combinado, até amanhã" fecha; "Quero
 * fazer o toque de amanhã agora" leva pro próximo módulo. No dia 3: "Ver o que
 * você construiu".
 */
function ComemoracaoDoDia({ n, missao, modulo, rotulo, aoCombinar, aoAmanhaAgora, aoVerFim }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoAmanhaAgora: () => void; aoVerFim: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const cfg = MODULOS[modulo];
  const proximo = n === 1 ? MODULOS[missao.modulos[1]] : n === 2 ? MODULOS[missao.modulos[2]] : null;
  const [hora, setHora] = useState<Lembrete>(missao.lembrete ?? "12h");
  const titulo = n === 1 ? "Primeiro registro feito!" : n === 2 ? "Dia 2 feito!" : "Missão cumprida!";
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center px-4 pb-6 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.55)" }} data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <Confete />
      <motion.div
        initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 text-center text-[#16121c] shadow-2xl"
      >
        <span className="inline-block rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5">🔥 Dia {n} da missão ✓</span>
        <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-2.5">{titulo}</p>
        <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
          {cfg.emoji} <b className="text-[#16121c]">{rotulo}</b> já está {cfg.onde}. {cfg.olhar.texto}
        </p>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-3.5">
          <motion.div className="h-full rounded-full bg-emerald-500" initial={reduzir ? false : { width: `${Math.round(((n - 1) / 3) * 100)}%` }} animate={{ width: `${Math.round((n / 3) * 100)}%` }} transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">Missão dos 3 dias · {n} de 3 toques</p>

        {proximo ? (
          <>
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-amanha">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Amanhã · {proximo.emoji} {proximo.nome}</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">{proximo.pedido}</span>
              <span className="block text-[12px] text-[#4f5a64] mt-1.5">Te lembro às:</span>
              <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label="Hora do lembrete">
                {HORAS_DO_LEMBRETE.map((h) => (
                  <button key={h.id} type="button" role="radio" aria-checked={hora === h.id} className="md-hora" data-marcada={hora === h.id ? "" : undefined} data-sem={h.id === "sem" ? "" : undefined} data-testid={`missao-doses-hora-${h.id}`} onClick={() => setHora(h.id)}>{h.rotulo}</button>
                ))}
              </div>
            </div>
            <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-combinado" onClick={() => aoCombinar(hora)}>
              Combinado, até amanhã
            </button>
            <button type="button" className="md-link" data-testid="missao-doses-amanha-agora" onClick={aoAmanhaAgora}>Quero fazer o toque de amanhã agora</button>
          </>
        ) : (
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={aoVerFim}>
            Ver o que você construiu <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
