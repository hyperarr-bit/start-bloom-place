import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { lerMissao, missaoCumprida, missaoDosesLigada, passoPendente } from "@/lib/missao-doses";
import { missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { cartoesLigados, cartoesVistosNesteAparelho, guardarForcasDaUrl, marcarCartoesVistos } from "@/lib/tour-home";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { carregarCartoes, type FabricaDeCartoes } from "./registro";
import "./cartoes.css";

/**
 * CARTÕES DE BOAS-VINDAS DO MÓDULO (10/10, atrás de `CARTOES_MODULO`, lib/tour-home).
 *
 * 1.0.14: viraram POPUP (dono: "aparecer por cima do app como popup") — a mesma
 * folha que sobe de baixo das outras (Sheet do PersonalizarPendencias / menu da
 * conta), ~70% da tela, o módulo escurecido atrás. Dentro, os MESMOS 3 cartões que
 * deslizam de lado (swipe + bolinhas), na paleta do módulo:
 *   1. Faz isso agora — 1 ação de 1 toque; "Fazer agora" FECHA a folha, rola e acende o campo real;
 *   2. Onde fica o essencial — as 2–3 abas vivas + a tela do módulo em MINIATURA;
 *   3. O que não precisa hoje — "Relaxa: X, Y e Z ficam pra depois".
 * "Já sei" no topo, sempre visível; arrastar a folha pra baixo (ou tocar fora) = "Já sei".
 *
 * Existem pra os 16 módulos (components/cartoes-modulo/cartoes-*.tsx, carregados sob
 * demanda pelo `registro`): o ModuleTip "Dicas para começar" sai de cena com a chave
 * ligada (BoasVindasDoModulo) e fica de reserva com ela desligada.
 *
 * REGRA DA MISSÃO EM DOSES (dono 10/10): um módulo que FAZ PARTE da missão da pessoa
 * (os 3 escolhidos) NUNCA mostra os cartões — nem no dia 1 (a dose É a boas-vindas),
 * nem nos dias 2/3 do "aprofundar". Derivado de `lerMissao().modulos` (guiaDoModuloAtiva),
 * sem copiar nada. Módulos fora da missão: cartões na 1ª visita. Quem pulou a missão
 * inteira ("Explorar por conta própria"): cartões em qualquer módulo. Conta antiga sem
 * missão e a missão da 1.0.10 (braço A / chave off) seguem a mesma regra.
 *
 * Chave: 1x por APARELHO em `core-cartoes-vistos-{moduleId}` (localStorage); ao fechar
 * também grava `core-tip-seen-{moduleId}` na conta — o "Dicas" antigo não reaparece.
 *
 * Eventos: modulo_cartoes_vistos {moduleId} · modulo_cartao {moduleId, indice} ·
 * modulo_cartoes_fechados {moduleId, indice} · modulo_cartao_fazer_agora {moduleId}.
 */

export interface ConfigCartoes {
  moduleId: string;
  /** Classe com as variáveis --ct-* (cartoes.css): "ct-financas", "ct-rotina"… */
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
    /** A linha de apoio sob o título (padrão: "Um toque e o módulo já está trabalhando pra você."). */
    apoio?: string;
  };
  essencial: { titulo: string; texto: string; abas: string[]; miniatura: ReactNode };
  depois: { titulo: string; itens: string[] };
}

/** Só a camada de guia de OUTRO componente conta (a própria folha dos cartões também é uma camada). */
const OUTRA_GUIA = '[data-camada-guia]:not([data-camada-guia="cartoes-modulo"])';

/** Outra guia está (ou vai estar) na tela deste módulo — ou ele é da missão? Então os cartões não aparecem. */
export function guiaDoModuloAtiva(moduleId: string, get: <T>(k: string, f: T) => T): boolean {
  try {
    if (typeof document !== "undefined" && document.querySelector(OUTRA_GUIA)) return true;
    const forceNew = !!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    if (forceNew) return true;
    const replay = get<string[]>("tutorial-replay-modules", []);
    if (Array.isArray(replay) && replay.includes(moduleId)) return true;
    if (trialCartaoAtivo() && missaoAtual()) return true;
    if (missaoDosesLigada()) {
      const m = lerMissao();
      if (m && moduloDaMissao(moduleId, m)) return true;
      if (m && !missaoCumprida(m) && passoPendente(m)?.modulo === moduleId) return true;
    }
  } catch { /* sem storage: segue */ }
  return false;
}

/**
 * O módulo é um dos 3 da missão desta pessoa (e ela não pulou a missão)? A dose do dia 1 é
 * a boas-vindas dele; nos dias 2/3 o "aprofundar" ocupa o mesmo lugar — nunca cartão em cima.
 */
