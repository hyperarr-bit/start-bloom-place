import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { lerMissao, missaoCumprida, missaoDosesLigada, passoPendente } from "@/lib/missao-doses";
import { missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { cartoesLigados, cartoesVistosNesteAparelho, guardarForcasDaUrl, marcarCartoesVistos } from "@/lib/tour-home";
import "./cartoes.css";

/**
 * CARTÕES DE BOAS-VINDAS DO MÓDULO (10/10, protótipo atrás de `CARTOES_MODULO`,
 * lib/tour-home). Na 1ª visita real ao módulo, FORA da missão em doses e do
 * tutorial de holofote, 3 cartões que deslizam de lado (swipe + bolinhas), no
 * tamanho de um card do planner e na paleta do módulo:
 *   1. Faz isso agora — 1 ação de 1 toque; "Fazer agora" rola e acende o campo real;
 *   2. Onde fica o essencial — 2–3 abas + a tela do módulo em MINIATURA, viva;
 *   3. O que não precisa hoje — "Relaxa: X, Y e Z ficam pra depois".
 * "Já sei" sempre visível. Canto reservado pra uma figurinha do álbum (placeholder).
 *
 * Substitui o ModuleTip "Dicas para começar" quando a chave está ligada (Finanças
 * e Beleza); os outros módulos seguem com o ModuleTip. Chave: 1x por APARELHO em
 * `core-cartoes-vistos-{moduleId}` (localStorage); ao fechar também grava
 * `core-tip-seen-{moduleId}` na conta — assim o "Dicas" antigo não reaparece
 * depois, nem no app antigo, nem se a chave for desligada.
 *
 * Eventos: modulo_cartoes_vistos {moduleId} · modulo_cartao {moduleId, indice} ·
 * modulo_cartoes_fechados {moduleId, indice} · modulo_cartao_fazer_agora {moduleId}.
 */

export interface ConfigCartoes {
  moduleId: string;
  /** Classe com as variáveis --ct-* (cartoes.css): "ct-financas", "ct-beleza". */
  classe: string;
  /** "FINANÇAS" — no selo do cabeçalho. */
  nome: string;
  agora: {
    titulo: string;
    texto: string;
    botao: string;
    /** O elemento real que acende (querySelector; vale lista com vírgula). */
    seletor: string;
    /** Antes de procurar o alvo: trocar de aba, por exemplo. */
    antes?: () => void;
  };
  essencial: { titulo: string; texto: string; abas: string[]; miniatura: ReactNode };
  depois: { titulo: string; itens: string[] };
}

/** Outra guia está (ou vai estar) na tela deste módulo? Então os cartões não empilham — ficam pra próxima visita. */
export function guiaDoModuloAtiva(moduleId: string, get: <T>(k: string, f: T) => T): boolean {
  try {
    if (typeof document !== "undefined" && document.querySelector("[data-camada-guia]")) return true;
    const forceNew = !!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    if (forceNew) return true;
    const replay = get<string[]>("tutorial-replay-modules", []);
    if (Array.isArray(replay) && replay.includes(moduleId)) return true;
    if (trialCartaoAtivo() && missaoAtual()) return true;
    if (missaoDosesLigada()) {
      const m = lerMissao();
      if (m && !missaoCumprida(m) && passoPendente(m)?.modulo === moduleId) return true;
    }
  } catch { /* sem storage: segue */ }
  return false;
}

/** Placeholder da figurinha do álbum (o dono gera a ilustração final): círculo tracejado com estrela. */
export const FigurinhaPlaceholder = ({ tamanho = 48, className }: { tamanho?: number; className?: string }) => (
  <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} aria-hidden="true" data-figurinha-placeholder className={className}>
    <circle cx="24" cy="24" r="21" fill="var(--ct-faixa)" stroke="var(--ct-acento)" strokeWidth="1.5" strokeDasharray="3 3" />
    <path d="M24 12l3.3 7.2 7.7.9-5.7 5.3 1.5 7.6L24 29.2 17.2 33l1.5-7.6L13 20.1l7.7-.9z" fill="var(--ct-acento)" opacity=".85" />
  </svg>
);

