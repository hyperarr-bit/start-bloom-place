import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import type { EstadoVazioConfig, OpcaoDaIntro } from "@/lib/intro-modulo";
import { abrirAba } from "@/components/cartoes-modulo/registro";
import "./intro-modulo.css";

/**
 * ESTADO VAZIO COM CAPTURA REAL (16/10) — o padrão pros módulos que NÃO levam a intro guiada:
 * um card inline no topo do módulo (onde o "Dicas para começar" ficava), com
 *   · a faixa de planner (caixa alta, cor do módulo) e "Pular";
 *   · uma captura REAL do módulo em uso (vídeo de ~6 s, mudo, em loop, gravado do app no tema
 *     da pessoa — claro ou escuro; embarcado em public/intro, nada vem da rede), com o poster
 *     por cima até o 1º quadro tocar (1º quadro lento, Modo Pouca Energia do iPhone que nega o
 *     autoplay: fica o poster, e o toque na mídia tenta de novo);
 *   · uma frase e UMA ação de 1 toque: um botão que grava um começo pronto, 3 chips em que
 *     cada um grava o que a pessoa escolheu, ou (quando o conteúdo é da pessoa) o toque que abre
 *     o campo real do módulo. Depois de gravar, a aba certa abre e o card sai de cena.
 *
 * Eventos: modulo_intro_vista {modulo, formato:"vazio", tema} · modulo_intro_acao {modulo, via:
 * "botao"|"chip"|"foco", opcao} · modulo_intro_concluida {modulo, segundos} ·
 * modulo_intro_pulou {modulo, fase:"vazio", segundos}.
 */
export const TEMPOS_DO_VAZIO = { feito: 650, depois: 60 };

/** O tema do app agora (a classe .dark no <html>), acompanhando a troca. */
export function useTemaEscuro(): boolean {
  const ler = () => { try { return document.documentElement.classList.contains("dark"); } catch { return false; } };
  const [escuro, setEscuro] = useState(ler);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => setEscuro(ler()));
    try { obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch { /* noop */ }
    return () => obs.disconnect();
  }, []);
  return escuro;
}

