/**
 * O ITEM DA DEMO NA CONTA (e de volta na demo) — 28/09.
 *
 * Regras, todas travadas em src/test/demo-guiada.test.ts:
 *   · LISTA FECHADA de chaves: o item só grava nas chaves REAIS dos módulos
 *     abaixo. Nada de chave inventada, nada de `core-demo-*`.
 *   · SÓ O ITEM DELA. Nunca dado de exemplo: o que vai pra conta é o valor que
 *     já estava lá + o registro dela. A demo é um snapshot de mentira; nenhum
 *     pedaço dela atravessa.
 *   · CHAVE SINCRONIZADA NUNCA MUDA DE TIPO (28/09: um objeto em
 *     `finance-orcamento-ano` derrubou o app antigo). Lista continua lista,
 *     mapa continua mapa. Achou outro tipo lá? Não grava — perde o item, não a
 *     conta.
 *   · IDEMPOTENTE: o id do registro vem do próprio item; gravar duas vezes (o
 *     paywall remonta, ela volta do Pix) não duplica.
 *   · NO FORMATO QUE O MÓDULO JÁ USA: o gasto é o mesmo objeto do
 *     `addExpense` (ExpenseTable), o hábito é o nome (Rotina), o exercício é
 *     o `exercicioNovo` (treino-plano), a meta é a `emptyGoal` do
 *     GoalsBoardV2, a água é a porção do dia nas DUAS chaves que a Saúde e a
 *     Rotina leem.
 */
import { localDayKey } from "@/lib/utils";
import { exercicioNovo } from "@/lib/treino-plano";
import { DIAS, indiceDoDia } from "@/lib/treino-constancia";
import { codificarItem, type ItemDaDemo } from "@/lib/demo-guiada";

export const CHAVES_DO_ITEM = [
  "finance-expenses",
  "rotina-habits",
  "saude-workouts-v2",
  "treino-active-days",
  "core-saude-water",
  "water-log",
  "goals-board-v2",
] as const;
export type ChaveDoItem = (typeof CHAVES_DO_ITEM)[number];

/** Um passo de gravação: a chave e a função pura "valor atual → próximo".
 *  `undefined` = não grava (já está lá, ou o tipo não bate). */
export interface Gravacao {
  chave: ChaveDoItem;
  proximo: (atual: unknown) => unknown | undefined;
}

/** Id estável do item: mesmo item → mesmo id (djb2 em base 36). */
export const idDoItem = (item: ItemDaDemo): string => {
  let h = 5381;
  const s = codificarItem(item);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `demo-${(h >>> 0).toString(36)}`;
};

const ehMapa = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const vazio = (v: unknown) => v === undefined || v === null;
const mesmoNome = (a: unknown, b: string) => typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lista: acrescenta o registro no fim, a menos que ele já esteja lá. Outro tipo → não grava. */
const naLista = (jaTem: (x: unknown) => boolean, registro: unknown) => (atual: unknown) => {
  if (vazio(atual)) return [registro];
  if (!Array.isArray(atual)) return undefined;
  if (atual.some(jaTem)) return undefined;
  return [...atual, registro];
};

const DIAS_DE_TREINO_PADRAO = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"]; // mesmo padrão do Treino.tsx

export type Modo = "conta" | "demo";

/**
 * O que gravar pro item. `modo`:
 *   · "conta": na conta dela (depois do cadastro). Água = "pelo menos 1 copo
 *     hoje" (a conta nova não tem os 5 copos da demo).
 *   · "demo": de volta no snapshot da demo, quando ela reabre o módulo. Água =
 *     o copo dela POR CIMA dos copos de exemplo (é o que ela viu).
 */
