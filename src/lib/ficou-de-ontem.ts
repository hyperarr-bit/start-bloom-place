import { somarDias } from "@/lib/sequencia";
import { horaDaTarefa, ordenarPorHora, prazoDaTarefa, tarefasValidas, type TarefaDoDia } from "@/lib/tarefas";

/**
 * "FICOU DE ONTEM" (02/10) — dois chamados: "quando a tarefa não for concluída,
 * aparecer no dia seguinte" e "tarefas que eu tinha ontem e não finalizei, não
 * consigo achar hoje". A tarefa do dia (rotina-day-tasks / career-day-tasks)
 * nasce presa ao dia em que foi criada; o que ficou sem fazer sumia da tela de
 * hoje (e só o fechamento do mês via).
 *
 * Desenho: NADA se move sozinho. Tarefa pendente de até 7 dias pra trás aparece
 * num bloco no topo da lista de hoje e a pessoa decide, uma a uma ou todas:
 * trazer pra hoje (a MESMA tarefa muda de dia — ganha `veioDe` só pra informar),
 * concluir (feita no dia em que era) ou apagar. Nenhuma chave nova, nenhum
 * formato novo: a lista segue sendo a mesma lista, com um campo opcional que
 * versão antiga do app simplesmente não lê.
 *
 * As tarefas do dia NÃO se repetem (repetição só existe nos Compromissos, que
 * são outra lista e não passam por aqui). O que se repete é a PESSOA: digita
 * "Tomar vitamina" todo dia e deixa de marcar. Pra isso não virar uma fileira
 * de iguais, o bloco:
 *  - junta as iguais (mesmo texto e mesma hora) numa linha só — a do dia mais
 *    novo — e a ação vale pro grupo todo (trazer leva a mais nova e solta as
 *    velhas; concluir marca todas; apagar tira todas);
 *  - esconde a que já tem uma IGUAL em hoje (aberta ou feita): já está na lista.
 *
 * Tudo aqui é PURO (recebe `hoje`), testável sem tela.
 */

/** Até quantos dias pra trás o bloco olha. */
export const JANELA_FICOU_DE_ONTEM = 7;

export interface ItemFicou {
  /** a lista de onde vem (rotina-day-tasks, career-day-tasks) */
  chave: string;
  /** a mais nova do grupo — é a que aparece */
  tarefa: TarefaDoDia;
  /** ids de TODAS as iguais, a mais nova primeiro (o primeiro é o da `tarefa`) */
  ids: string[];
  diasAtras: number;
}

export interface GrupoFicou {
  dia: string;
  diasAtras: number;
  /** "ontem" | "há 3 dias" */
  rotulo: string;
  itens: ItemFicou[];
}

const normalizarTexto = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O que torna duas tarefas "a mesma": o texto (sem acento/caixa) e a hora. */
const assinatura = (t: TarefaDoDia): string => `${normalizarTexto(t.texto)}|${horaDaTarefa(t) ?? ""}`;

/** "ontem", "há 3 dias". */
export const rotuloDoAtraso = (diasAtras: number): string => (diasAtras <= 1 ? "ontem" : `há ${diasAtras} dias`);

const diasEntre = (dia: string, hoje: string): number => {
  for (let n = 1; n <= JANELA_FICOU_DE_ONTEM; n++) if (somarDias(hoje, -n) === dia) return n;
  return 0;
};

/**
 * As tarefas que ficaram: pendentes, de ontem até 7 dias atrás, juntando as
 * iguais e escondendo as que já estão em hoje. Concluída nunca entra.
 */
export function tarefasQueFicaram(fontes: { chave: string; lista: unknown }[], hoje: string): ItemFicou[] {
  const dasHoje = new Set<string>();
  for (const { lista } of fontes) for (const t of tarefasValidas(lista)) if (t.dia === hoje) dasHoje.add(assinatura(t));

  const grupos = new Map<string, ItemFicou>();
  for (const { chave, lista } of fontes) {
    for (const t of tarefasValidas(lista)) {
      if (t.feito) continue;
      // 09/10: tarefa com PRAZO já está na lista de hoje todo dia (apareceHoje) — não é "ficou de ontem"
      if (prazoDaTarefa(t)) continue;
      const atras = diasEntre(t.dia, hoje);
      if (atras === 0) continue; // hoje, futuro ou mais velho que a janela
      const a = assinatura(t);
      if (dasHoje.has(a)) continue;
      const k = `${chave}|${a}`;
      const g = grupos.get(k);
      if (!g) {
        grupos.set(k, { chave, tarefa: t, ids: [String(t.id)], diasAtras: atras });
      } else if (atras < g.diasAtras) {
        grupos.set(k, { chave, tarefa: t, ids: [String(t.id), ...g.ids], diasAtras: atras });
      } else {
        g.ids.push(String(t.id));
      }
    }
  }
  // mais recentes primeiro; no mesmo dia, as com hora primeiro (pela hora), depois a ordem em que foram criadas
  return [...grupos.values()].sort((x, y) => x.diasAtras - y.diasAtras);
}

