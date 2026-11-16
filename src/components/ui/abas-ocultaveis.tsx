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
 *
 * 07/11 — CADERNO COM SUMÁRIO (lib/abas-caderno, SPEC novidades-guardadas/2026-11-07/trial-abas/SPEC.md), SÓ CONTA NOVA e
 * só com as chaves fora do padrão (`abas.visual` / `abas.porta` vêm do hook). Com as chaves no padrão, este arquivo
 * desenha a fileira de antes, byte a byte (src/test/abas-caderno-identico.test.tsx). Fora do padrão:
 *  - visual "fixa"/"caderno": a porta fica FORA da faixa que rola, presa à direita (nunca mais "Ve" cortado); "caderno"
 *    = divisória em 2 linhas (emoji em cima, nome embaixo, 11 px), a aberta branca com faixa de 4 px na cor do módulo
 *    (paleta da Home nova, TOM_DO_MODULO); a fileira se ajusta sozinha em degraus (porta compacta → espaço menor → nome
 *    em 2 linhas na aba mais longa → rola com esmaecido) e a letra nunca fica abaixo de 11 px;
 *  - braço "sumario": a porta "Sumário +N" abre a folha-índice (components/ui/sumario-abas) que NÃO grava nada ao abrir;
 *  - com a medição nova (`abas.medir`): `aba_aberta {modulo, aba, origem, oculta}` a cada troca, separando a aba que
 *    o app abriu sozinho (entrada/link/missão) da que a pessoa escolheu (fileira/sumário/dica).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import type { AbaOcultavel, AbasOcultas, OrigemDaAba } from "@/hooks/use-abas-ocultas";
import { ABAS_QUE_NUNCA_SAEM } from "@/lib/abas-enxutas";
import { todasAsAbasSeguras } from "@/lib/abas-ocultas";
import { TOM_DO_MODULO } from "@/components/home-nova/e/paleta";
import { FolhaSumario } from "@/components/ui/sumario-abas";
import { Switch } from "@/components/ui/switch";
import { trackEvent } from "@/lib/analytics";
import { emCaminhoDeDemo } from "@/lib/caminho-demo";
import {
  EVENTO_ABRIR_ABA, EVENTO_DICAS_DE_NOVO, EVENTO_ORGANIZAR_ABAS, dicasDoModulo, type DetalheAbrirAba, type DetalheDicasDeNovo, type DetalheOrganizar,
} from "@/lib/dicas-do-modulo";
import { useUserData } from "@/hooks/use-user-data";
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
/** A conta, ou null quando a fileira está fora do provider (o useContext roda sempre — a ordem dos hooks não muda). */
const useContaSePuder = () => {
  try { return useUserData(); } catch { return null; }
};
const rotuloDe = (t: AbaOcultavel) => `${t.icon ? `${t.icon} ` : ""}${t.label}`;

/** A cor do módulo (a mesma da Home nova, tom "suave"), pra faixa da divisória e do sumário. Sem módulo: a tinta. */
export const corDoModulo = (modulo?: string): string => {
  const t = modulo ? TOM_DO_MODULO[modulo] : undefined;
  return t ? `oklch(${t.L4} ${t.C4} ${t.h})` : "hsl(var(--foreground))";
};
/** Os degraus do ajuste da fileira nova (SPEC §3.2): 0 normal · 1 porta compacta · 2 espaço menor · 3 nome em 2 linhas
 *  na aba mais longa · 4 rola com esmaecido. Abaixo de 380 px já começa compacta. */
const NIVEL_MAX = 4;
const nivelInicial = (): number => { try { return window.innerWidth < 380 ? 1 : 0; } catch { return 0; } };

