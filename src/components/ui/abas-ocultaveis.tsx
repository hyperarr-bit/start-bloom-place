/**
 * BARRA DE ABAS COM "OCULTAR ABA" (07/09) — par do hook useAbasOcultas.
 *
 * Pedido de duas avaliações da Play ("Opção de ocultar certas abas (ex.
 * jejum intermitente)" e "mover, editar, ocultar"). A barra é a MESMA que as
 * páginas já desenhavam na mão (classes `notion-tab`, `data-active` pro
 * useScrollActiveTabIntoView, `data-spotlight="tab-{id}"` pro tutorial); o
 * que entra é um "⋯" discreto no fim da fila e o segurar-o-dedo numa aba.
 *
 * Dois caminhos pra mesma ação de propósito: o ⋯ é descobrível (quem lê a
 * avaliação e procura "onde oculto?" acha em 1 toque); o segurar é rápido pra
 * quem já sabe. "Mostrar abas ocultas" mora no mesmo ⋯ — módulo não tem tela
 * de configurações própria, e esse menu É a configuração do módulo.
 *
 * Quando a aba ativa some (ela ocultou a aba em que estava), o componente
 * troca sozinho pra primeira visível — sem isso a página renderizaria nada
 * abaixo do cabeçalho.
 *
 * Sem Radix/Popover de propósito: menu é um <div> absoluto com estado local,
 * fecha em qualquer toque fora — mais leve e testável em jsdom.
 */
import { useEffect, useRef, useState } from "react";
import { EyeOff, Eye, MoreHorizontal } from "lucide-react";
import type { AbaOcultavel, AbasOcultas } from "@/hooks/use-abas-ocultas";

interface AbasOcultaveisProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  ativa: string;
  onTrocar: (id: string) => void;
  /** Classe extra do contêiner (as páginas usam max-w-* mx-auto px-4 pb-2). */
  className?: string;
}

const SEGURAR_MS = 550;

export function AbasOcultaveis<T extends AbaOcultavel>({ abas, ativa, onTrocar, className = "" }: AbasOcultaveisProps<T>) {
  const { visiveis, ocultas, ocultar, mostrar, mostrarTodas, podeOcultar } = abas;
  // `alvo` = aba que o menu está oferecendo ocultar (a segurada, ou a ativa no ⋯)
  const [menu, setMenu] = useState<{ alvo: string } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  // segurar dispara o menu; o clique que vem logo depois no mesmo toque NÃO
  // pode trocar de aba (a pessoa nem soltou o dedo pra isso)
  const segurou = useRef(false);

  // A aba ativa foi ocultada (ou nunca existiu): cai na primeira visível.
  useEffect(() => {
    if (visiveis.length === 0) return;
    if (!visiveis.some(a => a.id === ativa)) onTrocar(visiveis[0].id);
  }, [visiveis, ativa, onTrocar]);

  // Fecha o menu num toque fora dele.
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [menu]);

  const comecarSegurar = (id: string) => {
    segurou.current = false;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      segurou.current = true;
      setMenu({ alvo: id });
    }, SEGURAR_MS);
  };
  const soltar = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
  };
  useEffect(() => () => soltar(), []);

  const clicarAba = (id: string) => {
    if (segurou.current) { segurou.current = false; return; }
    setMenu(null);
    onTrocar(id);
  };

  const alvo = menu ? visiveis.find(a => a.id === menu.alvo) : null;

  return (
    <div ref={raiz} className={`relative flex gap-1 overflow-x-auto ${className}`}>
      {visiveis.map(tab => (
        <button
          key={tab.id}
          type="button"
          data-active={ativa === tab.id}
          data-spotlight={`tab-${tab.id}`}
          onClick={() => clicarAba(tab.id)}
          onContextMenu={e => { e.preventDefault(); setMenu({ alvo: tab.id }); }}
          onMouseDown={() => comecarSegurar(tab.id)}
          onMouseUp={soltar}
          onMouseLeave={soltar}
          onTouchStart={() => comecarSegurar(tab.id)}
          onTouchEnd={soltar}
          onTouchMove={soltar}
          className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 select-none ${ativa === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}

      {/* ⋯ — a porta descobrível. Sempre presente; com abas ocultas mostra o número. */}
      <button
        type="button"
        aria-label="Opções das abas"
        aria-expanded={!!menu}
        onClick={() => setMenu(m => (m ? null : { alvo: ativa }))}
        className="notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 text-muted-foreground hover:bg-muted shrink-0"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        {ocultas.length > 0 && <span className="text-[10px]">+{ocultas.length}</span>}
      </button>

      {menu && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-lg p-1 text-xs"
        >
          {alvo && (
            <button
              type="button"
              role="menuitem"
              disabled={!podeOcultar}
              onClick={() => { if (ocultar(alvo.id)) setMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Ocultar aba "{alvo.icon ? `${alvo.icon} ` : ""}{alvo.label}"</span>
            </button>
          )}
          {!podeOcultar && (
            <p className="px-2.5 py-1 text-[10px] text-muted-foreground">A última aba não pode ser ocultada.</p>
          )}
          {ocultas.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Abas ocultas</p>
              {ocultas.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  onClick={() => mostrar(tab.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mostrar {tab.icon ? `${tab.icon} ` : ""}{tab.label}</span>
                </button>
              ))}
              {ocultas.length > 1 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { mostrarTodas(); setMenu(null); }}
                  className="w-full px-2.5 py-2 rounded-md hover:bg-muted text-left font-medium"
                >
                  Mostrar todas as abas
                </button>
              )}
            </>
          )}
          {ocultas.length === 0 && (
            <p className="px-2.5 py-1 text-[10px] text-muted-foreground">Segure uma aba pra ocultá-la.</p>
          )}
        </div>
      )}
    </div>
  );
}
