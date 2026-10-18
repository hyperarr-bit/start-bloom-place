import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { doseNaTela, lerMissao, missaoCumprida, missaoDosesLigada, passoPendente } from "@/lib/missao-doses";
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
 * conta), ~70% da tela, o módulo escurecido atrás.
 *
 * v2 (dono, 10/10: "em vez de 3 cards de texto, 4 a 6 cards deslizando pro lado,
 * cada um com uma imagem viva da parte do app, mostrando uma coisa de cada vez, na
 * ordem de importância do módulo"): cada cartão = título curto + 1 frase + a
 * MINIATURA VIVA (o componente real ou a réplica do card, com dados de exemplo em
 * memória — a conta da pessoa continua vazia) ou uma mini-animação de 2–3 quadros
 * (digita → aparece, marca um a um, o medidor sobe; CSS/estado, sem vídeo).
 *   1. Faz isso agora — a 1 ação de 1 toque, animada; "Fazer agora" FECHA a folha,
 *      rola e acende o campo real;
 *   2..N-1. uma coisa do módulo por cartão, na ordem do diagnóstico de abas
 *      (scratchpad/complexidade-10-10): o que mais gente usa primeiro;
 *   N. Relaxa: X e Y ficam pra depois.
 * "Já sei" no topo, sempre visível; bolinhas + "2 de 5"; arrastar a folha pra
 * baixo (ou tocar fora) = "Já sei".
 *
 * v3 (dono no Simulador, 10/10: "tem que ficar mais óbvio que tem que rolar pro
 * lado — talvez botar uma seta"): (1) ESPIADA — o cartão ocupa 88% da largura e
 * ~12% do próximo aparece à direita (scroll-snap por cartão; o último não tem
 * espiada); (2) SETAS redondas na borda, na altura do meio, na cor do módulo: "→"
 * avança e "←" volta (a partir do 2º) pelo mesmo snap do swipe; no último a da
 * direita vira o "✓" do "Já sei"; (3) a DICA "Deslize →" com a seta pulsando (3
 * ciclos e para; reduced-motion = parada) só no 1º cartão e 1x por aparelho
 * (`core-cartoes-dica-deslizar`), some ao 1º swipe/seta. Evento novo:
 * cartoes_modulo_seta {modulo, de, para}.
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
 * FUNDO (bug da Beleza, 10/10): a folha é um portal, fora da raiz da página — a classe
 * da config precisa carregar os tokens do módulo (a Beleza leva "tema-beleza" junto do
 * "ct-beleza"), e o cartoes.css tem reserva literal pra todo módulo (.ct-folha nunca
 * fica transparente).
 *
 * Chave: 1x por APARELHO em `core-cartoes-vistos-{moduleId}` (localStorage); ao fechar
 * também grava `core-tip-seen-{moduleId}` na conta — o "Dicas" antigo não reaparece.
 *
 * Eventos: modulo_cartoes_vistos {moduleId} · modulo_cartao {moduleId, indice} ·
 * modulo_cartoes_fechados {moduleId, indice} · modulo_cartao_fazer_agora {moduleId}.
 */

export interface CartaoVivo {
  /** Título curto ("Seu cardápio da semana"). */
  titulo: string;
  /** Uma frase. */
  texto: string;
  /** A imagem viva: <Miniatura> com o componente real ou os blocos (blocos.tsx). */
  miniatura: ReactNode;
}

export interface ConfigCartoes {
  moduleId: string;
  /** Classe(s) com as variáveis --ct-* (cartoes.css): "ct-financas"; a Beleza: "tema-beleza ct-beleza". */
  classe: string;
  /** "FINANÇAS" — no selo do cabeçalho. */
  nome: string;
  /** Cartão 1: a ação de 1 toque, com a miniatura animada e o "Fazer agora". */
  agora: {
    titulo?: string;
    texto: string;
    botao: string;
    /** O elemento real que acende (querySelector; vale lista com vírgula). */
    seletor: string;
    /** Antes de procurar o alvo: trocar de aba, por exemplo. */
    antes?: () => void;
    /** A linha de apoio sob o título. */
    apoio?: string;
    miniatura: ReactNode;
  };
  /** Cartões 2..N-1 (2 a 4): uma coisa do módulo por cartão, na ordem de importância. */
  cartoes: CartaoVivo[];
  /** O último: "Relaxa: X e Y ficam pra depois." */
  depois: { titulo?: string; itens: string[] };
}

/** Quantos cartões uma config tem (1 + os do meio + o "relaxa"). */
export const totalDeCartoes = (c: ConfigCartoes): number => 2 + c.cartoes.length;

/** 1x por aparelho: a dica "Deslize →" já foi vista (some ao 1º swipe/seta, ou quando a folha fecha). */
export const CHAVE_DICA_DESLIZAR = "core-cartoes-dica-deslizar";
const dicaJaVista = (): boolean => { try { return !!localStorage.getItem(CHAVE_DICA_DESLIZAR); } catch { return false; } };
const marcarDicaVista = (): void => { try { localStorage.setItem(CHAVE_DICA_DESLIZAR, new Date().toISOString()); } catch { /* storage bloqueado */ } };

/** Só a camada de guia de OUTRO componente conta (a própria folha dos cartões também é uma camada). */
const OUTRA_GUIA = '[data-camada-guia]:not([data-camada-guia="cartoes-modulo"])';

/** Outra guia está (ou vai estar) na tela deste módulo — ou ele é da missão? Então os cartões não aparecem. */
export function guiaDoModuloAtiva(moduleId: string, get: <T>(k: string, f: T) => T): boolean {
  try {
    if (typeof document !== "undefined" && document.querySelector(OUTRA_GUIA)) return true;
    // 1.0.16: uma dose da missão na tela (`<html data-missao-dose>`) — a dose É a apresentação do módulo
    if (doseNaTela()) return true;
    const forceNew = !!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    if (forceNew) return true;
    const replay = get<string[]>("tutorial-replay-modules", []);
    if (Array.isArray(replay) && replay.includes(moduleId)) return true;
    if (trialCartaoAtivo() && missaoAtual()) return true;
    if (missaoDosesLigada()) {
      const m = lerMissao();
      if (m && moduloDaMissao(moduleId, m)) return true;
      if (m && !m.explorou && !missaoCumprida(m) && passoPendente(m)?.modulo === moduleId) return true;
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
      .catch((e) => { console.warn(`cartões: a config de ${moduleId} não carregou`, e); /* nada aparece */ });
    return () => { viva = false; };
  }, [moduleId, pronta, precisa]);
  return pronta ?? carregada;
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "var(--ct-suave)" }}>{children}</p>
);

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

  const total = config ? totalDeCartoes(config) : 0;
  // a dica "Deslize →": só no 1º cartão, 1x por aparelho; some ao 1º swipe/seta
  const [dica, setDica] = useState(() => !dicaJaVista());
  const esconderDica = () => { if (dica) { setDica(false); marcarDicaVista(); } };

  const fechar = (como: "ja_sei" | "fazer_agora") => {
    marcarCartoesVistos(moduleId);
    set(`core-tip-seen-${moduleId}`, "true");
    if (dica) marcarDicaVista(); // mostrou uma vez: não repete no próximo módulo
    if (como === "ja_sei") trackEvent("modulo_cartoes_fechados", { moduleId, indice: pagina });
    setVisivel(false);
  };

  /** A posição de rolagem do cartão n (cada cartão tem a própria largura: 88% ou 100% no último). */
  const posicaoDe = (t: HTMLDivElement, n: number): number => (t.children[n] as HTMLElement | undefined)?.offsetLeft ?? 0;
  const irPara = (n: number) => {
    const t = trilho.current;
    const alvo = Math.max(0, Math.min(total - 1, n));
    if (t) {
      const left = posicaoDe(t, alvo);
      if (typeof t.scrollTo === "function") t.scrollTo({ left, behavior: "smooth" });
      else t.scrollLeft = left;
    }
    mudarPagina(alvo);
  };
  const mudarPagina = (n: number) => {
    if (n === pagina) return;
    setPagina(n);
    esconderDica();
    trackEvent("modulo_cartao", { moduleId, indice: n });
  };
  const aoRolar = () => {
    const t = trilho.current;
    if (!t || !t.clientWidth) return;
    // o cartão mais perto da borda esquerda
    let perto = 0;
    for (let i = 0; i < t.children.length; i++) if (Math.abs(posicaoDe(t, i) - t.scrollLeft) < Math.abs(posicaoDe(t, perto) - t.scrollLeft)) perto = i;
    mudarPagina(perto);
  };
  /** As setas: o mesmo snap do swipe + o evento cartoes_modulo_seta. No último, a da direita fecha. */
  const seta = (direcao: -1 | 1) => {
    const para = pagina + direcao;
    if (direcao === 1 && pagina >= total - 1) { trackEvent("cartoes_modulo_seta", { modulo: moduleId, de: pagina, para: "fechar" }); fechar("ja_sei"); return; }
    if (para < 0 || para >= total) return;
    trackEvent("cartoes_modulo_seta", { modulo: moduleId, de: pagina, para });
    esconderDica();
    irPara(para);
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

  const tituloAgora = config.agora.titulo ?? "Faz isso agora";
  const tituloDepois = config.depois.titulo ?? "O que não precisa hoje";
  const titulos = [tituloAgora, ...config.cartoes.map((c) => c.titulo), tituloDepois];
  const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border";
  const estiloChip = { borderColor: "var(--ct-linha)", background: "var(--ct-papel)", color: "var(--ct-tinta)" };
  const ultimo = total - 1;
  const { itens } = config.depois;

  return (
    <Sheet open onOpenChange={(aberta) => { if (!aberta) fechar("ja_sei"); }}>
      <SheetContent
        side="bottom"
        semFechar
        overlayClassName="z-[290] bg-black/55"
        className={`${config.classe} ct-folha p-0 z-[300] rounded-t-[28px] border-0 h-[72dvh] max-h-[72dvh] flex flex-col overflow-hidden`}
        data-testid="cartoes-modulo"
        data-modulo={moduleId}
        data-pagina={pagina}
        data-total={total}
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

        <div className="relative flex-1 min-h-0 flex flex-col">
        {/* as setas: na borda, na altura do meio, na cor do módulo — "←" a partir do 2º; "→" vira "✓" no último */}
        {pagina > 0 && (
          <button type="button" onClick={() => seta(-1)} aria-label="Cartão anterior" data-testid="cartoes-seta-anterior" className="absolute ct-seta ct-seta-esq">
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
        )}
        <button
          type="button"
          onClick={() => seta(1)}
          aria-label={pagina >= total - 1 ? "Já sei" : "Próximo cartão"}
          data-testid={pagina >= total - 1 ? "cartoes-seta-fechar" : "cartoes-seta-proximo"}
          className="absolute ct-seta ct-seta-dir"
        >
          {pagina >= total - 1 ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <ChevronRight className="w-5 h-5" strokeWidth={2.5} />}
        </button>
        <div ref={trilho} className="ct-trilho flex-1 min-h-0" onScroll={aoRolar} data-testid="cartoes-trilho" tabIndex={0} aria-roledescription="carrossel">
          {/* 1 — Faz isso agora, com a ação acontecendo na miniatura */}
          <article className="ct-pagina px-5 pt-4 pb-4" data-ct-pagina="0" aria-label={tituloAgora} aria-hidden={pagina !== 0 ? "true" : undefined}>
            <Eyebrow>1 · {tituloAgora}</Eyebrow>
            <h3 className="mt-1 text-[19px] font-bold leading-tight tracking-tight">{config.agora.texto}</h3>
            {config.agora.apoio && <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--ct-suave)" }}>{config.agora.apoio}</p>}
            <div className="mt-3">{config.agora.miniatura}</div>
            <button
              type="button"
              onClick={fazerAgora}
              data-testid="cartoes-fazer-agora"
              className="mt-3 h-11 px-6 rounded-full text-[14px] font-bold active:scale-95 transition shadow-sm"
              style={{ background: "var(--ct-acento)", color: "var(--ct-acento-tinta)" }}
            >
              {config.agora.botao}
            </button>
          </article>

          {/* 2..N-1 — uma coisa do módulo por cartão */}
          {config.cartoes.map((c, i) => (
            <article key={c.titulo} className="ct-pagina px-5 pt-4 pb-4" data-ct-pagina={i + 1} aria-label={c.titulo} aria-hidden={pagina !== i + 1 ? "true" : undefined}>
              <Eyebrow>{i + 2} · {c.titulo}</Eyebrow>
              <h3 className="mt-1 text-[17px] font-bold leading-tight tracking-tight">{c.texto}</h3>
              <div className="mt-3">{c.miniatura}</div>
            </article>
          ))}

          {/* N — O que não precisa hoje */}
          <article className="ct-pagina px-5 pt-4 pb-4" data-ct-pagina={ultimo} data-ultimo="" aria-label={tituloDepois} aria-hidden={pagina !== ultimo ? "true" : undefined}>
            <Eyebrow>{total} · {tituloDepois}</Eyebrow>
            <h3 className="mt-1 text-[22px] font-bold leading-tight tracking-tight">Relaxa: isso fica pra depois.</h3>
            <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--ct-suave)" }}>
              {itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0]} continuam aqui quando você quiser — hoje não precisa.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {itens.map((i) => <span key={i} className={`${chip} line-through opacity-70`} style={estiloChip}>{i}</span>)}
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
        </div>

        <div className="flex items-center justify-between px-4 pt-2 shrink-0 pb-[max(0.9rem,var(--app-safe-bottom,0px))]" style={{ borderTop: "1px solid var(--ct-linha)" }}>
          <div>
            <div className="flex items-center gap-1" role="tablist" aria-label="Cartões">
              {titulos.map((p, i) => (
                <button key={`${p}-${i}`} type="button" role="tab" aria-selected={i === pagina} aria-label={`Cartão ${i + 1}: ${p}`} onClick={() => irPara(i)} className="p-1.5" data-testid={`cartoes-bolinha-${i}`}>
                  <i className="ct-dot" data-ativo={i === pagina ? "" : undefined} />
                </button>
              ))}
              <span className="ml-1 text-[11px] tabular-nums" style={{ color: "var(--ct-suave)" }} data-testid="cartoes-contador">{pagina + 1} de {total}</span>
            </div>
            {dica && pagina === 0 && (
              <p className="ct-dica mt-0.5 pl-1.5 text-[11.5px] font-semibold" style={{ color: "var(--ct-acento)" }} data-testid="cartoes-dica-deslizar" aria-hidden="true">
                Deslize <span className="ct-dica-seta">→</span>
              </p>
            )}
          </div>
          <FigurinhaPlaceholder tamanho={40} className="-rotate-6" />
        </div>
      </SheetContent>
    </Sheet>
  );
};