export function AbasOcultaveis<T extends AbaOcultavel>({ abas, ativa, onTrocar, className = "", testIds = false, comoTab = false, corrigirAbaDesconhecida = true, rotuloDaFileira }: AbasOcultaveisProps<T>) {
  const { visiveis, ocultas, todas, ocultar, podeOcultar, modulo } = abas;
  const [editando, setEditando] = useState(false);
  const [folha, setFolha] = useState(false);
  const [sumario, setSumario] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  // 07/11 (caderno): fora do padrão, só pra conta nova — `abas.visual`/`abas.porta` ausentes = a fileira de antes
  const visual = abas.visual;
  const portaSumario = abas.porta === "sumario";
  const nova = !!visual || portaSumario;
  const presa = visual === "fixa" || visual === "caderno";
  const faixa = useRef<HTMLDivElement>(null);
  const origemDaTroca = useRef<OrigemDaAba | null>(null);
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
  const ocultarAba = useCallback((id: string, origem?: OrigemDaAba) => {
    const ok = ocultar(id, origem);
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
    if (nova) {
      // caderno/fixa: só rola a faixa (nunca a página) e só quando a aba aberta não está inteira na tela (Finanças não
      // abre mais rolada)
      const f = faixa.current;
      if (!el || !f) return;
      const a = el.getBoundingClientRect(), b = f.getBoundingClientRect();
      if (a.left >= b.left - 1 && a.right <= b.right + 1) return;
      try { f.scrollTo({ left: Math.max(0, f.scrollLeft + (a.right > b.right ? a.right - b.right + 8 : a.left - b.left - 8)) }); } catch { /* sem suporte */ }
      return;
    }
    try { el?.scrollIntoView?.({ inline: "nearest", block: "nearest" }); } catch { /* sem suporte: fica onde está */ }
  }, [assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // 16/11 (App Store 4★ 06/11, "o deslizar da tela mexe ícones que não deveriam"): deslizar a FILEIRA de abas pro lado
  // (ou a página) é rolagem nativa do iPhone, e nela o touchmove nem sempre chega ao botão — o tempo seguia correndo e
  // as abas entravam no modo de editar (balançando, com o ×) no meio do deslizar. Agora qualquer rolagem (de qualquer
  // contêiner: captura) e o touchcancel do sistema desarmam o "segurar", igual ao use-long-press dos widgets (28/10).
  useEffect(() => {
    const rolou = () => { if (timer.current) soltar(); };
    window.addEventListener("scroll", rolou, true);
    return () => window.removeEventListener("scroll", rolou, true);
  }, []);

  const clicarAba = (id: string) => {
    if (segurou.current) { segurou.current = false; return; }
    if (editando) return; // no modo de editar, o toque na aba não navega — o × é a ação
    if (abas.medir && id !== ativa) origemDaTroca.current = "fileira";
    onTrocar(id);
  };

  const abrirFolha = () => {
    setEditando(false);
    if (portaSumario) {
      // braço sumário: a porta (e a 3ª dica) abre o índice — abrir NÃO grava nada na conta
      setSumario(true);
      trackEvent("sumario_aberto", { modulo: modulo ?? "", guardadas: ocultas.length });
      return;
    }
    setFolha(true);
    trackEvent("abas_organizar_aberto", { modulo: modulo ?? "", ocultas: ocultas.length });
  };

  // 07/11 — `aba_aberta` (medição nova): separa a aba que o app abriu sozinho da que a pessoa escolheu
  const primeiraAba = useRef(true);
  useEffect(() => {
    if (!abas.medir || !modulo) return;
    let origem: OrigemDaAba;
    if (primeiraAba.current) origem = ativa === (ABAS_QUE_NUNCA_SAEM[modulo]?.[0] ?? visiveis[0]?.id) ? "entrada" : "link";
    else origem = origemDaTroca.current ?? (todasAsAbasSeguras() ? "missao" : "link");
    primeiraAba.current = false;
    origemDaTroca.current = null;
    trackEvent("aba_aberta", { modulo, aba: ativa, origem, oculta: ocultas.some((a) => a.id === ativa) });
  }, [ativa]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Dicas para começar" tocáveis (lib/dicas-do-modulo, 28/10): a dica abre a aba (mesmo oculta — como um link) ou a folha.
  const abrirFolhaRef = useRef(abrirFolha);
  abrirFolhaRef.current = abrirFolha;
  useEffect(() => {
    if (!modulo) return;
    const abrirAba = (e: Event) => {
      const d = (e as CustomEvent<DetalheAbrirAba>).detail;
      if (d?.modulo === modulo && todas.some((a) => a.id === d.aba)) {
        if (abas.medir) origemDaTroca.current = "dica";
        onTrocar(d.aba);
      }
    };
    const organizar = (e: Event) => {
      if ((e as CustomEvent<DetalheOrganizar>).detail?.modulo === modulo) abrirFolhaRef.current();
    };
    window.addEventListener(EVENTO_ABRIR_ABA, abrirAba);
    window.addEventListener(EVENTO_ORGANIZAR_ABAS, organizar);
    return () => { window.removeEventListener(EVENTO_ABRIR_ABA, abrirAba); window.removeEventListener(EVENTO_ORGANIZAR_ABAS, organizar); };
  }, [modulo, todas, onTrocar, abas.medir]);

  // A fileira: as visíveis + a ativa se ela estiver oculta (link profundo), na ordem da pessoa.
  const visIds = new Set(visiveis.map((a) => a.id));
  const demo = fileiraDeDemo();
  const naFileira = todas.filter((a) => visIds.has(a.id) || a.id === ativa);

  if (nova) {
    return (
      <FileiraNova
        raiz={raiz} faixa={faixa} abas={abas} ativa={ativa} naFileira={naFileira} visIds={visIds} className={className}
        testIds={testIds} comoTab={comoTab} rotuloDaFileira={rotuloDaFileira} editando={editando} setEditando={setEditando}
        demo={demo} presa={presa} portaSumario={portaSumario} clicarAba={clicarAba} ocultarAba={ocultarAba}
        abrirFolha={abrirFolha} toque={{ comecarSegurar, soltar }}
        folha={folha} fecharFolha={() => setFolha(false)} sumario={sumario} fecharSumario={() => setSumario(false)}
        abrirDoSumario={(id) => { if (abas.medir && id !== ativa) origemDaTroca.current = "sumario"; onTrocar(id); }}
      />
    );
  }

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
                onTouchCancel={soltar}
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

/* ------------------------------------------------------------------ a fileira nova (caderno / fixa / porta do sumário) */

interface FileiraNovaProps<T extends AbaOcultavel> {
  raiz: RefObject<HTMLDivElement>;
  faixa: RefObject<HTMLDivElement>;
  abas: AbasOcultas<T>;
  ativa: string;
  naFileira: T[];
  visIds: Set<string>;
  className: string;
  testIds: boolean;
  comoTab: boolean;
  rotuloDaFileira?: string;
  editando: boolean;
  setEditando: (v: boolean) => void;
  demo: boolean;
  presa: boolean;
  portaSumario: boolean;
  clicarAba: (id: string) => void;
  ocultarAba: (id: string, origem?: OrigemDaAba) => boolean;
  abrirFolha: () => void;
  toque: { comecarSegurar: () => void; soltar: () => void };
  folha: boolean;
  fecharFolha: () => void;
  sumario: boolean;
  fecharSumario: () => void;
  abrirDoSumario: (id: string) => void;
}

function FileiraNova<T extends AbaOcultavel>(p: FileiraNovaProps<T>) {
  const { abas, ativa, naFileira, visIds, editando, demo, presa, portaSumario } = p;
  const { ocultas, podeOcultar, modulo, visual } = abas;
  const caderno = visual === "caderno";
  const cor = corDoModulo(modulo);

  // o ajuste em degraus: sobe um degrau enquanto a faixa passar da largura (cada degrau re-renderiza antes de pintar)
  const [largura, setLargura] = useState(() => { try { return window.innerWidth; } catch { return 0; } });
  // visual de hoje (só a porta do sumário muda): sem degraus — a fileira fica a de hoje, só a porta é outra (SPEC §5.1)
  const inicial = () => (presa ? nivelInicial() : 0);
  const [nivel, setNivel] = useState(inicial);
  const [rolaMais, setRolaMais] = useState(false);
  useEffect(() => {
    const mudou = () => setLargura(window.innerWidth);
    window.addEventListener("resize", mudou);
    return () => window.removeEventListener("resize", mudou);
  }, []);
  const assinatura = `${naFileira.map((a) => a.id).join("|")}|${ocultas.length}|${largura}|${editando}`;
  useLayoutEffect(() => { setNivel(inicial()); }, [assinatura]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const f = p.faixa.current;
    if (!f) return;
    const passa = f.scrollWidth > f.clientWidth + 1;
    if (presa && passa && nivel < NIVEL_MAX) { setNivel(nivel + 1); return; }
    const fim = f.scrollLeft + f.clientWidth >= f.scrollWidth - 2;
    setRolaMais(passa && !fim);
  });
  const aoRolar = () => {
    const f = p.faixa.current;
    if (f) setRolaMais(f.scrollLeft + f.clientWidth < f.scrollWidth - 2);
  };

  const compacta = nivel >= 1;
  const espacoMenor = nivel >= 2;
  // degrau 3: a aba de rótulo mais longo (com espaço) quebra em 2 linhas
  const quebra = nivel >= 3 && caderno
    ? naFileira.filter((a) => a.label.includes(" ")).sort((a, b) => b.label.length - a.label.length)[0]?.id
    : undefined;
  const n = ocultas.length;
  const portaVerTodas = !portaSumario && !!abas.enxuta;

  const classeDaAba = (tab: T, oculta: boolean) => {
    const ativaAqui = ativa === tab.id;
    if (caderno) {
      return [
        "relative flex flex-col items-center justify-end min-h-[48px] pt-2 pb-1.5 rounded-t-lg border select-none",
        "text-[11px] font-semibold uppercase tracking-wide leading-tight",
        espacoMenor ? "px-2" : "px-3",
        quebra === tab.id ? "whitespace-normal max-w-[84px] text-center" : "whitespace-nowrap",
        ativaAqui ? "bg-background text-foreground border-border border-b-background -mb-px z-[1]" : "bg-muted/70 text-muted-foreground border-transparent hover:text-foreground",
        oculta ? "border-dashed !border-border" : "",
      ].join(" ");
    }
    // "fixa" (plano B) e o visual de hoje com a porta do sumário: a pílula de hoje
    return `notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 select-none ${espacoMenor ? "!px-3" : ""} ${
      ativaAqui ? "notion-tab-active" : "hover:bg-muted"
    } ${oculta ? "border-dashed" : ""}`;
  };

  const porta = editando || demo ? null : portaSumario ? (
    <button
      type="button"
      onClick={p.abrirFolha}
      aria-label={n > 0 ? `Sumário, ${n} ${n === 1 ? "aba guardada" : "abas guardadas"}` : "Sumário"}
      data-track="abas-sumario"
      data-testid="abas-sumario"
      className={`${caderno ? "min-h-[48px] items-end pb-2" : "notion-tab items-center border-transparent"} whitespace-nowrap text-[11px] font-semibold text-foreground/80 hover:bg-muted shrink-0 px-2 flex gap-1 underline decoration-dotted underline-offset-4`}
    >
      <Bookmark className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {!compacta && <span>Sumário</span>}
      {n > 0 && <span>+{n}</span>}
    </button>
  ) : portaVerTodas ? (
    <button
      type="button"
      onClick={() => abas.mostrarTodas("fileira")}
      data-track="abas-mostrar-todas"
      data-testid="abas-mostrar-todas"
      aria-label={compacta ? `Ver todas as abas (${n} guardadas)` : undefined}
      className={`${caderno ? "min-h-[48px] items-end pb-2" : "notion-tab items-center border-transparent"} whitespace-nowrap text-[11px] font-semibold text-foreground/80 hover:bg-muted shrink-0 px-2 flex underline decoration-dotted underline-offset-4`}
    >
      {compacta ? `+${n}` : "Ver todas"}
    </button>
  ) : (
    <button
      type="button"
      onClick={p.abrirFolha}
      aria-label={n > 0 ? `${n} ${n === 1 ? "aba oculta" : "abas ocultas"}` : "Organizar abas"}
      data-track="abas-organizar"
      data-testid="abas-organizar"
      className={`${caderno ? "min-h-[48px] items-end pb-2.5" : "notion-tab items-center border-transparent"} whitespace-nowrap text-[11px] text-muted-foreground hover:bg-muted shrink-0 px-2 flex gap-1`}
    >
      <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
      {n > 0 && <span>+{n}{compacta ? "" : ` ${n === 1 ? "oculta" : "ocultas"}`}</span>}
    </button>
  );

  const mascara = rolaMais ? { WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent)", maskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent)" } : undefined;

  return (
    <div ref={p.raiz} className={`relative ${p.className}`} data-abas-visual={visual ?? "hoje"} data-abas-porta={portaSumario ? "sumario" : "hoje"} data-abas-nivel={nivel}>
      <div className={`flex ${caderno ? "items-end border-b border-border" : "items-center"}`}>
        <div
          ref={p.faixa}
          onScroll={aoRolar}
          className={`flex flex-1 ${caderno ? "items-end" : ""} overflow-x-auto scrollbar-hide pt-2 -mt-2 min-w-0`}
          style={{ columnGap: espacoMenor ? 2 : 4, ...mascara }}
          role={p.comoTab ? "tablist" : undefined}
          aria-label={p.rotuloDaFileira}
        >
          {naFileira.map((tab) => {
            const oculta = !visIds.has(tab.id);
            const mostraX = editando && podeOcultar && !oculta;
            return (
              <div key={tab.id} className={`relative shrink-0 flex ${editando ? "animate-jiggle motion-reduce:animate-none" : ""}`}>
                <button
                  type="button"
                  role={p.comoTab ? "tab" : undefined}
                  aria-selected={p.comoTab ? ativa === tab.id : undefined}
                  data-active={ativa === tab.id}
                  data-spotlight={tab.spotlight ?? `tab-${tab.id}`}
                  data-testid={p.testIds ? `aba-${tab.id}` : undefined}
                  data-oculta={oculta ? "1" : undefined}
                  onClick={() => p.clicarAba(tab.id)}
                  onContextMenu={(e) => { e.preventDefault(); p.setEditando(true); }}
                  onMouseDown={p.toque.comecarSegurar}
                  onMouseUp={p.toque.soltar}
                  onMouseLeave={p.toque.soltar}
                  onTouchStart={p.toque.comecarSegurar}
                  onTouchEnd={p.toque.soltar}
                  onTouchMove={p.toque.soltar}
                  onTouchCancel={p.toque.soltar}
                  className={classeDaAba(tab, oculta)}
                >
                  {caderno && ativa === tab.id && (
                    <span aria-hidden data-faixa-cor={cor} className="absolute -top-px -left-px -right-px h-1 rounded-t-lg" style={{ background: cor }} />
                  )}
                  {caderno ? (
                    <>
                      {tab.icon && <span aria-hidden className="text-[15px] leading-none mb-1">{tab.icon}</span>}
                      <span>{tab.label}</span>
                    </>
                  ) : (
                    <>
                      {tab.icon && <span aria-hidden={p.comoTab ? true : undefined}>{tab.icon}</span>}
                      {tab.label}
                    </>
                  )}
                </button>
                {mostraX && (
                  <button
                    type="button"
                    aria-label={`Ocultar aba ${rotuloDe(tab)}`}
                    data-track={`aba-ocultar:${tab.id}`}
                    onClick={() => p.ocultarAba(tab.id, "fileira")}
                    className="absolute -top-1.5 -right-1.5 z-[2] w-[18px] h-[18px] rounded-full bg-foreground text-background grid place-items-center ring-2 ring-background shadow"
                  >
                    <X className="w-3 h-3" strokeWidth={3} />
                  </button>
                )}
              </div>
            );
          })}
          {/* sem visual novo (só o braço sumário): a porta continua no fim da faixa, como o "Ver todas" de hoje */}
          {!presa && porta}
        </div>
        {presa && porta}
      </div>

      {editando && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-muted-foreground">
            {podeOcultar ? "Toque no × pra ocultar uma aba." : "A última aba não pode ser ocultada."}
          </p>
          <button
            type="button"
            onClick={() => p.setEditando(false)}
            className="rounded-full bg-foreground text-background text-[11px] font-bold px-3.5 py-1.5 shrink-0"
          >
            Pronto
          </button>
        </div>
      )}

      {portaSumario ? (
        <FolhaSumario
          abas={abas} aberta={p.sumario} onFechar={p.fecharSumario} ativa={ativa} cor={cor}
          onAbrir={(id) => { p.fecharSumario(); p.abrirDoSumario(id); }}
          ocultarAba={(id) => p.ocultarAba(id, "sumario")}
        />
      ) : (
        <FolhaOrganizarAbas abas={abas} aberta={p.folha} onFechar={p.fecharFolha} ocultarAba={(id) => p.ocultarAba(id, "folha")} origem="folha" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ a folha "Organizar abas" */

/** Os textos da folha. A fileira de abas usa os padrões; as Ações rápidas da Home de hoje (07/11) falam em "ação". */
export interface TextosDaFolhaOrganizar {
  titulo: string;
  descricao: string;
  /** O rodapé com mais de uma visível; null = sem rodapé (a fileira de ações não tem o "segurar"). */
  dica: string | null;
  /** O rodapé quando só resta uma visível. */
  minimo: string;
  mostrarTodas: string;
}
const TEXTOS_ABAS: TextosDaFolhaOrganizar = {
  titulo: "Organizar abas",
  descricao: "Deixe à vista só o que você usa. Ocultar não apaga nada — a aba volta quando você liga.",
  dica: "Dica: segurar uma aba na fileira também oculta.",
  minimo: "Pelo menos uma aba fica sempre à vista.",
  mostrarTodas: "Mostrar todas as abas",
};

interface FolhaProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  aberta: boolean;
  onFechar: () => void;
  ocultarAba: (id: string) => boolean;
  /** Outra lista que não é de abas (as Ações rápidas da Home): troca os textos. */
  textos?: Partial<TextosDaFolhaOrganizar>;
  /** O quadrado da linha quando não é o emoji da aba (as Ações rápidas desenham o ícone da ação na cor dela). */
  icone?: (item: T) => ReactNode;
  /** 07/11: a origem que vai nos eventos (só com a medição nova; a fileira de antes não passa). */
  origem?: OrigemDaAba;
}

/** A folha, sozinha (07/11): as Ações rápidas da Home de hoje montam a MESMA folha sem a fileira de abas. */
export function FolhaOrganizarAbas<T extends AbaOcultavel>({ abas, aberta, onFechar, ocultarAba, textos, icone, origem }: FolhaProps<T>) {
  const { todas, visiveis, ocultas, mostrar, mostrarTodas, mover, modulo } = abas;
  const t = { ...TEXTOS_ABAS, ...textos };
  const rodape = visiveis.length === 1 ? t.minimo : t.dica;
  const semMovimento = !!useReducedMotion();
  /* 01/11 (chamado 00f3064c): o X das "Dicas para começar" grava `core-tip-seen-<módulo>` e não tinha volta. Linha
     discreta no fim da folha: só quando o módulo tem dicas e a marca existe; apaga a marca e fecha a folha.
     Fileira montada fora da conta (sem provider, o useUserData lança) só não mostra a linha. */
  const conta = useContaSePuder();
  const chaveDaDica = modulo ? `core-tip-seen-${modulo}` : "";
  const podeVerDicas = !!conta && !!modulo && !fileiraDeDemo() && dicasDoModulo(modulo).length > 0 && !!conta.get<unknown>(chaveDaDica, "");
  const verDicasDeNovo = () => {
    if (!modulo || !conta) return;
    conta.set(chaveDaDica, "");
    window.dispatchEvent(new CustomEvent<DetalheDicasDeNovo>(EVENTO_DICAS_DE_NOVO, { detail: { modulo } }));
    trackEvent("dicas_de_novo", { modulo });
    onFechar();
  };
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
            role="dialog" aria-modal="true" aria-label={t.titulo} data-testid="abas-organizar-folha"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card text-foreground border-t border-border max-h-[85dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-0.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-1">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">{t.titulo}</h3>
                <p className="text-[12.5px] text-muted-foreground leading-snug">{t.descricao}</p>
              </div>
              <button type="button" onClick={onFechar} data-testid="abas-organizar-pronto" className="h-9 px-3.5 rounded-full text-[13px] font-bold shrink-0 bg-foreground text-background">Pronto</button>
            </div>
            <ul className="mt-2">
              {todas.map((tab, i) => {
                const visivel = visiveis.some((a) => a.id === tab.id);
                const ultima = visivel && visiveis.length === 1;
                return (
                  <li key={tab.id} data-testid="abas-organizar-linha" data-aba={tab.id} data-oculta={visivel ? "0" : "1"} className="flex items-center gap-2.5 min-h-[56px] px-1 border-t border-border/60 first:border-t-0">
                    <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 text-[18px] ${icone ? "" : "bg-muted"} ${visivel ? "" : "opacity-45"}`} aria-hidden>{icone ? icone(tab) : (tab.icon ?? "•")}</span>
                    <span className={`flex-1 min-w-0 text-[13px] font-bold truncate ${icone ? "" : "uppercase tracking-wide"} ${visivel ? "" : "text-muted-foreground"}`}>{tab.label}</span>
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
                      onCheckedChange={(on) => { if (on) mostrar(tab.id, origem); else ocultarAba(tab.id); }}
                    />
                  </li>
                );
              })}
            </ul>
            {rodape && <p className="px-1 pt-2 text-[11.5px] text-muted-foreground">{rodape}</p>}
            {ocultas.length > 0 && (
              <button type="button" onClick={() => mostrarTodas(origem)} data-testid="abas-organizar-mostrar-todas" className="w-full h-12 mt-3 rounded-2xl text-[14px] font-bold border border-border">
                {t.mostrarTodas}
              </button>
            )}
            {podeVerDicas && (
              <button type="button" onClick={verDicasDeNovo} data-testid="abas-ver-dicas-de-novo" className="w-full mt-2 py-2 text-[12.5px] text-muted-foreground underline decoration-dotted underline-offset-4">
                Ver dicas de novo
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
