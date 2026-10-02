/**
 * "Ficou de ontem" (02/10) — as REGRAS: o que entra no bloco, o que nunca
 * entra, as iguais que viram uma linha, e o que cada saída faz na lista.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  JANELA_FICOU_DE_ONTEM, agruparPorDia, apagarTarefas, concluirNoDiaOriginal, restaurarTarefas, rotuloDoAtraso, tarefasDosItens,
  tarefasQueFicaram, trazerParaHoje,
} from "@/lib/ficou-de-ontem";
import type { TarefaDoDia } from "@/lib/tarefas";

const HOJE = "2026-10-02";
const t = (id: string, texto: string, dia: string, extra: Partial<TarefaDoDia> = {}): TarefaDoDia => ({ id, texto, feito: false, dia, ...extra });
const R = "rotina-day-tasks";
const C = "career-day-tasks";

describe("o que entra no bloco", () => {
  it("pendente de ontem até 7 dias atrás; hoje, concluída, futura e mais velha ficam de fora", () => {
    const lista = [
      t("a", "de ontem", "2026-10-01"),
      t("b", "de 7 dias", "2026-09-25"), // exatamente 7 dias
      t("c", "de 8 dias", "2026-09-24"),
      t("d", "de hoje", HOJE),
      t("e", "de amanhã", "2026-10-03"),
      t("f", "feita ontem", "2026-10-01", { feito: true }),
    ];
    expect(JANELA_FICOU_DE_ONTEM).toBe(7);
    const r = tarefasQueFicaram([{ chave: R, lista }], HOJE);
    expect(r.map((i) => i.tarefa.id)).toEqual(["a", "b"]);
    expect(r.map((i) => i.diasAtras)).toEqual([1, 7]);
  });

  it("lista torta/ausente não derruba (id ou dia ilegível fica de fora)", () => {
    expect(tarefasQueFicaram([{ chave: R, lista: undefined }], HOJE)).toEqual([]);
    expect(tarefasQueFicaram([{ chave: R, lista: [null, 3, { id: "x" }, { id: "y", texto: "ok", dia: "ontem" }, t("z", "boa", "2026-10-01")] }], HOJE).map((i) => i.tarefa.id)).toEqual(["z"]);
  });

  it("junta as duas listas (Rotina e Carreira) e diz de qual cada uma veio", () => {
    const r = tarefasQueFicaram([
      { chave: R, lista: [t("a", "Pagar a luz", "2026-10-01")] },
      { chave: C, lista: [t("b", "Mandar o relatório", "2026-09-30")] },
    ], HOJE);
    expect(r.map((i) => [i.chave, i.tarefa.id])).toEqual([[R, "a"], [C, "b"]]);
  });
});

describe("repetidas: a pessoa que digita 'Tomar vitamina' todo dia e esquece", () => {
  it("as iguais (texto sem acento/caixa + mesma hora) viram UMA linha, a do dia mais novo, e a ação vale pro grupo", () => {
    const lista = [
      t("v1", "Tomar vitamina", "2026-09-29"),
      t("v2", "tomar  vitamina", "2026-09-30"),
      t("v3", "Tomar vitamína", "2026-10-01"),
      t("o", "Outra coisa", "2026-10-01"),
    ];
    const r = tarefasQueFicaram([{ chave: R, lista }], HOJE);
    expect(r).toHaveLength(2);
    const v = r.find((i) => i.tarefa.texto.toLowerCase().includes("vitam"))!;
    expect(v.tarefa.id).toBe("v3");
    expect(v.ids).toEqual(["v3", "v2", "v1"]);
  });

  it("horas diferentes NÃO são a mesma tarefa", () => {
    const lista = [t("a", "Remédio", "2026-10-01", { hora: "08:00" }), t("b", "Remédio", "2026-09-30", { hora: "20:00" })];
    expect(tarefasQueFicaram([{ chave: R, lista }], HOJE)).toHaveLength(2);
  });

  it("já existe uma igual em HOJE (aberta ou feita): não aparece de novo", () => {
    const aberta = [t("a", "Tomar vitamina", "2026-10-01"), t("h", "Tomar vitamina", HOJE)];
    expect(tarefasQueFicaram([{ chave: R, lista: aberta }], HOJE)).toEqual([]);
    const feita = [t("a", "Tomar vitamina", "2026-10-01"), t("h", "Tomar vitamina", HOJE, { feito: true })];
    expect(tarefasQueFicaram([{ chave: R, lista: feita }], HOJE)).toEqual([]);
    // a igual de hoje na OUTRA lista também conta (a pessoa vê as duas juntas na Home)
    expect(tarefasQueFicaram([{ chave: R, lista: [t("a", "Ligar", "2026-10-01")] }, { chave: C, lista: [t("h", "ligar", HOJE)] }], HOJE)).toEqual([]);
  });
});

describe("agrupar por dia", () => {
  it("'ontem', 'há 3 dias' — do mais perto pro mais longe, as com hora primeiro dentro do dia", () => {
    expect(rotuloDoAtraso(1)).toBe("ontem");
    expect(rotuloDoAtraso(3)).toBe("há 3 dias");
    const lista = [
      t("a", "sem hora", "2026-10-01"),
      t("b", "com hora", "2026-10-01", { hora: "09:00" }),
      t("c", "velha", "2026-09-29"),
    ];
    const g = agruparPorDia(tarefasQueFicaram([{ chave: R, lista }], HOJE), HOJE);
    expect(g.map((x) => [x.rotulo, x.dia])).toEqual([["ontem", "2026-10-01"], ["há 3 dias", "2026-09-29"]]);
    expect(g[0].itens.map((i) => i.tarefa.id)).toEqual(["b", "a"]);
  });
});

describe("as três saídas", () => {
  const lista = [
    t("a", "Ligar pro fornecedor", "2026-10-01", { hora: "15:00", aviso: 30, detalhes: "Falar com a Rita" }),
    t("b", "Comprar pão", "2026-09-30"),
    t("c", "Já era de hoje", HOJE),
  ];
  const itens = tarefasQueFicaram([{ chave: R, lista }], HOJE);
  const [a, b] = [itens.find((i) => i.tarefa.id === "a")!, itens.find((i) => i.tarefa.id === "b")!];

  it("TRAZER PRA HOJE: a mesma tarefa muda de dia, mantém hora/aviso/detalhes e lembra de onde veio", () => {
    const nova = trazerParaHoje(lista, [a], HOJE);
    expect(nova).toHaveLength(3);
    expect(nova.find((x) => x.id === "a")).toEqual({ ...lista[0], dia: HOJE, veioDe: "2026-10-01" });
    expect(nova.find((x) => x.id === "b")).toEqual(lista[1]); // as outras não mexem
  });

  it("trazer de novo uma que já veio de outro dia mantém o dia ORIGINAL em veioDe", () => {
    const veio = [t("a", "Ligar", "2026-10-01", { veioDe: "2026-09-28" })];
    const [i] = tarefasQueFicaram([{ chave: R, lista: veio }], HOJE);
    expect(trazerParaHoje(veio, [i], HOJE)[0].veioDe).toBe("2026-09-28");
  });

  it("trazer um grupo de iguais leva a mais nova e solta as velhas (era a mesma coisa repetida)", () => {
    const rep = [t("v1", "Vitamina", "2026-09-29"), t("v2", "Vitamina", "2026-10-01")];
    const [g] = tarefasQueFicaram([{ chave: R, lista: rep }], HOJE);
    const nova = trazerParaHoje(rep, [g], HOJE);
    expect(nova.map((x) => [x.id, x.dia])).toEqual([["v2", HOJE]]);
  });

  it("CONCLUIR: marca feita NO DIA EM QUE ERA — o dia não muda", () => {
    const nova = concluirNoDiaOriginal(lista, [b]);
    expect(nova.find((x) => x.id === "b")).toEqual({ ...lista[1], feito: true });
    expect(nova.find((x) => x.id === "b")?.dia).toBe("2026-09-30");
    // e concluída nunca mais aparece no bloco
    expect(tarefasQueFicaram([{ chave: R, lista: nova }], HOJE).map((i) => i.tarefa.id)).toEqual(["a"]);
  });

  it("APAGAR: tira o grupo todo", () => {
    expect(apagarTarefas(lista, [a]).map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("DESFAZER devolve só as do gesto — o que a pessoa fez nesse meio tempo fica", () => {
    const antes = tarefasDosItens(lista, [a]);
    const depoisDeApagar = apagarTarefas(lista, [a]);
    const comNova = [...depoisDeApagar, t("n", "criada depois", HOJE)];
    const volta = restaurarTarefas(comNova, antes);
    expect(volta.map((x) => x.id).sort()).toEqual(["a", "b", "c", "n"]);
    // e desfazer um TRAZER troca a tarefa pela original (de volta ao dia dela)
    const trazida = trazerParaHoje(lista, [a], HOJE);
    const desfeita = restaurarTarefas(trazida, antes);
    expect(desfeita.find((x) => x.id === "a")).toEqual(lista[0]);
    expect(desfeita).toHaveLength(3);
  });

  it("não mexe em tarefa de outra lista nem com id parecido", () => {
    const outra = [t("a", "Mesma id, outra lista", "2026-10-01")];
    // a ação é sempre sobre UMA lista: a de outra chave nem é tocada pelo chamador
    expect(trazerParaHoje(outra, [], HOJE)).toEqual(outra);
  });
});
