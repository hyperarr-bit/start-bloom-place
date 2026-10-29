/**
 * FILEIRA DE ABAS DOS MÓDULOS COM "ORGANIZAR ABAS" — par do hook useAbasOcultas (regra em lib/abas-ocultas).
 *
 * História: 07/09 (avaliações da Play) nasceu o "ocultar aba" na Rotina; 12/09 (mockup aprovado pelo dono — "não tem
 * forma mais bonita do que esse quadrado com três pontos?") virou segurar-pra-editar + chip fantasma "+1 oculta".
 * 1.0.22 (dono 28/10, chamados "completo mas confuso" / "ocultar as abas que não uso"): TODOS os módulos com abas usam
 * esta fileira, e no fim dela fica sempre uma porta discreta pra folha "Organizar abas":
 *  - sem nada oculto: só o ícone (chip fantasma, sem borda); com aba oculta: "+N ocultas" (como em 12/09);
 *  - conta nova com o padrão enxuto (ABAS_ENXUTAS): "Mostrar todas as abas" antes da porta;
 *  - a folha (padrão das folhas da Home nova: alça, arrastar pra baixo fecha, mola) lista cada aba com emoji + nome,
 *    ↑↓ pra mudar a ordem e o interruptor mostrar/ocultar; a última visível vem travada; "Mostrar todas" no fim.
 *  - SEGURAR uma aba (ou botão direito) continua entrando no modo de editar com o × (12/09).
 *
 * Mesma aparência e mesmos atributos de antes (`notion-tab`, `data-active` pro useScrollActiveTabIntoView,
 * `data-spotlight="tab-{id}"` pro tutorial/missão — ou o `spotlight` da aba). Link profundo pra uma aba OCULTA: ela
 * aparece na fileira (tracejada) enquanto estiver aberta — o "+" da Home, o "Ver tutorial" e os lembretes não quebram.
 * Quando a pessoa oculta a aba em que está, cai na primeira visível (nunca uma tela vazia).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import type { AbaOcultavel, AbasOcultas } from "@/hooks/use-abas-ocultas";
import { Switch } from "@/components/ui/switch";
import { trackEvent } from "@/lib/analytics";
import { emCaminhoDeDemo } from "@/lib/caminho-demo";
import {
  Alca, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha, propsDoFundo, useFolhaArrastavel,
} from "@/components/home-nova/e/folha-arrasto";

interface AbasOcultaveisProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  ativa: string;
  onTrocar: (id: string) => void;
  /** Classe extra do contêiner (as páginas usam max-w-* mx-auto px-4 pb-2). */
  className?: string;
  /** `data-testid="aba-<id>"` em cada aba (Treino e Pet já tinham). */
  testIds?: boolean;
  /** role="tab" + aria-selected (Pet já tinha). */
  comoTab?: boolean;
  /** Aba ativa com id que não está na lista → cai na 1ª visível (padrão). Finanças desliga: o `?aba=kit` chega antes
   *  de a aba do kit existir (ela depende do dado da conta) e a página já não mostra nada errado nesse meio-tempo. */
  corrigirAbaDesconhecida?: boolean;
  /** aria-label da fileira (Relações tinha "Abas de Relações"). */
  rotuloDaFileira?: string;
}

const SEGURAR_MS = 500;

/** Demo de venda (/preview, /experimente, /liberar, /hoje/demo e o iframe da landing /organizar/demo): a fileira fica como
 *  antes, sem a porta "Organizar abas" nem o "Ver todas" (dono 28/10). */
export const fileiraDeDemo = (): boolean => {
  try { return emCaminhoDeDemo() || /^\/organizar\/demo(\/|$)/.test(window.location.pathname); } catch { return false; }
};
const rotuloDe = (t: AbaOcultavel) => `${t.icon ? `${t.icon} ` : ""}${t.label}`;

