/**
 * BARRA DE ABAS COM "OCULTAR ABA" — par do hook useAbasOcultas.
 *
 * Pedido de duas avaliações da Play ("Opção de ocultar certas abas (ex.
 * jejum intermitente)" e "mover, editar, ocultar"). A barra é a MESMA que as
 * páginas já desenhavam na mão (classes `notion-tab`, `data-active` pro
 * useScrollActiveTabIntoView, `data-spotlight="tab-{id}"` pro tutorial).
 *
 * Segunda versão (12/09, mockup aprovado pelo dono — "não tem forma mais
 * bonita do que esse quadrado com três pontos?"). O "⋯" que ficava no fim da
 * fila saiu. Agora:
 *  - SEGURAR uma aba (ou botão direito) entra no modo de editar: as abas
 *    balançam de leve e cada uma ganha um "×" no canto, como apagar app no
 *    iPhone. Toca no × pra ocultar; "Pronto" (ou um toque fora) sai.
 *  - Quando existe aba oculta, um chip FANTASMA sem borda aparece no fim da
 *    fila ("+1 oculta"). Um toque abre a folha "Abas deste módulo", com uma
 *    chave por aba — é lá que se traz de volta. Sem nada oculto, a fila
 *    fica limpa: zero elemento novo pra quem nunca mexeu.
 *
 * A última aba visível nunca some (o × dela não aparece, e o hook recusa).
 * Quando a aba ativa some, o componente troca sozinho pra primeira visível —
 * sem isso a página renderizaria nada abaixo do cabeçalho.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AbaOcultavel, AbasOcultas } from "@/hooks/use-abas-ocultas";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

interface AbasOcultaveisProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  ativa: string;
  onTrocar: (id: string) => void;
  /** Classe extra do contêiner (as páginas usam max-w-* mx-auto px-4 pb-2). */
  className?: string;
}

const SEGURAR_MS = 500;

export function AbasOcultaveis<T extends AbaOcultavel>({ abas, ativa, onTrocar, className = "" }: AbasOcultaveisProps<T>) {
  const { visiveis, ocultas, todas, ocultar, mostrar, podeOcultar } = abas;
  const [editando, setEditando] = useState(false);
  const [folha, setFolha] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  // segurar entra no modo de editar; o clique que vem logo depois no mesmo
  // toque NÃO pode trocar de aba (a pessoa nem soltou o dedo pra isso)
  const segurou = useRef(false);

  // A aba ativa foi ocultada (ou nunca existiu): cai na primeira visível.
  useEffect(() => {
    if (visiveis.length === 0) return;
    if (!visiveis.some(a => a.id === ativa)) onTrocar(visiveis[0].id);
  }, [visiveis, ativa, onTrocar]);

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

  return (
    /* O menu/folha fica FORA da faixa que rola (12/09, vídeo do dono no app da
       Play): um filho `absolute` dentro de `overflow-x-auto` é cortado e vira
       rolagem vertical da própria faixa. A faixa rola sozinha; o resto ancora
       no contêiner de fora. */
    <div ref={raiz} className={`relative ${className}`}>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pt-2 -mt-2">
        {visiveis.map(tab => {
          const mostraX = editando && podeOcultar;
          const rotulo = `${tab.icon ? `${tab.icon} ` : ""}${tab.label}`;
          return (
            /* O × é IRMÃO do botão da aba, não filho: botão dentro de botão
               não é HTML válido e confunde leitor de tela. */
            <div key={tab.id} className={`relative shrink-0 ${editando ? "animate-jiggle motion-reduce:animate-none" : ""}`}>
              <button
                type="button"
                data-active={ativa === tab.id}
                data-spotlight={`tab-${tab.id}`}
                onClick={() => clicarAba(tab.id)}
                onContextMenu={e => { e.preventDefault(); setEditando(true); }}
                onMouseDown={comecarSegurar}
                onMouseUp={soltar}
                onMouseLeave={soltar}
                onTouchStart={comecarSegurar}
                onTouchEnd={soltar}
                onTouchMove={soltar}
                className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 select-none ${
                  ativa === tab.id ? "notion-tab-active" : "hover:bg-muted"
                }`}
              >
                {tab.icon && <span>{tab.icon}</span>}
                {tab.label}
              </button>
              {mostraX && (
                <button
                  type="button"
                  aria-label={`Ocultar aba ${rotulo}`}
                  onClick={() => ocultar(tab.id)}
                  className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-foreground text-background grid place-items-center ring-2 ring-background shadow"
                >
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}

        {/* Chip fantasma: só existe quando há aba oculta. É a porta da folha. */}
        {ocultas.length > 0 && !editando && (
          <button
            type="button"
            onClick={() => setFolha(true)}
            aria-label={`${ocultas.length} ${ocultas.length === 1 ? "aba oculta" : "abas ocultas"}`}
            className="notion-tab whitespace-nowrap text-[11px] text-muted-foreground border-transparent hover:bg-muted shrink-0 px-2"
          >
            +{ocultas.length} {ocultas.length === 1 ? "oculta" : "ocultas"}
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

      <Sheet open={folha} onOpenChange={setFolha}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="p-0 z-[300] rounded-t-[28px] border-x-0 border-b-0 max-h-[85dvh] overflow-y-auto pb-[max(1.25rem,var(--app-safe-bottom))]"
          overlayClassName="z-[290]"
        >
          <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
          </div>
          <SheetHeader className="px-5 pt-4 pb-2">
            <SheetTitle className="text-xs font-black uppercase tracking-wider text-left">Abas deste módulo</SheetTitle>
          </SheetHeader>
          <ul className="px-5">
            {todas.map(tab => {
              const visivel = visiveis.some(a => a.id === tab.id);
              const ultima = visivel && visiveis.length === 1;
              return (
                <li key={tab.id} className="flex items-center gap-3 py-3 border-t border-border/60 first:border-t-0 text-sm font-semibold">
                  {tab.icon && <span>{tab.icon}</span>}
                  <span className="flex-1 min-w-0 truncate">{tab.label}</span>
                  <Switch
                    checked={visivel}
                    disabled={ultima}
                    aria-label={`${visivel ? "Ocultar" : "Mostrar"} ${tab.icon ? `${tab.icon} ` : ""}${tab.label}`}
                    onCheckedChange={(on) => { if (on) mostrar(tab.id); else ocultar(tab.id); }}
                  />
                </li>
              );
            })}
          </ul>
          <p className="px-5 pt-2 text-[11px] text-muted-foreground">Segure uma aba na fila pra ocultar por ali também.</p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
