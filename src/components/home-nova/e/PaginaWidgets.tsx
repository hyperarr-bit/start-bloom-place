import { Check, LayoutGrid, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ActionId } from "@/components/home/QuickActions";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { dadoDoWidgetE, type DadoDoWidgetE, type IdDoWidgetE } from "@/lib/home-widgets-e";
import { Anel } from "./Anel";
import { Entrada } from "./Animacoes";
import { TRACO, cor, tinta } from "./paleta";

/**
 * PÁGINA 3 DO CARROSSEL — "SEUS WIDGETS" (opção E). RODADA 3 (26/10, dono): um formato ÚNICO de card, igual aos 3
 * resumos da página 1 — rótulo curto com o ícone, número grande, uma linha de detalhe e o anel (ou o ícone no disco,
 * quando não há fração) — com dado REAL (lib/home-widgets-e). Sem dado, o card vira um estado vazio ÚTIL: o que falta
 * e a ação que cadastra. Catálogo enxuto; a lista é a da conta (`core-home-widgets-e`).
 */
interface Props {
  data: LifeHubData;
  widgets: IdDoWidgetE[];
  onEscolher: () => void;
  /** abre a folha do "+" numa ação (Sono, Água, Treino) */
  onAcao?: (id: ActionId) => void;
}

export const CardWidgetE = ({ w, atraso, onAcao, compacto }: { w: DadoDoWidgetE; atraso: number; onAcao?: (id: ActionId) => void; compacto?: boolean }) => {
  const navigate = useNavigate();
  const c = cor(w.tom);
  const tocar = () => {
    if (w.action && onAcao && !w.vazio) return onAcao(w.action);
    navigate(w.rota);
  };
  return (
    <button
      type="button" onClick={tocar} data-testid={`he-widget-${w.id}`} data-vazio={w.vazio ? "1" : undefined}
      className={`hn-card !rounded-[22px] ${compacto ? "p-3 min-h-[120px]" : "p-4 min-h-[150px]"} w-full flex flex-col text-left active:scale-[0.98] transition-transform`}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground truncate max-w-full">
        <w.Icone className="w-[15px] h-[15px] shrink-0" strokeWidth={TRACO} style={{ color: c }} aria-hidden />
        {w.rotulo}
      </span>
      {w.vazio ? (
        <>
          <span className="mt-2 text-[14px] leading-snug font-semibold" data-testid="he-widget-vazio">{w.vazio.texto}</span>
          <span className="mt-auto self-start inline-flex items-center h-8 px-3 rounded-full text-[12.5px] font-semibold" style={{ background: tinta(w.tom), color: c }}>{w.vazio.cta}</span>
        </>
      ) : (
        <div className="mt-1.5 flex items-end justify-between gap-2 flex-1 min-w-0">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="text-[26px] leading-none font-bold tabular-nums tracking-[-0.02em] truncate" data-testid="he-widget-numero">{w.numero}</span>
              {w.unidade && <span className="text-[13px] font-medium text-muted-foreground tabular-nums shrink-0">{w.unidade}</span>}
            </span>
            {w.detalhe && <span className="block mt-1 text-[12px] text-muted-foreground leading-tight line-clamp-2">{w.detalhe}</span>}
          </span>
          {w.fracao ? (
            <Anel tamanho={compacto ? 48 : 56} espessura={compacto ? 6 : 7} valor={w.fracao.valor} max={w.fracao.max} cor={c} atraso={atraso}>
              {w.completo ? <Check className="w-5 h-5" strokeWidth={2.5} style={{ color: c }} aria-hidden /> : <w.Icone className="w-5 h-5" strokeWidth={TRACO} style={{ color: c }} aria-hidden />}
            </Anel>
          ) : (
            <span className={`${compacto ? "w-10 h-10" : "w-12 h-12"} rounded-full grid place-items-center shrink-0`} style={{ background: tinta(w.tom) }} aria-hidden>
              <w.Icone className="w-5 h-5" strokeWidth={TRACO} style={{ color: c }} />
            </span>
          )}
        </div>
      )}
    </button>
  );
};

export const PaginaWidgets = ({ data, widgets, onEscolher, onAcao }: Props) => {
  const { get } = useUserData();
  const dados = widgets.map((id) => dadoDoWidgetE(id, data, get));
  return (
    <div className="he-pagina" data-testid="he-pagina-3">
      {widgets.length === 0 ? (
        <section className="hn-card flex-1 p-6 flex flex-col items-center justify-center text-center" data-testid="he-widgets-vazio">
          <span className="w-14 h-14 rounded-2xl bg-muted grid place-items-center" aria-hidden><LayoutGrid className="w-7 h-7 text-foreground" strokeWidth={TRACO} /></span>
          <p className="mt-4 text-[17px] font-bold tracking-tight">Seus widgets</p>
          <p className="mt-1 text-[13px] text-muted-foreground leading-snug max-w-[240px]">Próxima conta, orçamento, treino, sono, leitura… os resumos que você escolher ficam nesta página.</p>
          <button type="button" onClick={onEscolher} className="mt-4 h-10 px-5 rounded-full text-[14px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Escolher</button>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1 content-start" data-testid="hn-widgets">
          {dados.map((w, i) => (
            <Entrada key={w.id} atraso={0.05 + i * 0.06} className="flex">
              <CardWidgetE w={w} atraso={0.3 + i * 0.08} onAcao={onAcao} />
            </Entrada>
          ))}
          {widgets.length < 4 && (
            <button type="button" onClick={onEscolher} data-testid="he-widgets-escolher" className="rounded-[22px] min-h-[150px] flex flex-col items-center justify-center gap-2 text-muted-foreground bg-foreground/[0.035] dark:bg-white/[0.04] active:bg-foreground/[0.06]">
              <span className="w-10 h-10 rounded-full bg-card grid place-items-center" style={{ boxShadow: "var(--hn-sombra)" }}><Plus className="w-5 h-5" strokeWidth={2.2} aria-hidden /></span>
              <span className="text-[12.5px] font-semibold">Escolher widgets</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