export function EstadoVazio({ config, aoTerminar }: { config: EstadoVazioConfig; aoTerminar: (como: "feita" | "pulada") => void }) {
  const { get, set } = useUserData();
  const reduzir = !!useReducedMotion();
  const escuro = useTemaEscuro();
  const video = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);
  const timers = useRef<number[]>([]);
  const m = config.moduleId;
  const src = escuro ? config.midia.video.escuro : config.midia.video.claro;
  const poster = escuro ? config.midia.poster.escuro : config.midia.poster.claro;

  useEffect(() => {
    trackEvent("modulo_intro_vista", { modulo: m, formato: "vazio", tema: escuro ? "escuro" : "claro", acao: config.acao.tipo });
    return () => timers.current.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tocar = () => { try { const p = video.current?.play(); if (p && typeof p.catch === "function") p.catch(() => { /* fica o poster */ }); } catch { /* noop */ } };
  // o tema trocou: o vídeo remonta (key=src) e o poster volta por cima até o 1º quadro tocar
  useEffect(() => { setTocando(false); tocar(); }, [src]);

  const gravar = (k: string, v: unknown) => { set(k, v); avisarEscritaDeFora(k, v); };
  const concluir = (via: "botao" | "chip", opcao?: OpcaoDaIntro) => {
    if (feito) return;
    trackEvent("modulo_intro_acao", { modulo: m, via, opcao: opcao?.id });
    try {
      if (config.acao.tipo === "botao") config.acao.executar({ get, gravar });
      else if (config.acao.tipo === "chips" && opcao) config.acao.executar({ get, gravar }, opcao);
    } catch { /* a intro nunca derruba o módulo */ }
    if (config.aba) abrirAba(config.aba);
    setFeito(opcao?.id ?? "botao");
    trackEvent("modulo_intro_concluida", { modulo: m, via, segundos: segundos() });
    const depois = config.depois;
    timers.current.push(window.setTimeout(() => {
      aoTerminar("feita");
      // o "depois" (abrir o dia de hoje, rolar até a lista) roda com o card JÁ FORA da tela — antes, o card saindo
      // empurrava a página pra cima e a rolagem acabava num lugar errado. Fora da lista de timers: o card já desmontou.
      if (depois) window.setTimeout(() => { try { depois(); } catch { /* a intro nunca derruba o módulo */ } }, TEMPOS_DO_VAZIO.depois);
    }, reduzir ? 0 : TEMPOS_DO_VAZIO.feito));
  };
  const focar = () => {
    if (config.acao.tipo !== "foco") return;
    trackEvent("modulo_intro_acao", { modulo: m, via: "foco" });
    if (config.aba) abrirAba(config.aba);
    // tudo síncrono, dentro do toque: no iPhone o teclado só abre por foco dado na própria ação da pessoa
    try {
      config.acao.abrir?.();
      const campo = document.querySelector<HTMLElement>(config.acao.seletor);
      campo?.scrollIntoView?.({ block: "center", behavior: reduzir ? "auto" : "smooth" });
      campo?.focus?.();
    } catch { /* sem campo: a pessoa está no módulo, no lugar certo */ }
    trackEvent("modulo_intro_concluida", { modulo: m, via: "foco", segundos: segundos() });
    aoTerminar("feita");
  };
  const pular = () => { trackEvent("modulo_intro_pulou", { modulo: m, fase: "vazio", segundos: segundos() }); aoTerminar("pulada"); };

  const { acao } = config;
  return (
    <section className="im-vazio mb-4" data-testid="intro-modulo-vazio" data-modulo={m} data-camada-guia="intro-modulo" data-feito={feito ? "1" : undefined} aria-label={`Primeira vez: ${config.nome}`} style={{ ["--im-acento" as string]: config.cor.acento }}>
      <div className="im-vazio-faixa" style={{ background: config.cor.faixa, color: config.cor.tinta }}>
        <span>Primeira vez · {config.nome}</span>
        <button type="button" className="im-vazio-fechar" data-testid="intro-modulo-pular" onClick={pular}>Pular</button>
      </div>
      <div className="im-vazio-corpo">
        <button type="button" className="im-vazio-midia" aria-label={config.midia.alt} data-tocando={tocando ? "1" : undefined} onClick={tocar}>
          <video key={src} ref={video} src={src} poster={poster} muted loop playsInline autoPlay preload="auto" aria-hidden="true" data-testid="intro-modulo-video"
            onPlaying={() => setTocando(true)} onPause={() => setTocando(false)} />
          <img className="im-vazio-poster" src={poster} alt="" aria-hidden="true" draggable={false} data-testid="intro-modulo-poster" />
        </button>
        <div className="im-vazio-texto-col">
          <h3 className="im-vazio-titulo">{config.titulo}</h3>
          <p className="im-vazio-texto">{config.texto}</p>
          {acao.tipo === "botao" && (
            <button type="button" className="im-vazio-acao" data-testid="intro-modulo-acao" data-feito={feito ? "1" : undefined} onClick={() => concluir("botao")}>
              {feito ? <Check className="w-4 h-4" strokeWidth={3} /> : <Plus className="w-4 h-4" strokeWidth={3} />}<span>{feito ? "Pronto" : acao.rotulo}</span>
            </button>
          )}
          {acao.tipo === "foco" && (
            <button type="button" className="im-vazio-acao" data-testid="intro-modulo-acao" onClick={focar}>
              <Plus className="w-4 h-4" strokeWidth={3} /><span>{acao.rotulo}</span>
            </button>
          )}
          {acao.tipo === "chips" && (
            <>
              <p className="im-vazio-pergunta">{acao.pergunta}</p>
              <div className="im-vazio-chips" role="group" aria-label={acao.pergunta}>
                {acao.opcoes.map((o) => (
                  <button key={o.id} type="button" className="im-vazio-chip" data-testid="intro-modulo-chip" data-opcao={o.id} data-feito={feito === o.id ? "1" : undefined} aria-pressed={feito === o.id} disabled={!!feito && feito !== o.id} onClick={() => concluir("chip", o)}>
                    <span aria-hidden="true">{feito === o.id ? "✓" : o.emoji}</span> {o.rotulo}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="im-vazio-detalhe">{acao.detalhe}</p>
        </div>
      </div>
    </section>
  );
}
