/**
 * SEMANA (26/09, mockup p2): a semana como TABELA de planner — DIA | TREINO |
 * FEITO, a barrinha na cor do dia, descanso esmaecido, hoje destacado. O FEITO
 * vem do registro de treinos (a data daquele dia nesta semana), não do ✓ do
 * plano. Tocar num dia abre esse dia no 📋 PLANO (27/09: o plano só se edita lá).
 *
 * 09/10 (chamado: "tentei desmarcar o treino do dia 07/10 e não consegui; o de
 * hoje deu certo"): o ✓ da coluna FEITO de um dia já treinado (hoje ou passado)
 * agora é um botão — toca, a tabela pergunta "Desmarcar o treino de terça,
 * 07/10?" no pé, e confirmar tira o dia pela MESMA função do Desmarcar de hoje
 * (registro, volume, carimbo e histórico), com Desfazer. Dia futuro e dia sem
 * treino continuam só leitura.
 */
import { useState, type ReactNode } from "react";
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

/** "terça, 07/10" — como a pergunta e o Desfazer chamam o dia. */
export const rotuloDoDiaDaSemana = (dia: string, data: string) => `${dia.toLowerCase()}, ${data.slice(8, 10)}/${data.slice(5, 7)}`;

export function TreinoSemana({ linhas, onAbrirDia, onDesmarcar, hoje, children }: {
  linhas: LinhaDaSemana[];
  onAbrirDia: (dia: string) => void;
  /** 09/10: tira o treino daquela data (hoje ou passado); sem ele o ✓ é só leitura */
  onDesmarcar?: (data: string, dia: string) => void;
  /** "YYYY-MM-DD" de hoje — só até ele dá pra desmarcar */
  hoje?: string;
  children?: ReactNode;
}) {
  const planejados = linhas.filter((l) => !l.descanso && !l.extra).length;
  const feitos = linhas.filter((l) => l.treinou).length;
  const [confirmando, setConfirmando] = useState<LinhaDaSemana | null>(null);
  const hojeKey = hoje ?? localDayKey();
  const podeDesmarcar = (l: LinhaDaSemana) => !!onDesmarcar && l.treinou && l.data <= hojeKey;
  // se o dia deixou de estar treinado por fora (Desfazer, outra aba), a pergunta cai sozinha
  const pendente = confirmando && linhas.some((l) => l.data === confirmando.data && l.treinou) ? confirmando : null;
  const confirmar = () => {
    if (!pendente) return;
    onDesmarcar?.(pendente.data, pendente.dia);
    setConfirmando(null);
  };
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
                  <td
                    className={cn(b, "text-center", pendente?.data === l.data && "bg-red-50 dark:bg-red-500/10")}
                    // o ✓ que desmarca não pode abrir o dia no PLANO (o toque na linha faz isso)
                    onClick={(e) => { if (podeDesmarcar(l)) e.stopPropagation(); }}
                  >
                    {l.descanso && !l.treinou ? (
                      <span className="text-muted-foreground" aria-label="descanso">—</span>
                    ) : (
                      <Quadradinho
                        marcado={l.treinou}
                        parcial={l.emAndamento}
                        tom={tom}
                        rotulo={podeDesmarcar(l) ? `Desmarcar o treino de ${rotuloDoDiaDaSemana(l.dia, l.data)}` : l.treinou ? "feito" : l.emAndamento ? "em andamento" : "não feito"}
                        onClick={podeDesmarcar(l) ? () => setConfirmando((c) => (c?.data === l.data ? null : l)) : undefined}
                        testId={podeDesmarcar(l) ? `desmarcar-${l.dia}` : undefined}
                        className="mx-auto"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pendente ? (
          <div className="px-4 py-3 border-t border-red-200 bg-red-50 dark:bg-red-500/10 space-y-2.5" data-testid="confirmar-desmarcar" role="alertdialog" aria-labelledby="pergunta-desmarcar">
            <p id="pergunta-desmarcar" className="text-[13.5px] font-bold text-red-900 dark:text-red-200 leading-snug">
              Desmarcar o treino de {rotuloDoDiaDaSemana(pendente.dia, pendente.data)}?
              <span className="block mt-0.5 text-[11.5px] font-medium text-red-900/80 dark:text-red-200/80">Sai do registro, do volume e do histórico desse dia. Dá pra desfazer.</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                className="flex-1 h-10 rounded-lg border border-border bg-card text-[13px] font-bold active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="flex-1 h-10 rounded-lg bg-red-600 text-white text-[13px] font-bold active:scale-95 transition"
                data-testid="desmarcar-confirmar"
              >
                Desmarcar
              </button>
            </div>
          </div>
        ) : (
          <p className="px-4 py-2.5 border-t border-blue-100 text-[11.5px] text-muted-foreground">
            Toque num dia pra montar ou mudar o treino dele no 📋 PLANO.{onDesmarcar ? " Marcou sem querer? Toque no ✓ do dia." : ""}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