export const moduloDaMissao = (moduleId: string, m: ReturnType<typeof lerMissao>): boolean =>
  !!m && !m.explorou && Array.isArray(m.modulos) && (m.modulos as string[]).includes(moduleId);

/** Placeholder da figurinha do álbum (o dono gera a ilustração final): círculo tracejado com estrela. */
export const FigurinhaPlaceholder = ({ tamanho = 48, className }: { tamanho?: number; className?: string }) => (
  <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} aria-hidden="true" data-figurinha-placeholder className={className}>
    <circle cx="24" cy="24" r="21" fill="var(--ct-faixa)" stroke="var(--ct-acento)" strokeWidth="1.5" strokeDasharray="3 3" />
    <path d="M24 12l3.3 7.2 7.7.9-5.7 5.3 1.5 7.6L24 29.2 17.2 33l1.5-7.6L13 20.1l7.7-.9z" fill="var(--ct-acento)" opacity=".85" />
  </svg>
);

/** O anel do "Fazer agora": acende o alvo real por uns segundos, acompanhando a rolagem. */
function AnelFazerAgora({ alvo, classe, onFim }: { alvo: HTMLElement; classe: string; onFim: () => void }) {
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
    <div className={`ct-anel ${classe}`} data-testid="cartoes-anel" style={{ top: rect.top - P, left: rect.left - P, width: rect.width + P * 2, height: rect.height + P * 2 }} />,
    document.body,
  );
}

/** Usa a config pronta (Finanças e Beleza passam a deles) ou carrega a do módulo pelo registro. */
function useConfigDosCartoes(moduleId: string, pronta: ConfigCartoes | undefined, precisa: boolean): ConfigCartoes | null {
  const [carregada, setCarregada] = useState<ConfigCartoes | null>(null);
  useEffect(() => {
    if (pronta || !precisa) return;
    let viva = true;
    carregarCartoes(moduleId)
      .then((fabrica: FabricaDeCartoes | null) => { if (viva && fabrica) setCarregada(fabrica()); })
      .catch(() => { /* sem cartões pra este módulo: nada aparece */ });
    return () => { viva = false; };
  }, [moduleId, pronta, precisa]);
  return pronta ?? carregada;
}