/** Agrupa por dia ("ontem", "há 3 dias"), com as de horário primeiro dentro do dia. */
export function agruparPorDia(itens: ItemFicou[], hoje: string): GrupoFicou[] {
  const porDia = new Map<number, ItemFicou[]>();
  for (const i of itens) porDia.set(i.diasAtras, [...(porDia.get(i.diasAtras) ?? []), i]);
  return [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([diasAtras, lista]) => {
      const ordenados = ordenarPorHora(lista.map((i) => ({ ...i, hora: horaDaTarefa(i.tarefa) ?? undefined })))
        .map(({ hora: _h, ...resto }) => resto as ItemFicou);
      return { dia: somarDias(hoje, -diasAtras), diasAtras, rotulo: rotuloDoAtraso(diasAtras), itens: ordenados };
    });
}

/* ------------------------------------------------------------------ ações (sobre a lista) */

const lista = (l: unknown): TarefaDoDia[] => (Array.isArray(l) ? (l as TarefaDoDia[]) : []);
const idsDe = (itens: ItemFicou[]) => new Set(itens.flatMap((i) => i.ids));
const eh = (t: unknown, ids: Set<string>) => !!t && typeof t === "object" && ids.has(String((t as { id?: unknown }).id));

/**
 * TRAZER PRA HOJE: a tarefa mais nova de cada grupo vira de hoje (mantém hora,
 * aviso e detalhes); as iguais mais velhas saem (eram a mesma coisa repetida).
 */
export function trazerParaHoje(l: unknown, itens: ItemFicou[], hoje: string): TarefaDoDia[] {
  const levar = new Set(itens.map((i) => i.ids[0]));
  const soltar = new Set(itens.flatMap((i) => i.ids.slice(1)));
  return lista(l)
    .filter((t) => !eh(t, soltar))
    .map((t) => (eh(t, levar) && t.dia !== hoje ? { ...t, dia: hoje, veioDe: t.veioDe ?? t.dia } : t));
}

/** CONCLUIR: feita no dia em que era (o dia não muda — o fechamento da semana conta certo). */
export function concluirNoDiaOriginal(l: unknown, itens: ItemFicou[]): TarefaDoDia[] {
  const ids = idsDe(itens);
  return lista(l).map((t) => (eh(t, ids) ? { ...t, feito: true } : t));
}

/** APAGAR: tira o grupo todo. */
export function apagarTarefas(l: unknown, itens: ItemFicou[]): TarefaDoDia[] {
  const ids = idsDe(itens);
  return lista(l).filter((t) => !eh(t, ids));
}

/**
 * DESFAZER (trazer, concluir ou apagar): cada tarefa volta como era — a que
 * ainda está na lista é trocada pela original, a que saiu é devolvida. Mexe só
 * nas tarefas do gesto: o que a pessoa fez nos 6 segundos do aviso fica.
 */
export function restaurarTarefas(l: unknown, originais: TarefaDoDia[]): TarefaDoDia[] {
  const porId = new Map(originais.map((t) => [String(t.id), t]));
  const atual = lista(l).map((t) => (t && porId.has(String(t.id)) ? (porId.get(String(t.id)) as TarefaDoDia) : t));
  const tem = new Set(atual.map((t) => String(t?.id)));
  return [...atual, ...originais.filter((t) => !tem.has(String(t.id)))];
}

/** As tarefas (inteiras) que um grupo de itens representa na lista — o retrato pro Desfazer. */
export function tarefasDosItens(l: unknown, itens: ItemFicou[]): TarefaDoDia[] {
  const ids = idsDe(itens);
  return lista(l).filter((t) => eh(t, ids));
}