/** O anel do "Fazer agora": acende o alvo real por uns segundos, acompanhando a rolagem. */
function AnelFazerAgora({ alvo, onFim }: { alvo: HTMLElement; onFim: () => void }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      const r = alvo.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      raf = requestAnimationFrame(medir);
    };
    raf = requestAnimationFrame(medir);
    const t = setTimeout(onFim, 3200);
    const toque = () => onFim();
    document.addEventListener("pointerdown", toque, { capture: true, once: true });
    return () => { cancelAnimationFrame(raf); clearTimeout(t); document.removeEventListener("pointerdown", toque, { capture: true }); };
  }, [alvo, onFim]);
  if (!rect || typeof document === "undefined") return null;
  const P = 8;
  return createPortal(
    <div className="ct-anel" data-testid="cartoes-anel" style={{ top: rect.top - P, left: rect.left - P, width: rect.width + P * 2, height: rect.height + P * 2 }} />,
    document.body,
  );
}

export const CartoesDoModulo = ({ config }: { config: ConfigCartoes }) => {
  const { moduleId } = config;
  const { get, set } = useUserData();
  guardarForcasDaUrl();
  const [visivel, setVisivel] = useState(() => cartoesLigados() && !cartoesVistosNesteAparelho(moduleId) && !guiaDoModuloAtiva(moduleId, get));
  const [pagina, setPagina] = useState(0);
  const [alvoAceso, setAlvoAceso] = useState<HTMLElement | null>(null);
  const trilho = useRef<HTMLDivElement>(null);
  // a altura do trilho segue a página ATIVA (senão o cartão 1 herda a altura da miniatura do 2)
  const [alturaTrilho, setAlturaTrilho] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!visivel) return;
    const medir = () => {
      const pag = trilho.current?.children[pagina] as HTMLElement | undefined;
      const h = pag?.getBoundingClientRect().height;
      if (h) setAlturaTrilho(h);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [pagina, visivel]);

  // uma guia montada no MESMO commit (irmã na árvore) só está no DOM depois do render: confere antes de pintar
  useLayoutEffect(() => {
    if (visivel && document.querySelector("[data-camada-guia]")) setVisivel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // uma guia que monta logo depois (holofote espera o `loaded`): se aparecer, os cartões saem sem marcar "visto"
  useEffect(() => {
    if (!visivel || document.querySelector("[data-camada-guia]")) return;
    trackEvent("modulo_cartoes_vistos", { moduleId });
    trackEvent("modulo_cartao", { moduleId, indice: 0 });
    const t = setTimeout(() => { if (document.querySelector("[data-camada-guia]")) setVisivel(false); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  const fechar = (como: "ja_sei" | "fazer_agora") => {
    marcarCartoesVistos(moduleId);
    set(`core-tip-seen-${moduleId}`, "true");
    if (como === "ja_sei") trackEvent("modulo_cartoes_fechados", { moduleId, indice: pagina });
    setVisivel(false);
  };

  const irPara = (n: number) => {
    const t = trilho.current;
    const alvo = Math.max(0, Math.min(2, n));
    if (t) {
      if (typeof t.scrollTo === "function") t.scrollTo({ left: alvo * t.clientWidth, behavior: "smooth" });
      else t.scrollLeft = alvo * t.clientWidth;
    }
    mudarPagina(alvo);
  };
  const mudarPagina = (n: number) => {
    if (n === pagina) return;
    setPagina(n);
    trackEvent("modulo_cartao", { moduleId, indice: n });
  };
  const aoRolar = () => {
    const t = trilho.current;
    if (!t || !t.clientWidth) return;
    mudarPagina(Math.round(t.scrollLeft / t.clientWidth));
  };

  const fazerAgora = () => {
    trackEvent("modulo_cartao_fazer_agora", { moduleId });
    try { config.agora.antes?.(); } catch { /* a aba pode já estar aberta */ }
    fechar("fazer_agora");
    // os cartões saem da tela primeiro; aí o alvo real aparece, rola pro centro e acende
    setTimeout(() => {
      const el = document.querySelector(config.agora.seletor) as HTMLElement | null;
      if (!el) return;
      const area = (el.closest("[data-cartao-alvo]") as HTMLElement | null) ?? el;
      try { area.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom */ }
      setAlvoAceso(area);
    }, 120);
  };

  if (!visivel) return alvoAceso ? <AnelFazerAgora alvo={alvoAceso} onFim={() => setAlvoAceso(null)} /> : null;

  const paginas = [config.agora.titulo, config.essencial.titulo, config.depois.titulo];
  const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  const estiloChip = { borderColor: "var(--ct-linha)", background: "var(--ct-papel)", color: "var(--ct-tinta)" };

  return (
    <section
      className={`${config.classe} relative mb-4 rounded-2xl border overflow-hidden shadow-sm`}
      style={{ background: "var(--ct-cartao)", borderColor: "var(--ct-linha)", color: "var(--ct-tinta)" }}
      data-testid="cartoes-modulo"
      data-modulo={moduleId}
      data-pagina={pagina}
      aria-label={`Boas-vindas: ${config.nome}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ background: "var(--ct-faixa)" }}>
        <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-tinta)" }}>Boas-vindas · {config.nome}</p>
        <button
          type="button"
          onClick={() => fechar("ja_sei")}
          data-testid="cartoes-ja-sei"
          className="shrink-0 h-8 px-3 rounded-full text-[12px] font-bold border active:scale-95 transition"
          style={{ borderColor: "var(--ct-linha)", background: "var(--ct-cartao)", color: "var(--ct-tinta)" }}
        >
          Já sei
        </button>
      </div>

      <div ref={trilho} className="ct-trilho" style={{ height: alturaTrilho, transition: "height .25s ease" }} onScroll={aoRolar} data-testid="cartoes-trilho" tabIndex={0} aria-roledescription="carrossel">
        {/* 1 — Faz isso agora */}
        <article className="ct-pagina px-4 pt-4 pb-3" data-ct-pagina="0" aria-label={paginas[0]} aria-hidden={pagina !== 0 ? "true" : undefined}>
          <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>1 · {config.agora.titulo}</p>
          <h3 className="mt-1 text-[18px] font-bold leading-tight tracking-tight">{config.agora.texto}</h3>
          <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: "var(--ct-suave)" }}>Um toque e o módulo já está trabalhando pra você.</p>
          <button
            type="button"
            onClick={fazerAgora}
            data-testid="cartoes-fazer-agora"
            className="mt-4 h-11 px-5 rounded-full text-[13.5px] font-bold active:scale-95 transition"
            style={{ background: "var(--ct-acento)", color: "var(--ct-acento-tinta)" }}
          >
            {config.agora.botao}
          </button>
        </article>

        {/* 2 — Onde fica o essencial */}
        <article className="ct-pagina px-4 pt-4 pb-3" data-ct-pagina="1" aria-label={paginas[1]} aria-hidden={pagina !== 1 ? "true" : undefined}>
          <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>2 · {config.essencial.titulo}</p>
          <h3 className="mt-1 text-[16px] font-bold leading-tight tracking-tight">{config.essencial.texto}</h3>
          <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
            {config.essencial.abas.map((a) => <span key={a} className={chip} style={estiloChip}>{a}</span>)}
          </div>
          {config.essencial.miniatura}
        </article>

        {/* 3 — O que não precisa hoje */}
        <article className="ct-pagina px-4 pt-4 pb-3" data-ct-pagina="2" aria-label={paginas[2]} aria-hidden={pagina !== 2 ? "true" : undefined}>
          <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>3 · {config.depois.titulo}</p>
          <h3 className="mt-1 text-[18px] font-bold leading-tight tracking-tight">Relaxa: isso fica pra depois.</h3>
          <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: "var(--ct-suave)" }}>
            {config.depois.itens.slice(0, -1).join(", ")} e {config.depois.itens[config.depois.itens.length - 1]} continuam aqui quando você quiser — hoje não precisa.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {config.depois.itens.map((i) => <span key={i} className={`${chip} line-through opacity-70`} style={estiloChip}>{i}</span>)}
          </div>
          <button
            type="button"
            onClick={() => fechar("ja_sei")}
            className="mt-4 h-10 px-4 rounded-full text-[13px] font-bold border active:scale-95 transition"
            style={{ borderColor: "var(--ct-acento)", color: "var(--ct-acento)", background: "var(--ct-cartao)" }}
          >
            Começar
          </button>
        </article>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Cartões">
          {paginas.map((p, i) => (
            <button key={p} type="button" role="tab" aria-selected={i === pagina} aria-label={`Cartão ${i + 1}: ${p}`} onClick={() => irPara(i)} className="p-1.5" data-testid={`cartoes-bolinha-${i}`}>
              <i className="ct-dot" data-ativo={i === pagina ? "" : undefined} />
            </button>
          ))}
          <span className="ml-1 text-[11px] tabular-nums" style={{ color: "var(--ct-suave)" }} data-testid="cartoes-contador">{pagina + 1} de 3</span>
        </div>
        <FigurinhaPlaceholder tamanho={40} className="-rotate-6" />
      </div>
    </section>
  );
};
