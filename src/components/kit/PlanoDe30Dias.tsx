import { Check, ChevronRight, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useKitPrimeiroMes } from "@/hooks/use-kit-primeiro-mes";
import { trackEvent } from "@/lib/analytics";
import { DIAS_DO_KIT, diaDoPlano, marcarFeito } from "@/lib/kit-primeiro-mes";
import { areaDoKit, planoDaArea, tarefaDoDia, type DestinoDoPlano, type TarefaDoPlano } from "@/lib/plano-30-areas";

const ddmm = (dia: string, mais = 0) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + mais);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * O PLANO DE 30 DIAS DA ÁREA (21/10) — o mesmo desenho da aba "KIT 30 DIAS" de Finanças (cabeçalho com o dia, a
 * tarefa de hoje e o checklist das 4 semanas), pro plano da área comprada (src/lib/plano-30-areas). O progresso é o
 * do kit (`core-kit-primeiro-mes-feitos`, gravação de sistema). Cada tarefa leva pro módulo de verdade (`irPara`).
 */
export const PlanoDe30Dias = ({ irPara }: { irPara: (d: DestinoDoPlano) => void }) => {
  const { kit, progresso, salvarProgresso } = useKitPrimeiroMes();
  if (!kit || !progresso) return null;
  const plano = planoDaArea(areaDoKit(kit));

  const hoje = new Date();
  const diaHoje = diaDoPlano(progresso.inicio, hoje);
  const concluiuPrazo = diaHoje > DIAS_DO_KIT;
  const feitos = Object.keys(progresso.feitos).length;
  const tarefa = tarefaDoDia(plano, diaHoje);
  const feitoHoje = !!progresso.feitos[String(tarefa.dia)];

  const alternar = (t: TarefaDoPlano) => {
    if (t.dia > diaHoje) return;
    const marcar = !progresso.feitos[String(t.dia)];
    salvarProgresso(marcarFeito(progresso, t.dia, marcar, hoje));
    if (marcar) trackEvent("kit_tarefa_feita", { dia: t.dia, dia_do_plano: diaHoje, area: plano.area });
  };
  const ir = (t: TarefaDoPlano) => {
    trackEvent("kit_tarefa_abrir", { dia: t.dia, area: plano.area, modulo: t.destino.modulo, aba: t.destino.aba ?? null });
    irPara(t.destino);
  };

  return (
    <div className="space-y-4" data-testid="plano-30-dias" data-area={plano.area}>
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold">📒 {plano.titulo.toUpperCase()}</h3>
          <span className="text-[10.5px] font-semibold text-muted-foreground whitespace-nowrap">
            {concluiuPrazo ? "30 dias completos" : `Dia ${diaHoje} de ${DIAS_DO_KIT}`}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(feitos / DIAS_DO_KIT) * 100}%` }} transition={{ duration: 0.5 }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {feitos} de {DIAS_DO_KIT} tarefas feitas · 2 a 3 minutos por dia. Atrasou? Faça no seu ritmo — dá pra marcar dias passados.
        </p>
      </div>

      <div className={`rounded-lg border-2 p-4 ${feitoHoje ? "border-emerald-500/50 bg-emerald-500/5" : "border-accent/60 bg-accent/5"}`} data-testid="plano-hoje">
        <p className="text-[10.5px] font-bold tracking-wide text-accent">{concluiuPrazo ? "ÚLTIMA TAREFA" : `HOJE · DIA ${tarefa.dia}`}</p>
        <p className="text-[15px] font-bold leading-tight mt-1">{tarefa.titulo}</p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{tarefa.como}</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => ir(tarefa)} data-testid="plano-hoje-abrir" className="flex-1 h-10 rounded-lg bg-foreground text-background text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
            <span>{tarefa.destino.rotulo}</span> <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => alternar(tarefa)} aria-pressed={feitoHoje} data-testid="plano-hoje-feito"
            className={`h-10 px-3.5 rounded-lg text-[12.5px] font-bold inline-flex items-center gap-1.5 border ${feitoHoje ? "bg-emerald-500 text-white border-emerald-500" : "border-border bg-card"}`}>
            <Check className="w-4 h-4" /> <span>{feitoHoje ? "Feito" : "Marcar feito"}</span>
          </button>
        </div>
      </div>

      {plano.semanas.map((s) => (
        <div key={s.semana} className="bg-card rounded-lg border border-border p-4">
          <h4 className="text-xs font-bold mb-2.5">SEMANA {s.semana} <span className="text-muted-foreground font-semibold">· {s.titulo}</span></h4>
          <ul className="space-y-1">
            {plano.tarefas.filter((t) => t.dia >= s.dias[0] && t.dia <= s.dias[1]).map((t) => {
              const feito = !!progresso.feitos[String(t.dia)];
              const ehHoje = t.dia === Math.min(diaHoje, DIAS_DO_KIT) && !concluiuPrazo;
              const futuro = t.dia > diaHoje;
              return (
                <li key={t.dia} data-testid={`plano-dia-${t.dia}`} data-hoje={ehHoje || undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${ehHoje ? "bg-accent/10 ring-1 ring-accent/50" : ""} ${futuro ? "opacity-55" : ""}`}>
                  <button type="button" onClick={() => alternar(t)} disabled={futuro}
                    aria-label={futuro ? `Dia ${t.dia} libera em ${ddmm(progresso.inicio, t.dia - 1)}` : `${feito ? "Desmarcar" : "Marcar"} dia ${t.dia}`} aria-pressed={feito}
                    className={`grid place-items-center w-7 h-7 rounded-full border-2 text-[10.5px] font-bold shrink-0 transition-colors ${feito ? "bg-emerald-500 border-emerald-500 text-white" : ehHoje ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                    {feito ? <Check className="w-3.5 h-3.5" /> : t.dia}
                  </button>
                  <button type="button" onClick={() => !futuro && ir(t)} disabled={futuro} className="flex-1 min-w-0 text-left">
                    <span className={`block text-[12.5px] leading-tight ${feito ? "line-through text-muted-foreground" : "font-semibold"}`}>{t.titulo}</span>
                    {ehHoje && <span className="block text-[10.5px] text-accent font-bold mt-0.5">hoje</span>}
                    {futuro && <span className="block text-[10.5px] text-muted-foreground mt-0.5">{ddmm(progresso.inicio, t.dia - 1)}</span>}
                  </button>
                  {!futuro && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="bg-card rounded-lg border border-border p-4">
        <h4 className="text-xs font-bold mb-2">NO DIA 30</h4>
        <ul className="space-y-1.5">
          {plano.fim.map((f) => <li key={f} className="flex items-center gap-2 text-[12.5px] font-semibold"><Check className="w-4 h-4 text-emerald-500 shrink-0" />{f}</li>)}
        </ul>
      </div>
      <p className="text-[10.5px] text-muted-foreground text-center px-4 pb-2 leading-snug">O plano organiza o caminho; o ritmo é seu.</p>
    </div>
  );
};
