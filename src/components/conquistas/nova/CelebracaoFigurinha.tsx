import { textoConquistado } from "../textos-figurinhas";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Share2, X } from "lucide-react";
import { categoriaDe, raridadeDe, type Badge } from "@/components/gamification/types";
import { trackEvent } from "@/lib/analytics";
import { AdesivoRaro } from "../adesivos-raridade";
import { IconeMarcaAlbum } from "../IconeMarcaAlbum";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import "./celebracao-figurinha.css";

export const DURACAO_COMUM_MS = 6000;
const ROTULOS = { comum: "Comum", raro: "Rara", epico: "Épica", lendario: "Lendária" };
const CHAMADAS = { comum: "Uma conquista sua", raro: "Essa merece um lugar especial", epico: "Uma história pra guardar", lendario: "Uma conquista extraordinária" };

export interface PropsCelebracaoFigurinha {
  badge: Badge;
  primeira?: boolean;
  quantidade?: number;
  onColar?: () => void;
  onFechar?: () => void;
  marco?: { dias: number; protetor: boolean };
  onCompartilhar?: () => unknown;
}

/** O recorte da arte permanece intacto. O papel e a luz pertencem à chegada. */
export function CelebracaoFigurinha({ badge, primeira = false, quantidade = 1, onColar, onFechar, marco, onCompartilhar }: PropsCelebracaoFigurinha) {
  const raridade = raridadeDe(badge);
  const tipo = primeira ? "primeira" : marco ? (marco.dias >= 100 ? "lendario" : marco.dias >= 30 ? "epico" : "raro") : raridade;
  const compacta = tipo === "comum";
  // a cena cobre a tela inteira (fixed inset-0): a faixa do relógio não fica branca por cima dela (mesma régua do álbum, 1.0.18)
  useFaixaDoRelogioTransparente(!compacta);
  const reduzir = useReducedMotion();
  const tituloId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const focoInicial = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onColar, onFechar, onCompartilhar });
  callbacks.current = { onColar, onFechar, onCompartilhar };
  const fechado = useRef(false);
  const abriu = useRef(Date.now());
  const [pausado, setPausado] = useState(false);
  const [oculto, setOculto] = useState(() => document.visibilityState === "hidden");
  const [compartilhando, setCompartilhando] = useState(false);
  const [erroShare, setErroShare] = useState(false);
  const encerrar = (acao: "colar" | "continuar" | "tempo") => {
    if (fechado.current) return;
    fechado.current = true;
    trackEvent("festa_fechada", { id: badge.id, raridade, formato: compacta ? "toast" : tipo === "raro" ? "cartao" : "tela_cheia", primeira, como: acao, ms: Date.now() - abriu.current });
    if (acao === "colar") callbacks.current.onColar?.();
    else callbacks.current.onFechar?.();
  };
  const encerrarRef = useRef(encerrar);
  encerrarRef.current = encerrar;

  useEffect(() => {
    trackEvent("festa_view", { id: badge.id, raridade, primeira, quantidade, formato: compacta ? "toast" : tipo === "raro" ? "cartao" : "tela_cheia", versao: "papel" });
  }, [badge.id, raridade, primeira, quantidade, compacta, tipo]);

  // O aviso não rouba o foco nem desaparece enquanto está sendo lido/usado.
  useEffect(() => {
    const visibilidade = () => setOculto(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibilidade);
    return () => document.removeEventListener("visibilitychange", visibilidade);
  }, []);
  useEffect(() => {
    if (!compacta || !onFechar || pausado || oculto) return;
    const t = setTimeout(() => encerrarRef.current("tempo"), DURACAO_COMUM_MS);
    return () => clearTimeout(t);
  }, [compacta, !!onFechar, pausado, oculto, badge.id]);

  useEffect(() => {
    if (compacta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focoInicial.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (document.querySelector(".share-fig")) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); encerrarRef.current("continuar"); }
      if (e.key !== "Tab") return;
      const botoes = Array.from(raiz.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const primeiro = botoes[0], ultimo = botoes[botoes.length - 1];
      if (!primeiro) return;
      if (e.shiftKey && (document.activeElement === primeiro || !raiz.current?.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !raiz.current?.contains(document.activeElement))) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", tecla, true);
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [compacta]);

  const compartilhar = async () => {
    if (compartilhando) return;
    setCompartilhando(true); setErroShare(false);
    try { await callbacks.current.onCompartilhar?.(); }
    catch { setErroShare(true); }
    finally { setCompartilhando(false); }
  };
  const nome = marco ? `${marco.dias} dias seguidos!` : badge.name;
  const nParticulas = tipo === "lendario" ? 24 : tipo === "epico" ? 18 : tipo === "primeira" ? 12 : 8;
  return (
    <motion.div ref={raiz} className="cf-chegada" data-tipo={tipo} data-reduzir={reduzir ? "" : undefined}
      data-testid={compacta ? "cn-toast" : marco ? "cn-festa" : "momento-adesivo"}
      data-celebracao="papel" data-momento="" data-raridade={raridade} data-primeira={primeira ? "" : undefined} data-quantidade={quantidade}
      role={compacta ? "region" : "dialog"} aria-modal={compacta ? undefined : true} aria-labelledby={tituloId}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzir ? 0 : .18 }}
      onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(!!raiz.current?.contains(document.activeElement))}
      onFocusCapture={() => setPausado(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPausado(false); }}
      onKeyDown={compacta ? e => { if (e.key === "Escape") encerrar("continuar"); } : undefined}>
      <div className="cf-cartao">
        <button className="cf-fechar" aria-label="Guardar para depois" onClick={() => encerrar("continuar")}><X size={20} /></button>
        <div className="cf-corpo">
          {!compacta && <p className="cf-abertura">{primeira ? "Seu álbum começou" : marco ? "Um dia de cada vez" : CHAMADAS[raridade]}</p>}
          <div className="cf-palco" aria-hidden="true">
            <div className="cf-luz" />
            <div className="cf-orbita cf-orbita-1" /><div className="cf-orbita cf-orbita-2" />
            {primeira && <div className="cf-envelope"><div className="cf-envelope-aba" /><span>CORE</span><div className="cf-envelope-frente" /></div>}
            {!reduzir && <div className="cf-particulas">{Array.from({ length: nParticulas }, (_, i) => <i key={i} style={{ "--x": `${Math.cos(i * Math.PI * 2 / nParticulas) * (110 + i % 3 * 20)}px`, "--y": `${Math.sin(i * Math.PI * 2 / nParticulas) * (105 + i % 3 * 25)}px`, "--giro": `${i * 47}deg`, "--atraso": `${.2 + i % 4 * .055}s` } as CSSProperties} />)}</div>}
            <div className="cf-arte"><AdesivoRaro id={badge.id} raridade={raridade} tamanho={compacta ? 92 : 264} titulo={badge.name} /></div>
            {!compacta && <span className="cf-risco cf-risco-a" />}{!compacta && <span className="cf-risco cf-risco-b" />}
          </div>
          <div className="cf-textos">
            <p className="cf-edicao">{compacta ? quantidade > 1 ? `${quantidade} figurinhas novas` : "Figurinha nova" : primeira ? "Sua primeira figurinha" : `Figurinha ${ROTULOS[raridade].toLowerCase()}`}</p>
            <h2 id={tituloId}>{nome}</h2>
            <p className="cf-descricao">{compacta ? quantidade > 1 ? `e mais ${quantidade - 1} para o seu álbum` : "Uma pequena conquista, só sua." : primeira ? "Toda coleção começa com uma história. Essa é a sua." : marco ? "Você voltou. E voltou de novo. Olha até onde chegou." : textoConquistado(badge)}</p>
            {!compacta && <p className="cf-legenda"><IconeMarcaAlbum modulo={badge.category} /><span>{categoriaDe(badge.category).label}</span><i /> <b>+{badge.xp} XP</b></p>}
            {marco?.protetor && <p className="cf-protetor"><Check size={14} /> +1 protetor guardado</p>}
          </div>
        </div>
        <div className="cf-acoes">
          {onColar && <button ref={focoInicial} className="cf-colar" onClick={() => encerrar("colar")}><span>{primeira ? "Colar minha primeira figurinha" : quantidade > 1 ? "Ver minhas figurinhas" : "Colar no álbum"}</span><ArrowUpRight size={18} /></button>}
          {!compacta && <button ref={onColar ? undefined : focoInicial} className="cf-depois" data-testid={marco ? "cn-festa-continuar" : undefined} onClick={() => encerrar("continuar")}>Continuar</button>}
          {onCompartilhar && <button className="cf-depois" data-testid="cn-festa-stories" disabled={compartilhando} onClick={() => void compartilhar()}><Share2 size={15} /> {compartilhando ? "Preparando…" : "Postar nos Stories"}</button>}
          {erroShare && <p role="status">Não foi possível compartilhar agora. Tente novamente.</p>}
        </div>
        {compacta && <span className="cf-tempo" data-pausado={pausado || oculto ? "" : undefined} key={`${pausado}-${oculto}`} aria-hidden="true" />}
      </div>
      {compacta && <span className="sr-only" role="status">{quantidade > 1 ? `${quantidade} figurinhas novas. ` : "Figurinha conquistada: "}{badge.name}. Disponível no álbum.</span>}
    </motion.div>
  );
}