export function gravacoesDoItem(item: ItemDaDemo, hoje: Date = new Date(), modo: Modo = "conta"): Gravacao[] {
  const id = idDoItem(item);
  const dia = localDayKey(hoje);
  switch (item.tipo) {
    case "gasto": {
      // o mesmo objeto do addExpense (ExpenseTable), à vista, hoje
      const gasto = { id, description: item.nome, category: "outros", value: item.valor ?? 0, date: dia, paymentMethod: "pix" };
      return [{ chave: "finance-expenses", proximo: naLista((x) => ehMapa(x) && x.id === id, gasto) }];
    }
    case "habito": {
      const nomeDe = (x: unknown) => (typeof x === "string" ? x : ehMapa(x) && typeof x.name === "string" ? x.name : "");
      return [{ chave: "rotina-habits", proximo: naLista((x) => mesmoNome(nomeDe(x), item.nome), item.nome) }];
    }
    case "exercicio": {
      const diaDaSemana = DIAS[indiceDoDia(hoje)];
      const g: Gravacao[] = [{
        chave: "saude-workouts-v2",
        proximo: (atual) => {
          if (!vazio(atual) && !ehMapa(atual)) return undefined;
          const plano = (atual ?? {}) as Record<string, unknown>;
          const d0 = plano[diaDaSemana];
          if (!vazio(d0) && !ehMapa(d0)) return undefined;
          const doDia = (d0 ?? { muscles: [], exercises: [] }) as Record<string, unknown>;
          const lista = doDia.exercises;
          if (!vazio(lista) && !Array.isArray(lista)) return undefined;
          const exs = (lista ?? []) as unknown[];
          if (exs.some((e) => ehMapa(e) && mesmoNome(e.name, item.nome))) return undefined;
          return { ...plano, [diaDaSemana]: { ...doDia, muscles: Array.isArray(doDia.muscles) ? doDia.muscles : [], exercises: [...exs, exercicioNovo(item.nome)] } };
        },
      }];
      // dia que recebe exercício vira dia de treino (mesma regra do adicionarExercicio)
      if (!DIAS_DE_TREINO_PADRAO.includes(diaDaSemana)) {
        g.push({
          chave: "treino-active-days",
          proximo: (atual) => {
            if (!vazio(atual) && !Array.isArray(atual)) return undefined;
            const dias = (atual ?? DIAS_DE_TREINO_PADRAO) as unknown[];
            return dias.includes(diaDaSemana) ? undefined : [...dias, diaDaSemana];
          },
        });
      }
      return g;
    }
    case "agua": {
      const proximo = (atual: unknown) => {
        if (!vazio(atual) && !ehMapa(atual)) return undefined;
        const log = (atual ?? {}) as Record<string, unknown>;
        const agora = Number(log[dia]) || 0;
        const depois = modo === "demo" ? Math.min(20, agora + 1) : Math.max(agora, 1);
        return depois === agora ? undefined : { ...log, [dia]: depois };
      };
      return [{ chave: "core-saude-water", proximo }, { chave: "water-log", proximo }];
    }
    case "meta": {
      // a mesma forma da emptyGoal do GoalsBoardV2
      const meta = {
        id, title: item.nome,
        actionGroups: [
          { id: `${id}-g1`, label: "Definir as bases:", tasks: [] },
          { id: `${id}-g2`, label: "Estruturar o plano:", tasks: [] },
        ],
        referenceLinks: [], referenceImages: [],
        vision: { meta: "", objetivo: "", tempo: "" },
        problems: [{ id: `${id}-p1`, problem: "", solution: "" }],
      };
      return [{ chave: "goals-board-v2", proximo: naLista((x) => ehMapa(x) && (x.id === id || mesmoNome(x.title, item.nome)), meta) }];
    }
  }
}

/** O item de volta no snapshot da demo (ela saiu do módulo e voltou). */
export function aplicarItemNaDemo(sementes: Record<string, unknown>, item: ItemDaDemo, hoje: Date = new Date()): Record<string, unknown> {
  const out = { ...sementes };
  for (const g of gravacoesDoItem(item, hoje, "demo")) {
    const novo = g.proximo(out[g.chave]);
    if (novo !== undefined) out[g.chave] = novo;
  }
  return out;
}

/** Pra conta: lê cada chave do jeito que a conta tem agora e grava só o que mudou. */
export function levarItemParaConta(
  item: ItemDaDemo,
  ler: (chave: ChaveDoItem) => unknown,
  gravar: (chave: ChaveDoItem, valor: unknown) => void,
  hoje: Date = new Date(),
): ChaveDoItem[] {
  const gravadas: ChaveDoItem[] = [];
  for (const g of gravacoesDoItem(item, hoje, "conta")) {
    if (!(CHAVES_DO_ITEM as readonly string[]).includes(g.chave)) continue; // cinto e suspensório
    const novo = g.proximo(ler(g.chave));
    if (novo === undefined) continue;
    gravar(g.chave, novo);
    gravadas.push(g.chave);
  }
  return gravadas;
}
