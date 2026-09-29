/**
 * 📅 MINHA SEMANA (28/09, protótipo) — a agenda da rotina de pele numa tabela de
 * planner: uma linha por passo, uma coluna por dia (cabeçalho na cor do dia).
 * O quadradinho diz "entra nesse dia": pequeno e cinza pro que é TODO dia;
 * cheio e colorido pro que vai só em alguns dias (ácido em âmbar, retinol em
 * violeta, sérum em azul) — cor é sinal do que muda de um dia pro outro, não
 * enfeite. Tocar na linha abre a ficha do passo (dias e produto).
 *
 * É o ÚNICO jeito de ver a agenda desde 28/09 (o dono tirou o ciclo fixo de 4 dias,
 * que não sabia o que a pessoa passa). Rotina antiga, sem dias por passo, aparece
 * com tudo "todo dia" — exatamente o que ela sempre foi.
 */
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  DIAS_CURTOS, TODOS_OS_DIAS, diaDaSemanaDaChave, diasDoPasso, ehTodoDia, nomeCurto, passoValido,
  type PassoDaRotina, type Periodo,
} from "@/lib/beleza-rotina";
import { COR_DO_DIA, DIAS_DA_SEMANA, textoDoDia } from "@/components/treino/planner";
import { TOM_DO_PERIODO } from "./skincare-do-dia";
import type { Skincare } from "./use-skincare";

const corDoPasso = (p: PassoDaRotina): string => {
  if (p.tipo === "retinol" || /retin/i.test(p.name)) return "bg-violet-500";
  if (p.isAcid) return "bg-amber-500";
  if (p.tipo === "vitamina-c" || p.tipo === "niacinamida" || p.tipo === "hialuronico" || /s[ée]rum/i.test(p.name)) return "bg-sky-500";
  return "";
};

export function SemanaDaRotina({ s, onAbrirPasso }: { s: Skincare; onAbrirPasso: (periodo: Periodo, i: number) => void }) {
  const hojeSemana = diaDaSemanaDaChave(s.hoje);
  const linhas = (periodo: Periodo) =>
    s.passos[periodo].map((passo, i) => ({ passo, i })).filter((x): x is { passo: PassoDaRotina; i: number } => passoValido(x.passo));
  // noites com ativo (retinol/ácido) × noites de descanso
  const noitesComAtivo = TODOS_OS_DIAS.filter((d) => s.passos.noite.some((p) => passoValido(p) && p.isAcid && diasDoPasso(p).includes(d))).length;

  return (
    <section className="rounded-2xl border border-pink-100 overflow-hidden bg-card" data-card="semana-skincare" data-testid="semana-skincare">
      <div className="bg-pink-50 px-4 min-h-[44px] flex items-center gap-2 text-pink-900">
        <h2 className="text-[13px] font-extrabold tracking-wide whitespace-nowrap">📅 MINHA SEMANA</h2>
        {noitesComAtivo > 0 && (
          <span className="ml-auto text-right text-[11px] font-bold tabular-nums leading-tight">
            {noitesComAtivo} {noitesComAtivo === 1 ? "noite" : "noites"} de ativo
            <span className="block font-semibold opacity-75">{7 - noitesComAtivo} de descanso</span>
          </span>
        )}
      </div>
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col />
          {DIAS_CURTOS.map((d) => <col key={d} className="w-[31px]" />)}
        </colgroup>
        <thead>
          <tr>
            <th className="border-t border-pink-100 bg-pink-50" aria-label="Passo" />
            {DIAS_DA_SEMANA.map((d, k) => (
              <th
                key={d}
                scope="col"
                className={cn(COR_DO_DIA[d], textoDoDia(d), "py-1 text-[9.5px] font-extrabold tracking-wide")}
                aria-label={`${d}${k === hojeSemana ? " (hoje)" : ""}`}
              >
                {DIAS_CURTOS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["manha", "noite"] as const).map((periodo) => {
            const tom = TOM_DO_PERIODO[periodo];
            const itens = linhas(periodo);
            if (!itens.length) return null;
            return (
              <Fragment key={periodo}>
                <tr>
                  <td colSpan={8} className={cn("px-3 py-1 text-[10px] font-extrabold tracking-[.12em] border-t", tom.claro, tom.titulo, tom.linha)}>
                    {tom.emoji} {tom.rotulo}
                  </td>
                </tr>
                {itens.map(({ passo, i }) => {
                  const dias = diasDoPasso(passo);
                  const cor = corDoPasso(passo);
                  return (
                    <tr key={i} className="active:bg-muted/40" data-testid="linha-semana">
                      <td className={cn("border-t h-10 p-0", tom.linha)}>
                        <button
                          type="button"
                          onClick={() => onAbrirPasso(periodo, i)}
                          className="w-full h-10 px-3 text-left truncate text-[12.5px] font-semibold"
                          aria-label={`Dias e produto de ${passo.name}`}
                        >
                          {nomeCurto(passo.name)}
                        </button>
                      </td>
                      {TODOS_OS_DIAS.map((k) => (
                        <td
                          key={k}
                          onClick={() => onAbrirPasso(periodo, i)}
                          className={cn("border-t border-l text-center align-middle cursor-pointer", tom.linha, k === hojeSemana && "bg-pink-50")}
                        >
                          {dias.includes(k) &&
                            (ehTodoDia(passo) || !cor ? (
                              <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-muted-foreground/35" aria-hidden="true" />
                            ) : (
                              <span className={cn("marca-grafico inline-block w-4 h-4 rounded-[4px]", cor)} aria-hidden="true" />
                            ))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 border-t border-pink-100 text-[11.5px] text-muted-foreground leading-snug">
        Toque num passo pra mudar os dias ou escolher o produto.
      </p>
    </section>
  );
}
