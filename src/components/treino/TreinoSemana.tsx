/**
 * SEMANA (26/09, mockup p2): a semana como TABELA de planner — DIA | TREINO |
 * FEITO, a barrinha na cor do dia, descanso esmaecido, hoje destacado. O FEITO
 * vem do registro de treinos (a data daquele dia nesta semana), não do ✓ do
 * plano. Tocar num dia abre o editor dele.
 */
import type { ReactNode } from "react";
import { cn, localDayKey } from "@/lib/utils";
import { lerNumero } from "@/lib/treino-numeros";
import { formatarKgInteiro, type ExercicioDoPlano } from "@/lib/treino-series";
import { segundaDe, somarDias } from "@/lib/treino-constancia";
import { COR_DO_DIA, DIAS_DA_SEMANA, Quadradinho, tomDoDia } from "./planner";

export interface LinhaDaSemana {
  dia: string;
  data: string;
  titulo: string;
  sub: string;
  descanso: boolean;
  /** dia de descanso em que a pessoa treinou mesmo assim */
  extra: boolean;
  semTreino: boolean;
  treinou: boolean;
  hoje: boolean;
  emAndamento: boolean;
}

export const linhasDaSemana = ({
  plano,
  diasAtivos,
  hoje,
  hojeNome,
  log,
  volumePorDia,
  progressoHoje,
}: {
  plano: Record<string, { muscles: string[]; exercises: ExercicioDoPlano[] } | undefined>;
  diasAtivos: string[];
  hoje: Date;
  hojeNome: string;
  log: string[];
  volumePorDia: Record<string, number>;
  progressoHoje: { feitas: number; total: number; rotulo: string };
}): LinhaDaSemana[] => {
  const seg = segundaDe(hoje);
  const noLog = new Set(log);
  return DIAS_DA_SEMANA.map((dia, i) => {
    const data = localDayKey(somarDias(seg, i));
    const pd = plano[dia];
    const exs = pd?.exercises ?? [];
    const ms = pd?.muscles ?? [];
    const ativo = diasAtivos.includes(dia);
    const treinou = noLog.has(data);
    // descanso que virou treino ("treinar mesmo assim") não é mais descanso na tabela
    const extra = !ativo && exs.length === 0 && treinou;
    const descanso = !ativo && exs.length === 0 && !treinou;
    const eHoje = dia === hojeNome;
    const emAndamento = eHoje && !treinou && progressoHoje.feitas > 0;
    const cardios = exs.filter((e) => e.tipo === "cardio");
    const soCardio = exs.length > 0 && cardios.length === exs.length;
    const titulo = descanso
      ? "Descanso"
      : extra ? "Treino extra" : ms.length ? ms.join(" + ") : soCardio ? "Cardio" : exs.length ? `Treino de ${dia.toLowerCase()}` : "Montar treino";
    const nEx = `${exs.length} exercício${exs.length === 1 ? "" : "s"}`;
    let sub = "";
    if (descanso) sub = "";
    else if (extra) sub = (volumePorDia[data] ?? 0) > 0 ? `${formatarKgInteiro(volumePorDia[data])} kg` : "fora do plano";
    else if (!exs.length) sub = "toque pra montar";
    else if (emAndamento) sub = `hoje · ${progressoHoje.feitas} de ${progressoHoje.total} ${progressoHoje.rotulo}`;
    else if (treinou && (volumePorDia[data] ?? 0) > 0) sub = `${nEx} · ${formatarKgInteiro(volumePorDia[data])} kg`;
    else if (soCardio) {
      const min = cardios.reduce((t, c) => t + lerNumero(c.duracao), 0);
      sub = [min > 0 ? `${min} min` : "", cardios.map((c) => c.name.toLowerCase()).join(", ")].filter(Boolean).join(" · ");
    } else {
      const series = exs.reduce((t, e) => t + (e.tipo === "cardio" ? 0 : Math.round(lerNumero(e.sets))), 0);
      sub = eHoje ? `hoje · ${nEx}` : series > 0 ? `${nEx} · ${series} séries` : nEx;
    }
    return { dia, data, titulo, sub, descanso, extra, semTreino: !descanso && !extra && !exs.length, treinou, hoje: eHoje, emAndamento };
  });
};

