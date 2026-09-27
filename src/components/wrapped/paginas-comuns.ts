import type { CorpoDoMes, RetroMes, SentirDoMes } from "@/lib/retrospectiva";
import type { Aba } from "./pecas-planner";
import { perfilEmFrase } from "./temas";

/**
 * O que as páginas dos três temas escrevem igual (26/09) — contagens e
 * frases a partir do dado, sem desenho. Puro: dá pra testar.
 */

export const horas = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
export const minutos = (min: number) => (min >= 60 ? horas(min) : `${min} min`);

/** "+20 min que agosto" / "−20 min que agosto" / "igual a agosto" / "por noite". */
export const legendaDoSono = (s: NonNullable<CorpoDoMes["sono"]>) => {
  if (s.diferencaMin === null) return "por noite";
  if (Math.abs(s.diferencaMin) < 5) return `igual a ${s.mesAnterior}`;
  return `${s.diferencaMin > 0 ? "+" : "−"}${minutos(Math.abs(s.diferencaMin))} que ${s.mesAnterior}`;
};

/** "17 de 26 dias bem ou melhor": dias com humor 4–5 sobre os dias com humor anotado. */
export const contagemDoHumor = (porDia: { nota: number }[]) => ({
  bons: porDia.filter((d) => Math.round(d.nota) >= 4).length,
  total: porDia.length,
});

/** "16 dias de diário · 9 coisas pelas quais você agradeceu". */
export const partesDoSentir = (s: SentirDoMes) =>
  [
    s.diasDeDiario > 0 ? `${s.diasDeDiario} ${s.diasDeDiario === 1 ? "dia" : "dias"} de diário` : null,
    s.gratidoes > 0 ? `${s.gratidoes} ${s.gratidoes === 1 ? "coisa pela qual" : "coisas pelas quais"} você agradeceu` : null,
  ].filter(Boolean) as string[];

/** "1º" no primeiro dia, o número nos outros ("começou dia 23"). */
export const diaDoInicio = (d: number) => (d === 1 ? "1º" : String(d));

/**
 * Os dias da capa da versão curta: a base inteira quando cabe (até 14 dias),
 * senão só os dias anotados.
 */
export const diasDaCapaCurta = (r: RetroMes) => {
  const base = r.base;
  const dias = base.dias <= 14
    ? Array.from({ length: base.dias }, (_, i) => base.primeiroDia + i)
    : r.atividade.dias.length ? r.atividade.dias : [base.primeiroDia];
  return { dias, de: dias[0], ate: dias[dias.length - 1] };
};

/** O fecho da versão curta: o próximo mês (se a retrospectiva é a do mês que acabou de fechar). */
export const fraseDoFecho = (recente: boolean, proximo: string) =>
  recente
    ? `Anotando um pouco por dia, a de ${proximo.toLowerCase()} chega completa — com o card pra postar.`
    : "Quanto mais você registra, mais a próxima retrospectiva conta sobre o seu mês.";

const COR_DA_ABA: Record<string, string> = {
  "meu-mes": "#22c55e", dinheiro: "#d99a12", corpo: "#3b82f6", humor: "#ec4899", card: "#d22d80", foco: "#8b5cf6",
};
const ROTULO_DA_ABA: Record<string, string> = { "meu-mes": "Meu mês", dinheiro: "Dinheiro", corpo: "Corpo", humor: "Humor", card: "Card" };

/** As abas de índice do planner: só as páginas que existem nesta retrospectiva. */
export const abasDaRetro = (paginas: string[], proximo: string): Aba[] =>
  paginas
    .filter((id) => id in COR_DA_ABA)
    .map((id) => ({ id, rotulo: id === "foco" ? proximo : ROTULO_DA_ABA[id], cor: COR_DA_ABA[id] }));

/** "02", "03"… — o número da página (a capa é a 01). */
export const numeroDaPagina = (paginas: string[], id: string) => String(Math.max(1, paginas.indexOf(id) + 1)).padStart(2, "0");

/** O sumário da capa da revista ("Nesta edição"): cada página com o número que ela conta. */
export const sumarioDaRetro = (r: RetroMes, paginas: string[], proximo: string): { n: string; t: string; v: string }[] => {
  const out: { n: string; t: string; v: string }[] = [];
  for (const id of paginas) {
    const n = numeroDaPagina(paginas, id);
    if (id === "meu-mes" && r.meuMes) out.push({ n, t: "Meu mês", v: `${r.meuMes.diasAnotados} ${r.meuMes.diasAnotados === 1 ? "dia anotado" : "dias anotados"}` });
    if (id === "dinheiro" && r.financas) {
      const f = r.financas;
      out.push({ n, t: "Dinheiro", v: f.gastosAnotados > 0 ? `${f.gastosAnotados} ${f.gastosAnotados === 1 ? "gasto anotado" : "gastos anotados"}` : `${f.txCount} lançamentos` });
    }
    if (id === "corpo" && r.corpo) {
      const c = r.corpo;
      out.push({ n, t: "Corpo", v: c.treinos > 0 ? `${c.treinos} ${c.treinos === 1 ? "treino" : "treinos"}` : c.agua ? `${c.agua.diasNaMeta} dias na meta de água` : `${horas(c.sono!.mediaMin)} de sono` });
    }
    if (id === "humor" && r.sentir) {
      const s = r.sentir;
      out.push({ n, t: "Como você estava", v: s.palavra ? `${s.palavra}, na maior parte` : s.diasDeDiario > 0 ? `${s.diasDeDiario} dias de diário` : "o que você escreveu" });
    }
    if (id === "card") out.push({ n, t: "O card do mês", v: perfilEmFrase(r.perfil.name) });
    if (id === "foco") out.push({ n, t: `Foco de ${proximo.toLowerCase()}`, v: "você escolhe" });
  }
  return out;
};
