/**
 * MINHA SEMANA — a agenda da rotina de pele numa tabela de planner: uma linha
 * por passo, uma coluna por dia. É o ÚNICO jeito de ver a agenda desde 28/09 (o
 * dono tirou o ciclo fixo de 4 dias). Rotina antiga, sem dias por passo, aparece
 * com tudo "todo dia" — exatamente o que ela sempre foi.
 *
 * Visual da Beleza (28/09): cabeçalho rosé, dias em miúdo (sem as cores do dia
 * do Treino), a coluna de hoje num rosé bem claro, e GOTAS pros ativos — retinol
 * em ameixa, ácido em pêssego, sérum em rosé; o passo de base (limpeza,
 * hidratante, protetor) é um pontinho nude. A legenda fica no pé.
 * Tocar na linha abre a ficha do passo (dias e produto).
 */
import { Fragment } from "react";
import { CalendarHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIAS_CURTOS, TODOS_OS_DIAS, diaDaSemanaDaChave, diasDoPasso, nomeCurto, passoValido,
  type PassoDaRotina, type Periodo,
} from "@/lib/beleza-rotina";
import { DIAS_DA_SEMANA } from "@/components/treino/planner";
import { CartaoBeleza, FaixaBeleza, Gota, IconePeriodo, Serif, type TipoGota } from "./kit";
import type { Skincare } from "./use-skincare";

/** Que gota o passo leva: retinol, ácido (esfoliante), sérum — o resto é base. */
export const gotaDoPasso = (p: PassoDaRotina): TipoGota => {
  if (p.tipo === "retinol" || /retin/i.test(p.name)) return "retinol";
  if (p.isAcid) return "acido";
  if (p.tipo === "vitamina-c" || p.tipo === "niacinamida" || p.tipo === "hialuronico" || /s[ée]rum/i.test(p.name)) return "serum";
  return "base";
};

export function SemanaDaRotina({ s, onAbrirPasso }: { s: Skincare; onAbrirPasso: (periodo: Periodo, i: number) => void }) {
  const hojeSemana = diaDaSemanaDaChave(s.hoje);
  const linhas = (periodo: Periodo) =>
    s.passos[periodo].map((passo, i) => ({ passo, i })).filter((x): x is { passo: PassoDaRotina; i: number } => passoValido(x.passo));
  // noites com ativo (retinol/ácido) × noites de descanso
  const noitesComAtivo = TODOS_OS_DIAS.filter((d) => s.passos.noite.some((p) => passoValido(p) && p.isAcid && diasDoPasso(p).includes(d))).length;

  return (
    <CartaoBeleza data-card="semana-skincare" data-testid="semana-skincare">
      <FaixaBeleza
        icone={<CalendarHeart className="w-4 h-4 text-bz-acento" />}
        titulo="MINHA SEMANA"
        direita={
          noitesComAtivo > 0 ? (
            <span className="text-right leading-tight block">
              {noitesComAtivo} {noitesComAtivo === 1 ? "noite" : "noites"} de ativo
              <span className="block font-semibold opacity-75">{7 - noitesComAtivo} de descanso</span>
            </span>
          ) : undefined
        }
      />
      {/* A cor de fundo mora na COLUNA (hoje) e na LINHA (manhã, noite), nunca na célula: no
          escuro, a zebra das tabelas do app pinta a célula de azul-grafite (beleza.css a desliga). */}
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col />
          {DIAS_CURTOS.map((d, k) => <col key={d} className={cn("w-[31px]", k === hojeSemana && "bg-bz-hoje")} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="border-t border-bz-linha" aria-label="Passo" />
            {DIAS_DA_SEMANA.map((d, k) => (
              <th
                key={d}
                scope="col"
                className={cn(
                  "border-t border-bz-linha py-2 text-[9.5px] font-extrabold tracking-[.06em]",
                  k === hojeSemana ? "text-bz-acento" : "text-bz-suave",
                )}
                aria-label={`${d}${k === hojeSemana ? " (hoje)" : ""}`}
              >
                {DIAS_CURTOS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["manha", "noite"] as const).map((periodo) => {
            const itens = linhas(periodo);
            if (!itens.length) return null;
            const manha = periodo === "manha";
            return (
              <Fragment key={periodo}>
                <tr className={manha ? "bg-bz-manha text-bz-manha-tinta" : "bg-bz-noite text-bz-noite-tinta"}>
                  <td colSpan={8} className="border-t border-bz-linha pl-1.5 pr-3 py-1">
                    <span className="flex items-center gap-1.5">
                      <IconePeriodo periodo={periodo} className="w-7 h-7" />
                      <Serif className="text-[17px] leading-none">{manha ? "manhã" : "noite"}</Serif>
                    </span>
                  </td>
                </tr>
                {itens.map(({ passo, i }) => {
                  const dias = diasDoPasso(passo);
                  const gota = gotaDoPasso(passo);
                  return (
                    <tr key={i} className="active:bg-bz-blush/60" data-testid="linha-semana">
                      <td className="border-t border-bz-linha h-10 p-0">
                        <button
                          type="button"
                          onClick={() => onAbrirPasso(periodo, i)}
                          className="w-full h-10 px-3 text-left truncate text-[12.5px] font-semibold text-bz-tinta bg-transparent"
                          aria-label={`Dias e produto de ${passo.name}`}
                        >
                          {nomeCurto(passo.name)}
                        </button>
                      </td>
                      {/* sem linha vertical: a coluna de hoje e as gotas já marcam o ritmo */}
                      {TODOS_OS_DIAS.map((k) => (
                        <td key={k} onClick={() => onAbrirPasso(periodo, i)} className="border-t border-bz-linha text-center align-middle cursor-pointer">
                          {dias.includes(k) && <Gota tipo={gota} />}
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
      <div className="px-4 py-2.5 border-t border-bz-linha space-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-bz-suave" aria-label="Legenda">
          <span className="inline-flex items-center gap-1"><Gota tipo="retinol" /> retinol</span>
          <span className="inline-flex items-center gap-1"><Gota tipo="acido" /> ácido</span>
          <span className="inline-flex items-center gap-1"><Gota tipo="serum" /> sérum</span>
          <span className="inline-flex items-center gap-1"><Gota tipo="base" /> base</span>
        </p>
        <p className="text-[11.5px] text-bz-suave leading-snug">Toque num passo pra mudar os dias ou escolher o produto.</p>
      </div>
    </CartaoBeleza>
  );
}