export function TreinoSemana({ linhas, onAbrirDia, children }: { linhas: LinhaDaSemana[]; onAbrirDia: (dia: string) => void; children?: ReactNode }) {
  const planejados = linhas.filter((l) => !l.descanso && !l.extra).length;
  const feitos = linhas.filter((l) => l.treinou).length;
  return (
    <div className="space-y-3.5" data-testid="treino-semana">
      <div className="rounded-2xl border border-blue-100 overflow-hidden bg-card">
        <div className="bg-blue-50 px-4 min-h-[48px] flex items-center gap-2">
          <h2 className="text-[13.5px] font-extrabold tracking-wide text-blue-900">MINHA SEMANA DE TREINO</h2>
          <span className="ml-auto text-[12.5px] font-bold text-blue-900 tabular-nums">
            {feitos} de {planejados} feito{planejados === 1 ? "" : "s"}
          </span>
        </div>
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[10.5px] font-extrabold tracking-[.12em] text-blue-900 h-9">
              <th className="text-left pl-4 w-[104px] min-[400px]:w-[112px] border-t border-b border-r border-blue-100 font-extrabold">DIA</th>
              <th className="text-left pl-3 border-t border-b border-r border-blue-100 font-extrabold">TREINO</th>
              <th className="w-[56px] border-t border-b border-blue-100 font-extrabold">FEITO</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const ultima = i === linhas.length - 1;
              const tom = tomDoDia(l.dia);
              // fundo de hoje nas CÉLULAS (a zebra do escuro pinta a célula por cima da linha)
              const b = cn(!ultima && "border-b", "border-blue-100", l.hoje && tom.claro);
              return (
                <tr
                  key={l.dia}
                  onClick={() => onAbrirDia(l.dia)}
                  className={cn("cursor-pointer", l.descanso ? "h-[48px]" : "h-[56px]")}
                  data-testid={`semana-${l.dia}`}
                  aria-current={l.hoje ? "date" : undefined}
                >
                  <td className={cn(b, "border-r pl-2.5")}>
                    <button
                      type="button"
                      className={cn("inline-flex items-center gap-2 font-extrabold text-[12.5px] min-h-[40px]", l.hoje ? tom.forte : "text-foreground")}
                      aria-label={`Editar o treino de ${l.dia.toLowerCase()}`}
                      onClick={(e) => { e.stopPropagation(); onAbrirDia(l.dia); }}
                    >
                      <i className={cn("w-1.5 h-6 rounded shrink-0", COR_DO_DIA[l.dia])} aria-hidden="true" />
                      {l.dia}
                    </button>
                  </td>
                  <td className={cn(b, "border-r pl-3 pr-2 py-1.5", l.descanso && "text-muted-foreground")}>
                    {l.descanso ? (
                      <span>😴 Descanso</span>
                    ) : (
                      <>
                        <p className={cn("font-semibold leading-snug", l.semTreino && "text-muted-foreground")}>{l.titulo}</p>
                        {l.sub && (
                          <p className={cn("text-[11.5px] tabular-nums leading-snug", l.hoje ? cn(tom.forte, "font-semibold") : "text-muted-foreground")}>{l.sub}</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className={cn(b, "text-center")}>
                    {l.descanso && !l.treinou ? (
                      <span className="text-muted-foreground" aria-label="descanso">—</span>
                    ) : (
                      <Quadradinho
                        marcado={l.treinou}
                        parcial={l.emAndamento}
                        tom={tom}
                        rotulo={l.treinou ? "feito" : l.emAndamento ? "em andamento" : "não feito"}
                        className="mx-auto"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2.5 border-t border-blue-100 text-[11.5px] text-muted-foreground">Toque num dia pra montar ou editar os exercícios dele.</p>
      </div>
      {children}
    </div>
  );
}
