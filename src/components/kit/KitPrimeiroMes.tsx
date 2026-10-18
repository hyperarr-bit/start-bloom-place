import { Check, ChevronRight, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { useKitPrimeiroMes } from "@/hooks/use-kit-primeiro-mes";
import { CHAVE_DESAFIOS } from "@/hooks/use-fechamento-desafio";
import { trackEvent } from "@/lib/analytics";
import { challengeByKey, lerDesafios, mondayOf } from "@/components/challenges/challenges";
import type { Parcela } from "@/lib/finance-parcelas";
import {
  DIAS_DO_KIT, PLANO_30_DIAS, SEMANAS_DO_KIT, agendaDosDesafios, diaDoPlano, marcarFeito, tarefaDeHoje,
  type DestinoDoKit, type TarefaDoKit,
} from "@/lib/kit-primeiro-mes";
import { PlanilhaDividas } from "./PlanilhaDividas";

const ddmm = (dia: string, mais = 0) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + mais);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Aba "KIT 30 DIAS" de Finanças — só existe pra quem comprou o Kit Primeiro
 * Mês Organizado (o Index nem monta a aba sem a chave). Plano de 30 dias em
 * cara de planner (o dia de hoje destacado), os desafios das 4 semanas e a
 * planilha de dívidas.
 */