export function AbasOcultaveis<T extends AbaOcultavel>({ abas, ativa, onTrocar, className = "", testIds = false, comoTab = false, corrigirAbaDesconhecida = true, rotuloDaFileira }: AbasOcultaveisProps<T>) {
  const { visiveis, ocultas, todas, ocultar, podeOcultar, modulo } = abas;
  const [editando, setEditando] = useState(false);
  const [folha, setFolha] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  // segurar entra no modo de editar; o clique que vem logo depois no mesmo toque NÃO pode trocar de aba
  const segurou = useRef(false);

  // Aba que nem existe (id velho, aba condicional que ainda não chegou): cai na primeira visível.
  // Aba que existe mas está OCULTA continua aberta — foi um link/atalho/tutorial que pediu (ver o cabeçalho).
  useEffect(() => {
    if (!corrigirAbaDesconhecida || visiveis.length === 0) return;
    if (!todas.some((a) => a.id === ativa)) onTrocar(visiveis[0].id);
  }, [visiveis, todas, ativa, onTrocar, corrigirAbaDesconhecida]);

  // Ocultar (pelo × ou pela folha): se era a aba aberta, vai pra primeira visível que sobra.
  const ocultarAba = useCallback((id: string) => {
    const ok = ocultar(id);
    if (ok && id === ativa) {
      const prox = visiveis.find((a) => a.id !== id);
      if (prox) onTrocar(prox.id);
    }
    return ok;
  }, [ocultar, ativa, visiveis, onTrocar]);

  // A fileira encolheu/cresceu (ocultar, religar, ordem): a aba aberta volta pra dentro da tela (print 28/10: ficava cortada)
  const assinatura = visiveis.map((a) => a.id).join("|");
  useEffect(() => {
    const el = raiz.current?.querySelector<HTMLElement>('[data-active="true"]');
    try { el?.scrollIntoView?.({ inline: "nearest", block: "nearest" }); } catch { /* sem suporte: fica onde está */ }
  }, [assinatura]);

  // Um toque fora da fila sai do modo de editar.
  useEffect(() => {
    if (!editando) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setEditando(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [editando]);

  const comecarSegurar = () => {
    segurou.current = false;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      segurou.current = true;
      setEditando(true);
    }, SEGURAR_MS);
  };
  const soltar = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
  };
  useEffect(() => () => soltar(), []);

  const clicarAba = (id: string) => {
    if (segurou.current) { segurou.current = false; return; }
    if (editando) return; // no modo de editar, o toque na aba não navega — o × é a ação
    onTrocar(id);
  };

  const abrirFolha = () => {
    setEditando(false);
    setFolha(true);
    trackEvent("abas_organizar_aberto", { modulo: modulo ?? "", ocultas: ocultas.length });
  };

  // A fileira: as visíveis + a ativa se ela estiver oculta (link profundo), na ordem da pessoa.
  const visIds = new Set(visiveis.map((a) => a.id));
  const demo = fileiraDeDemo();
  const naFileira = todas.filter((a) => visIds.has(a.id) || a.id === ativa);

  return (
    /* O resto fica FORA da faixa que rola (12/09, vídeo do dono): um filho `absolute` dentro de `overflow-x-auto` é
       cortado e vira rolagem vertical da própria faixa. */
    <div ref={raiz} className={`relative ${className}`}>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pt-2 -mt-2" role={comoTab ? "tablist" : undefined} aria-label={rotuloDaFileira}>
        {naFileira.map((tab) => {
          const oculta = !visIds.has(tab.id);
          const mostraX = editando && podeOcultar && !oculta;
          return (
            /* O × é IRMÃO do botão da aba, não filho: botão dentro de botão não é HTML válido. */
            <div key={tab.id} className={`relative shrink-0 ${editando ? "animate-jiggle motion-reduce:animate-none" : ""}`}>
              <button
                type="button"
                role={comoTab ? "tab" : undefined}
                aria-selected={comoTab ? ativa === tab.id : undefined}
                data-active={ativa === tab.id}
                data-spotlight={tab.spotlight ?? `tab-${tab.id}`}
                data-testid={testIds ? `aba-${tab.id}` : undefined}
                data-oculta={oculta ? "1" : undefined}
                onClick={() => clicarAba(tab.id)}
                onContextMenu={(e) => { e.preventDefault(); setEditando(true); }}
                onMouseDown={comecarSegurar}
                onMouseUp={soltar}
                onMouseLeave={soltar}
                onTouchStart={comecarSegurar}
                onTouchEnd={soltar}
                onTouchMove={soltar}
                className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 select-none ${
                  ativa === tab.id ? "notion-tab-active" : "hover:bg-muted"
                } ${oculta ? "border-dashed" : ""}`}
              >
                {tab.icon && <span aria-hidden={comoTab ? true : undefined}>{tab.icon}</span>}
                {tab.label}
              </button>
              {mostraX && (
                <button
                  type="button"
                  aria-label={`Ocultar aba ${rotuloDe(tab)}`}
                  data-track={`aba-ocultar:${tab.id}`}
                  onClick={() => ocultarAba(tab.id)}
                  className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-foreground text-background grid place-items-center ring-2 ring-background shadow"
                >
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}

        {!editando && !demo && abas.enxuta && (
          <button
            type="button"
            onClick={() => abas.mostrarTodas()}
            data-track="abas-mostrar-todas"
            data-testid="abas-mostrar-todas"
            className="notion-tab whitespace-nowrap text-[11px] font-semibold text-foreground/80 border-transparent hover:bg-muted shrink-0 px-2.5 underline decoration-dotted underline-offset-4"
          >
            Ver todas
          </button>
        )}

        {/* A porta da folha: fantasma, sem borda. Só o ícone quando nada está oculto. */}
        {!editando && !demo && (
          <button
            type="button"
            onClick={abrirFolha}
            aria-label={ocultas.length > 0 ? `${ocultas.length} ${ocultas.length === 1 ? "aba oculta" : "abas ocultas"}` : "Organizar abas"}
            data-track="abas-organizar"
            data-testid="abas-organizar"
            className="notion-tab whitespace-nowrap text-[11px] text-muted-foreground border-transparent hover:bg-muted shrink-0 px-2.5 gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            {ocultas.length > 0 && !abas.enxuta && <span>+{ocultas.length} {ocultas.length === 1 ? "oculta" : "ocultas"}</span>}
          </button>
        )}
      </div>

      {editando && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-muted-foreground">
            {podeOcultar ? "Toque no × pra ocultar uma aba." : "A última aba não pode ser ocultada."}
          </p>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-full bg-foreground text-background text-[11px] font-bold px-3.5 py-1.5 shrink-0"
          >
            Pronto
          </button>
        </div>
      )}

      <FolhaOrganizarAbas abas={abas} aberta={folha} onFechar={() => setFolha(false)} ocultarAba={ocultarAba} />
    </div>
  );
}

/* ------------------------------------------------------------------ a folha "Organizar abas" */

interface FolhaProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  aberta: boolean;
  onFechar: () => void;
  ocultarAba: (id: string) => boolean;
}

function FolhaOrganizarAbas<T extends AbaOcultavel>({ abas, aberta, onFechar, ocultarAba }: FolhaProps<T>) {
  const { todas, visiveis, ocultas, mostrar, mostrarTodas, mover } = abas;
  const semMovimento = !!useReducedMotion();
  const arrasto = useFolhaArrastavel(onFechar, semMovimento);

  // Esc fecha (teclado no site / leitor de tela)
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberta, onFechar]);

  if (typeof document === "undefined") return null;
  // Portal: o cabeçalho dos módulos é `sticky` e a página pode estar dentro de uma transição com transform — `fixed`
  // lá dentro ficaria preso à página, não à tela.
  return createPortal(
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" tabIndex={-1} onClick={onFechar} className={CLASSE_FUNDO_FOLHA} {...propsDoFundo(semMovimento)} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Organizar abas" data-testid="abas-organizar-folha"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card text-foreground border-t border-border max-h-[85dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-0.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-1">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Organizar abas</h3>
                <p className="text-[12.5px] text-muted-foreground leading-snug">
                  Deixe à vista só o que você usa. Ocultar não apaga nada — a aba volta quando você liga.
                </p>
              </div>
              <button type="button" onClick={onFechar} data-testid="abas-organizar-pronto" className="h-9 px-3.5 rounded-full text-[13px] font-bold shrink-0 bg-foreground text-background">Pronto</button>
            </div>
            <ul className="mt-2">
              {todas.map((tab, i) => {
                const visivel = visiveis.some((a) => a.id === tab.id);
                const ultima = visivel && visiveis.length === 1;
                return (
                  <li key={tab.id} data-testid="abas-organizar-linha" data-aba={tab.id} data-oculta={visivel ? "0" : "1"} className="flex items-center gap-2.5 min-h-[56px] px-1 border-t border-border/60 first:border-t-0">
                    <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-muted text-[18px] ${visivel ? "" : "opacity-45"}`} aria-hidden>{tab.icon ?? "•"}</span>
                    <span className={`flex-1 min-w-0 text-[13px] font-bold uppercase tracking-wide truncate ${visivel ? "" : "text-muted-foreground"}`}>{tab.label}</span>
                    {mover && (
                      <span className="flex flex-col">
                        <button type="button" onClick={() => mover(tab.id, -1)} disabled={i === 0} aria-label={`Mover ${tab.label} pra cima`} data-track="aba-mover-frente" className="w-9 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronUp className="w-4 h-4" strokeWidth={2.2} /></button>
                        <button type="button" onClick={() => mover(tab.id, 1)} disabled={i === todas.length - 1} aria-label={`Mover ${tab.label} pra baixo`} data-track="aba-mover-tras" className="w-9 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronDown className="w-4 h-4" strokeWidth={2.2} /></button>
                      </span>
                    )}
                    <Switch
                      checked={visivel}
                      disabled={ultima}
                      aria-label={`${visivel ? "Ocultar" : "Mostrar"} ${rotuloDe(tab)}`}
                      data-track={`aba-mostrar:${tab.id}`}
                      onCheckedChange={(on) => { if (on) mostrar(tab.id); else ocultarAba(tab.id); }}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="px-1 pt-2 text-[11.5px] text-muted-foreground">
              {visiveis.length === 1 ? "Pelo menos uma aba fica sempre à vista." : "Dica: segurar uma aba na fileira também oculta."}
            </p>
            {ocultas.length > 0 && (
              <button type="button" onClick={() => mostrarTodas()} data-testid="abas-organizar-mostrar-todas" className="w-full h-12 mt-3 rounded-2xl text-[14px] font-bold border border-border">
                Mostrar todas as abas
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
