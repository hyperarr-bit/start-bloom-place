import { Check, ChevronRight, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PendenciasDeHoje, PendingItem } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { trackEvent } from "@/lib/analytics";
import { ICONE_COMPROMISSO, ICONE_CONTA, ICONE_DO_TIPO, TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, type Tom } from "./paleta";

/**
 * PÁGINA 2 DO CARROSSEL — "PENDÊNCIAS DE HOJE" (opção E). Um card só, da altura da página 1: a lista do que
 * falta, compacta, cada linha com a ação (toque abre o formulário do "+" ou vai pro módulo — o MESMO que a
 * Home faz hoje). Cabe até 5 linhas de 44 px (pendências + o aviso de conta a vencer, sem valor em R$); o
 * resto e as feitas ficam atrás de "mais N · M feitas", que abre a folha da pontuação.
 * RODADA 3: os emojis (✅ 🍽️ 💧 💸 🌙 📅) viraram ícones da mesma família dos módulos (paleta.ts), num disco
 * da cor do tipo a 12 % — a mesma cor do anel do card pequeno e da barra na folha.
 */
const MAX_LINHAS = 5;

interface Props {
  pendencias: PendenciasDeHoje;
  onAcao: (id: ActionId) => void;
  onPersonalizar: () => void;
  onVerTodas: () => void;
}

const Disco = ({ Icone, tom, feita }: { Icone: LucideIcon; tom: Tom; feita?: boolean }) => (
  <span className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0" style={{ background: feita ? "hsl(var(--muted))" : cor(tom, "var(--he-tinta)") }} aria-hidden>
    {feita ? <Check className="w-4 h-4 text-muted-foreground" strokeWidth={2.5} /> : <Icone className="w-[17px] h-[17px]" strokeWidth={TRACO} style={{ color: cor(tom) }} />}
  </span>
);

/** Compromisso com hora (sem tipo) usa o ícone de calendário com relógio, na cor da Rotina. */
const Linha = ({ item, feita, onClick }: { item: PendingItem; feita?: boolean; onClick?: () => void }) => {
  const Icone = item.tipo ? ICONE_DO_TIPO[item.tipo] : ICONE_COMPROMISSO;
  const tom = item.tipo ? TOM_DO_TIPO[item.tipo] : TOM_DO_MODULO.rotina;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={feita ? "hn-pendencia-feita" : "hn-pendencia"}
      className={`w-full h-[44px] flex items-center gap-2.5 pl-1.5 pr-1.5 rounded-xl text-left active:bg-muted/60 ${feita ? "opacity-55" : ""}`}
    >
      <Disco Icone={Icone} tom={tom} feita={feita} />
      <span className={`flex-1 min-w-0 text-[14.5px] font-medium truncate ${feita ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>{item.label}</span>
      {!feita && (item.route || item.action) && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} aria-hidden />}
    </button>
  );
};

export const PaginaPendencias = ({ pendencias, onAcao, onPersonalizar, onVerTodas }: Props) => {
  const navigate = useNavigate();
  const { pending, done, avisoConta, avisoTreino } = pendencias;
  const avisos: { Icone: LucideIcon; tom: Tom; texto: string; route: string }[] = [];
  if (avisoConta) avisos.push({ Icone: ICONE_CONTA, tom: TOM_DO_MODULO.financas, texto: `${avisoConta.dias === 0 ? "Vence hoje" : avisoConta.dias === 1 ? "Vence amanhã" : `Vence em ${avisoConta.dias} dias`}: ${avisoConta.nome}`, route: "/financas" });
  if (avisoTreino) avisos.push({ Icone: ICONE_DO_TIPO.treino, tom: TOM_DO_MODULO.treino, texto: "Configurar treino da semana", route: "/treino" });
  const vagas = Math.max(0, MAX_LINHAS - avisos.length);
  const visiveis = pending.slice(0, vagas);
  const escondidas = pending.length - visiveis.length;

  const tocar = (item: PendingItem) => {
    trackEvent("home_pendencia", { tipo: item.tipo ?? "compromisso", destino: item.action ?? item.route ?? null });
    if (item.action) onAcao(item.action);
    else if (item.route) navigate(item.route);
  };

  const partes: string[] = [];
  if (escondidas > 0) partes.push(`mais ${escondidas}`);
  if (done.length > 0) partes.push(`${done.length} ${done.length === 1 ? "feita" : "feitas"}`);

  return (
    <div className="he-pagina" data-testid="he-pagina-2">
      <section className="hn-card flex-1 p-2 flex flex-col" data-testid="hn-pendencias" aria-label="Pendências de hoje">
        <header className="flex items-center justify-between pl-2.5 pr-0.5 pt-0.5 pb-0.5">
          <h3 className="text-[15px] font-bold tracking-tight">
            Pendências de hoje
            {pending.length > 0 && <span className="ml-2 text-[12.5px] font-semibold text-muted-foreground tabular-nums">{pending.length}</span>}
          </h3>
          <button type="button" onClick={onPersonalizar} data-testid="hn-personalizar" aria-label="Personalizar pendências" className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground active:bg-muted/60">
            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={TRACO} aria-hidden />
          </button>
        </header>

        {pending.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2">
            <span className="w-12 h-12 rounded-2xl grid place-items-center" style={{ background: cor(TOM_DO_MODULO.rotina, "var(--he-tinta)") }} aria-hidden><Check className="w-6 h-6" strokeWidth={2.5} style={{ color: cor(TOM_DO_MODULO.rotina) }} /></span>
            <p className="text-[15px] font-semibold">Tudo feito por hoje</p>
            {done.length > 0 && <p className="text-[12.5px] text-muted-foreground">{done.length} {done.length === 1 ? "coisa feita" : "coisas feitas"}</p>}
          </div>
        ) : (
          <div className="flex-1">
            {visiveis.map((item, i) => <Linha key={`p-${item.tipo ?? i}`} item={item} onClick={() => tocar(item)} />)}
            {avisos.map((a) => (
              <button key={a.texto} type="button" onClick={() => navigate(a.route)} className="w-full h-[44px] flex items-center gap-2.5 pl-1.5 pr-1.5 rounded-xl text-left active:bg-muted/60">
                <Disco Icone={a.Icone} tom={a.tom} />
                <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{a.texto}</span>
                <span className="text-[10.5px] font-bold uppercase tracking-wider shrink-0 pr-1" style={{ color: cor(a.tom) }}>aviso</span>
              </button>
            ))}
          </div>
        )}

        {partes.length > 0 && (
          <button type="button" onClick={onVerTodas} data-testid="hn-pendencias-mais" className="h-[32px] mt-auto px-2 flex items-center justify-center gap-1 text-[12.5px] font-semibold text-muted-foreground">
            {partes.join(" · ")}
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
          </button>
        )}
      </section>
    </div>
  );
};