export const CartoesDoModulo = ({ config: pronta, moduleId: idPedido }: { config?: ConfigCartoes; moduleId?: string }) => {
  const moduleId = pronta?.moduleId ?? idPedido ?? "";
  const { get, set } = useUserData();
  guardarForcasDaUrl();
  const [visivel, setVisivel] = useState(() => !!moduleId && cartoesLigados() && !cartoesVistosNesteAparelho(moduleId) && !guiaDoModuloAtiva(moduleId, get));
  const config = useConfigDosCartoes(moduleId, pronta, visivel);
  const [pagina, setPagina] = useState(0);
  const [alvoAceso, setAlvoAceso] = useState<HTMLElement | null>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const avisouRef = useRef(false);

  // uma guia montada no MESMO commit (irmã na árvore) só está no DOM depois do render: confere antes de pintar
  useLayoutEffect(() => {
    if (visivel && document.querySelector(OUTRA_GUIA)) setVisivel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // uma guia que monta logo depois (holofote espera o `loaded`): se aparecer, os cartões saem sem marcar "visto"
  useEffect(() => {
    if (!visivel || !config || avisouRef.current || document.querySelector(OUTRA_GUIA)) return;
    avisouRef.current = true;
    trackEvent("modulo_cartoes_vistos", { moduleId });
    trackEvent("modulo_cartao", { moduleId, indice: 0 });
    const t = setTimeout(() => { if (document.querySelector(OUTRA_GUIA)) setVisivel(false); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, !!config]);

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
    if (!config) return;
    trackEvent("modulo_cartao_fazer_agora", { moduleId });
    try { config.agora.antes?.(); } catch { /* a aba pode já estar aberta */ }
    fechar("fazer_agora");
    // a folha desce primeiro; aí o alvo real aparece, rola pro centro e acende
    setTimeout(() => {
      const el = document.querySelector(config.agora.seletor) as HTMLElement | null;
      if (!el) return;
      const area = (el.closest("[data-cartao-alvo]") as HTMLElement | null) ?? el;
      try { area.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom */ }
      setAlvoAceso(area);
    }, 120);
  };

  if (!visivel || !config) return alvoAceso ? <AnelFazerAgora alvo={alvoAceso} classe={config?.classe ?? ""} onFim={() => setAlvoAceso(null)} /> : null;

  const paginas = [config.agora.titulo, config.essencial.titulo, config.depois.titulo];
  const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  const estiloChip = { borderColor: "var(--ct-linha)", background: "var(--ct-papel)", color: "var(--ct-tinta)" };

  return (
    <Sheet open onOpenChange={(aberta) => { if (!aberta) fechar("ja_sei"); }}>
      <SheetContent
        side="bottom"
        semFechar
        overlayClassName="z-[290] bg-black/55"
        className={`${config.classe} ct-folha p-0 z-[300] rounded-t-[28px] border-0 h-[72dvh] max-h-[72dvh] flex flex-col overflow-hidden`}
        style={{ background: "var(--ct-cartao)", color: "var(--ct-tinta)" }}
        data-testid="cartoes-modulo"
        data-modulo={moduleId}
        data-pagina={pagina}
        data-camada-guia="cartoes-modulo"
        aria-label={`Boas-vindas: ${config.nome}`}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">Boas-vindas: {config.nome}</SheetTitle>
        <div className="pt-2.5 pb-0.5 flex justify-center shrink-0" aria-hidden="true" style={{ background: "var(--ct-faixa)" }}>
          <span className="h-1 w-9 rounded-full" style={{ background: "var(--ct-tinta)", opacity: 0.25 }} />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-1 shrink-0" style={{ background: "var(--ct-faixa)" }}>
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

        <div ref={trilho} className="ct-trilho flex-1 min-h-0" onScroll={aoRolar} data-testid="cartoes-trilho" tabIndex={0} aria-roledescription="carrossel">
          {/* 1 — Faz isso agora */}
          <article className="ct-pagina px-5 pt-5 pb-4" data-ct-pagina="0" aria-label={paginas[0]} aria-hidden={pagina !== 0 ? "true" : undefined}>
            <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>1 · {config.agora.titulo}</p>
            <h3 className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight">{config.agora.texto}</h3>
            <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--ct-suave)" }}>{config.agora.apoio ?? "Um toque e o módulo já está trabalhando pra você."}</p>
            <button
              type="button"
              onClick={fazerAgora}
              data-testid="cartoes-fazer-agora"
              className="mt-5 h-12 px-6 rounded-full text-[14px] font-bold active:scale-95 transition shadow-sm"
              style={{ background: "var(--ct-acento)", color: "var(--ct-acento-tinta)" }}
            >
              {config.agora.botao}
            </button>
            <p className="mt-6 text-[11.5px]" style={{ color: "var(--ct-suave)" }}>Desliza pro lado pra ver as abas que importam →</p>
          </article>

          {/* 2 — Onde fica o essencial */}
          <article className="ct-pagina px-5 pt-5 pb-4" data-ct-pagina="1" aria-label={paginas[1]} aria-hidden={pagina !== 1 ? "true" : undefined}>
            <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>2 · {config.essencial.titulo}</p>
            <h3 className="mt-1.5 text-[17px] font-bold leading-tight tracking-tight">{config.essencial.texto}</h3>
            <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
              {config.essencial.abas.map((a) => <span key={a} className={chip} style={estiloChip}>{a}</span>)}
            </div>
            {config.essencial.miniatura}
          </article>

          {/* 3 — O que não precisa hoje */}
          <article className="ct-pagina px-5 pt-5 pb-4" data-ct-pagina="2" aria-label={paginas[2]} aria-hidden={pagina !== 2 ? "true" : undefined}>
            <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>3 · {config.depois.titulo}</p>
            <h3 className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight">Relaxa: isso fica pra depois.</h3>
            <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--ct-suave)" }}>
              {config.depois.itens.slice(0, -1).join(", ")} e {config.depois.itens[config.depois.itens.length - 1]} continuam aqui quando você quiser — hoje não precisa.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {config.depois.itens.map((i) => <span key={i} className={`${chip} line-through opacity-70`} style={estiloChip}>{i}</span>)}
            </div>
            <button
              type="button"
              onClick={() => fechar("ja_sei")}
              data-testid="cartoes-comecar"
              className="mt-5 h-11 px-5 rounded-full text-[13.5px] font-bold border active:scale-95 transition"
              style={{ borderColor: "var(--ct-acento)", color: "var(--ct-acento)", background: "var(--ct-cartao)" }}
            >
              Começar
            </button>
          </article>
        </div>

        <div className="flex items-center justify-between px-4 pt-2 shrink-0 pb-[max(0.9rem,var(--app-safe-bottom,0px))]" style={{ borderTop: "1px solid var(--ct-linha)" }}>
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
      </SheetContent>
    </Sheet>
  );
};
