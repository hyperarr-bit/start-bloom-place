import { useLayoutEffect, useRef } from "react";
import { LOGO_PORTA } from "@/pages/porta/telas";
import { BOTAO_CRIAR, MODULOS_DEMO, TOPO_SELO, type ModuloDemo } from "./conteudo";

/**
 * O topo grudado da demo: a barra (CORE · Modo demonstração · Entrar · Criar conta) + as pílulas.
 * (16/10: o /liberar usa o mesmo topo com o botão "Liberar meu CORE".)
 * Mesma mecânica da barra do tour do /preview (.demo-tour-nav): gruda no topo e publica a própria altura em
 * --demo-nav-h, pra o cabeçalho grudado do módulo ficar LOGO ABAIXO em vez de disputar o mesmo topo.
 */
export function NavDemo({ modulo, onTrocar, onCriar, onEntrar, botao = BOTAO_CRIAR, compacto = false }: {
  modulo: ModuloDemo;
  onTrocar: (m: ModuloDemo) => void;
  onCriar: () => void;
  onEntrar: () => void;
  /** o texto do botão principal (padrão "Criar conta"; o /liberar passa o dele) */
  botao?: string;
  /** botão de texto longo (o /liberar): o selo pode quebrar em 2 linhas e os botões ficam mais justos,
   *  pra "Modo demonstração" caber inteiro no iPhone (sem as reticências) */
  compacto?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) el.closest(".demo-com-tour")?.setAttribute("style", `--demo-nav-h:${h}px`);
    };
    publicar();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="demo-tour-nav bg-background border-b border-border" data-testid="demo-nav">
      <div className="max-w-5xl mx-auto px-3 h-[54px] flex items-center gap-2" data-testid="demo-topo">
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <img src={LOGO_PORTA} alt="" width={28} height={28} className="w-7 h-7 shrink-0 rounded-[8px] border border-border bg-white" />
          <span className="min-w-0 leading-none">
            <span className="block text-[17px] font-black tracking-[-0.03em] text-foreground">CORE</span>
            <span
              className={`block mt-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${compacto ? "leading-[1.15] line-clamp-2" : "truncate"}`}
              data-testid="demo-selo"
            >
              {TOPO_SELO}
            </span>
          </span>
        </span>
        <button type="button" onClick={onEntrar} className={`shrink-0 h-10 font-semibold text-foreground ${compacto ? "px-1.5 text-[13.5px]" : "px-2.5 text-[14px]"}`} data-testid="demo-entrar">Entrar</button>
        <button
          type="button" onClick={onCriar} data-testid="demo-topo-criar"
          className={`shrink-0 h-10 rounded-full bg-foreground text-background font-semibold active:scale-[.97] transition-transform ${compacto ? "px-3.5 text-[13.5px] whitespace-nowrap" : "px-4 text-[14px]"}`}
        >
          {botao}
        </button>
      </div>
      <div className="max-w-5xl mx-auto px-3 pb-2.5 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Módulos" data-testid="demo-pilulas">
        {MODULOS_DEMO.map((m) => {
          const ativo = m.key === modulo;
          return (
            <button
              key={m.key} type="button" role="tab" aria-selected={ativo} onClick={() => onTrocar(m.key)}
              data-testid={`demo-pilula-${m.key}`} data-ativo={ativo ? "" : undefined}
              className={`flex-auto shrink-0 min-h-10 rounded-full px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                ativo ? "bg-foreground text-background" : "bg-card text-foreground border border-border active:bg-secondary"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