export const KitPrimeiroMes = ({ irPara, parcelamentos }: { irPara: (d: DestinoDoKit) => void; parcelamentos?: Parcela[] }) => {
  const { kit, progresso, salvarProgresso } = useKitPrimeiroMes();
  const { get } = useUserData();
  if (!kit || !progresso) return null;

  const hoje = new Date();
  const diaHoje = diaDoPlano(progresso.inicio, hoje);
  const concluiuPrazo = diaHoje > DIAS_DO_KIT;
  const feitos = Object.keys(progresso.feitos).length;
  const tarefa = tarefaDeHoje(progresso.inicio, hoje);
  const feitoHoje = !!progresso.feitos[String(tarefa.dia)];

  const alternar = (t: TarefaDoKit) => {
    if (t.dia > diaHoje) return;
    const marcar = !progresso.feitos[String(t.dia)];
    salvarProgresso(marcarFeito(progresso, t.dia, marcar, hoje));
    if (marcar) trackEvent("kit_tarefa_feita", { dia: t.dia, dia_do_plano: diaHoje });
  };
  const ir = (t: TarefaDoKit) => {
    trackEvent("kit_tarefa_abrir", { dia: t.dia, aba: t.destino.aba });
    irPara(t.destino);
  };

  // desafios das 4 semanas: resultado vem do histórico do "Desafio da semana"
  const desafios = lerDesafios(get<unknown>(CHAVE_DESAFIOS, undefined));
  const segAgora = mondayOf(hoje);
  const agenda = agendaDosDesafios(progresso.inicio);

  return (
    <div className="space-y-4" data-testid="kit-primeiro-mes">
      {/* Cabeçalho do kit */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold">📒 KIT PRIMEIRO MÊS ORGANIZADO</h3>
          <span className="text-[10.5px] font-semibold text-muted-foreground whitespace-nowrap">
            {concluiuPrazo ? "30 dias completos" : `Dia ${diaHoje} de ${DIAS_DO_KIT}`}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(feitos / DIAS_DO_KIT) * 100}%` }} transition={{ duration: 0.5 }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {feitos} de {DIAS_DO_KIT} tarefas feitas · 2 a 5 minutos por dia. Atrasou? Faça no seu ritmo — dá pra marcar dias passados.
        </p>
      </div>

      {/* Hoje */}
      <div className={`rounded-lg border-2 p-4 ${feitoHoje ? "border-emerald-500/50 bg-emerald-500/5" : "border-accent/60 bg-accent/5"}`} data-testid="kit-hoje">
        <p className="text-[10.5px] font-bold tracking-wide text-accent">{concluiuPrazo ? "ÚLTIMA TAREFA" : `HOJE · DIA ${tarefa.dia}`}</p>
        <p className="text-[15px] font-bold leading-tight mt-1">{tarefa.titulo}</p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{tarefa.como}</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => ir(tarefa)} className="flex-1 h-10 rounded-lg bg-foreground text-background text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
            {tarefa.destino.rotulo} <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => alternar(tarefa)}
            aria-pressed={feitoHoje}
            className={`h-10 px-3.5 rounded-lg text-[12.5px] font-bold inline-flex items-center gap-1.5 border ${feitoHoje ? "bg-emerald-500 text-white border-emerald-500" : "border-border bg-card"}`}
          >
            <Check className="w-4 h-4" /> {feitoHoje ? "Feito" : "Marcar feito"}
          </button>
        </div>
      </div>

      {/* Checklist das 4 semanas */}
      {SEMANAS_DO_KIT.map((s) => (
        <div key={s.semana} className="bg-card rounded-lg border border-border p-4">
          <h4 className="text-xs font-bold mb-2.5">
            SEMANA {s.semana} <span className="text-muted-foreground font-semibold">· {s.titulo}</span>
          </h4>
          <ul className="space-y-1">
            {PLANO_30_DIAS.filter((t) => t.dia >= s.dias[0] && t.dia <= s.dias[1]).map((t) => {
              const feito = !!progresso.feitos[String(t.dia)];
              const ehHoje = t.dia === Math.min(diaHoje, DIAS_DO_KIT) && !concluiuPrazo;
              const futuro = t.dia > diaHoje;
              return (
                <li
                  key={t.dia}
                  data-testid={`kit-dia-${t.dia}`}
                  data-hoje={ehHoje || undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${ehHoje ? "bg-accent/10 ring-1 ring-accent/50" : ""} ${futuro ? "opacity-55" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => alternar(t)}
                    disabled={futuro}
                    aria-label={futuro ? `Dia ${t.dia} libera em ${ddmm(progresso.inicio, t.dia - 1)}` : `${feito ? "Desmarcar" : "Marcar"} dia ${t.dia}`}
                    aria-pressed={feito}
                    className={`grid place-items-center w-7 h-7 rounded-full border-2 text-[10.5px] font-bold shrink-0 transition-colors ${
                      feito ? "bg-emerald-500 border-emerald-500 text-white" : ehHoje ? "border-accent text-accent" : "border-border text-muted-foreground"
                    }`}
                  >
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

      {/* Desafios das 4 semanas */}
      <div className="bg-card rounded-lg border border-border p-4" data-testid="kit-desafios">
        <h4 className="text-xs font-bold mb-1">🎯 DESAFIOS DAS 4 SEMANAS</h4>
        <p className="text-[11px] text-muted-foreground mb-2.5">Já escolhidos: cada segunda, o desafio da semana aparece pronto no Painel. Se preferir outro, é só trocar lá.</p>
        <ul className="space-y-2">
          {agenda.map((a) => {
            const def = challengeByKey(a.key);
            const res = desafios.history.find((h) => h.weekStart === a.weekStart && h.key === a.key)?.result;
            const agora = a.weekStart === segAgora;
            const passou = a.weekStart < segAgora;
            const status = res === "win" ? "Cumprido 🏆"
              : res === "loss" ? "Não fechou — tudo bem"
              : agora ? (desafios.active?.weekStart === segAgora && desafios.active.key === a.key ? "Valendo agora" : "Esta semana")
              : passou ? "Semana passou"
              : `Começa ${ddmm(a.weekStart)}`;
            return (
              <li key={a.semana} className={`flex items-center gap-3 rounded-xl border p-2.5 ${agora ? "border-accent/60 bg-accent/5" : "border-border bg-background"}`}>
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-secondary text-lg shrink-0">{def?.emoji ?? "🎯"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-bold leading-tight">Semana {a.semana} · {def?.title}</span>
                  <span className="block text-[10.5px] text-muted-foreground mt-0.5">{ddmm(a.weekStart)} a {ddmm(a.weekStart, 6)} · {a.porque}</span>
                </span>
                <span className={`text-[10.5px] font-bold shrink-0 text-right max-w-[84px] ${res === "win" ? "text-emerald-500" : agora ? "text-accent" : "text-muted-foreground"}`}>{status}</span>
              </li>
            );
          })}
        </ul>
        {agenda.some((a) => a.weekStart === segAgora) && (
          <button type="button" onClick={() => irPara({ aba: "dashboard", rotulo: "Painel" })} className="mt-2.5 text-[11.5px] font-semibold text-accent inline-flex items-center gap-1">
            Ver o desafio no Painel <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <PlanilhaDividas parcelamentos={parcelamentos} />

      <p className="text-[10.5px] text-muted-foreground text-center px-4 pb-2 leading-snug">
        O kit organiza o caminho; o ritmo é seu. Os números são os que você anotou no CORE.
      </p>
    </div>
  );
};

/**
 * Uma linha no Painel de Finanças (não na Home): a tarefa de hoje do kit, que
 * leva pra aba do kit (feita = riscada). Some depois dos 30 dias.
 */
export const KitHojeNoPainel = ({ abrirKit }: { abrirKit: () => void }) => {
  const { kit, progresso } = useKitPrimeiroMes();
  if (!kit || !progresso) return null;
  const dia = diaDoPlano(progresso.inicio);
  if (dia > DIAS_DO_KIT) return null;
  const t = tarefaDeHoje(progresso.inicio);
  const feito = !!progresso.feitos[String(t.dia)];
  return (
    <button
      type="button"
      onClick={abrirKit}
      data-testid="kit-hoje-painel"
      className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform"
    >
      <span className={`grid place-items-center w-7 h-7 rounded-full border-2 text-[10.5px] font-bold shrink-0 ${feito ? "bg-emerald-500 border-emerald-500 text-white" : "border-accent text-accent"}`}>
        {feito ? <Check className="w-3.5 h-3.5" /> : t.dia}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10.5px] font-bold text-muted-foreground">KIT 30 DIAS · DIA {t.dia}</span>
        <span className={`block text-[12.5px] font-semibold truncate ${feito ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
};
