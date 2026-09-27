import { parseLocalDay } from "@/lib/utils";
import { calcularSequencia, normalizarDias, somarDias } from "@/lib/sequencia";

/**
 * A SEMANA da sequência (27/09): os 7 dias SEG…DOM da semana corrente, cada
 * um com o estado que o card desenha. Tudo vem da lista `core-dias-anotados`
 * e da conta de `calcularSequencia` — nada é gravado.
 *
 *  - feito   → o dia está na lista (disco laranja com chama);
 *  - gelo    → dia vazio que um protetor segurou (`usados`);
 *  - hoje    → hoje ainda sem nada anotado (anel tracejado);
 *  - vazio   → dia passado sem anotação e sem protetor (a sequência quebrou ali);
 *  - futuro  → depois de hoje.
 */
export type EstadoDia = "feito" | "gelo" | "hoje" | "vazio" | "futuro";

export interface DiaDaSemana {
  dia: string;
  rotulo: string;
  estado: EstadoDia;
  ehHoje: boolean;
}

export const ROTULOS_DA_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/** Segunda-feira da semana de `dia` (chave local). */
export const segundaDaSemana = (dia: string): string => somarDias(dia, -((parseLocalDay(dia).getDay() + 6) % 7));

export function semanaDaSequencia(lista: unknown, usados: string[], hoje: string): DiaDaSemana[] {
  const anotados = new Set(normalizarDias(lista));
  const protegidos = new Set(usados);
  const segunda = segundaDaSemana(hoje);
  return ROTULOS_DA_SEMANA.map((rotulo, i) => {
    const dia = somarDias(segunda, i);
    let estado: EstadoDia;
    if (anotados.has(dia)) estado = "feito";
    else if (protegidos.has(dia)) estado = "gelo";
    else if (dia === hoje) estado = "hoje";
    else if (dia > hoje) estado = "futuro";
    else estado = "vazio";
    return { dia, rotulo, estado, ehHoje: dia === hoje };
  });
}

/** Os 7 discos cheios (feito ou protegido) — só acontece no domingo, com o dia garantido. */
export const semanaCompleta = (semana: DiaDaSemana[]): boolean =>
  semana.length === 7 && semana.every((d) => d.estado === "feito" || d.estado === "gelo");

/**
 * Um protetor foi GANHO nesta semana? A conta é honesta: o saldo é refeito
 * dia a dia e só vale se subiu em algum dia da semana (a cada 7 seguidos, até
 * o máximo de 2). Uma semana de 7 discos com um dia de gelo pode não ganhar
 * nada — aí a faixa diz só "semana completa".
 */
export function protetorGanhoNaSemana(lista: unknown, hoje: string): boolean {
  const segunda = segundaDaSemana(hoje);
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(segunda, i);
    if (dia > hoje) break;
    const antes = calcularSequencia(lista, somarDias(dia, -1)).saldo;
    const depois = calcularSequencia(lista, dia).saldo;
    if (depois > antes) return true;
  }
  return false;
}
