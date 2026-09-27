/**
 * RETROSPECTIVA — o sistema de temas (26/09, rodada 3): a leitura da chave
 * `retro-tema`, os nomes e as frases que as peles escrevem (puras).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));

import { construirRetroMes, type Leitor } from "@/lib/retrospectiva";
import {
  CHAVE_DO_TEMA, TEMA_PADRAO, emDuasLinhas, estiloDoTema, fraseDoHabito, fraseDosDiasSemGasto, lerTema, linhaDoMeuMes, linhasDoPerfil,
  nomeDoTema, paginasPorExtenso, perfilEmFrase,
} from "@/components/wrapped/temas";
import {
  abasDaRetro, contagemDoHumor, diaDoInicio, diasDaCapaCurta, fraseDoFecho, legendaDoSono, partesDoSentir, sumarioDaRetro,
} from "@/components/wrapped/paginas-comuns";

const leitor = (dados: Record<string, unknown>): Leitor => (chave) => dados[chave];
const ago = (dia: number) => `2026-08-${String(dia).padStart(2, "0")}`;
const HOJE = new Date(2026, 8, 26, 12);
const retroDe = (dados: Record<string, unknown>) => construirRetroMes(2026, 7, "u-temas", undefined, { ler: leitor(dados), agora: HOJE })!;

describe("o tema escolhido", () => {
  it("mora em `retro-tema`; o padrão é o planner ('Páginas de dentro'); lixo vira o padrão", () => {
    expect(CHAVE_DO_TEMA).toBe("retro-tema");
    expect(TEMA_PADRAO).toBe("paginas");
    expect(lerTema("edicao")).toBe("edicao");
    expect(lerTema("recortes")).toBe("recortes");
    for (const lixo of [undefined, null, "", "papel", 3, { tema: "edicao" }]) expect(lerTema(lixo)).toBe("paginas");
  });

  it("os nomes da folha e o estilo de card de cada tema (o planner é o card de todos)", () => {
    expect(nomeDoTema("paginas", "Setembro")).toBe("Páginas de dentro");
    expect(nomeDoTema("edicao", "Setembro")).toBe("Edição de Setembro");
    expect(nomeDoTema("recortes", "Setembro")).toBe("Recortes");
    expect(estiloDoTema("paginas")).toBeNull();
    expect(estiloDoTema("edicao")).toBe("revista");
    expect(estiloDoTema("recortes")).toBe("recortes");
  });
});

describe("as frases das peles", () => {
  it("perfil em frase e em duas linhas equilibradas (palavra solta não quebra)", () => {
    expect(perfilEmFrase("Constância de Ferro")).toBe("Constância de ferro");
    expect(emDuasLinhas("Constância de ferro")).toEqual(["Constância", "de ferro"]);
    expect(emDuasLinhas("Olho no dinheiro")).toEqual(["Olho no", "dinheiro"]);
    expect(emDuasLinhas("Equilibrista")).toEqual(["Equilibrista"]);
    expect(linhasDoPerfil("Constância de ferro", 52, 288)).toEqual(["Constância", "de ferro"]);
    expect(linhasDoPerfil("Em construção", 40, 288)).toEqual(["Em construção"]);
    expect(linhasDoPerfil("No azul", 52, 288)).toEqual(["No azul"]);
  });

  it("'Sete páginas', o fecho do mês, o hábito e os dias sem gastar só dizem o que o número sustenta", () => {
    expect(paginasPorExtenso(7)).toBe("Sete páginas");
    expect(paginasPorExtenso(1)).toBe("Uma página");
    expect(paginasPorExtenso(12)).toBe("12 páginas");
    expect(fraseDoHabito(19, 21)).toBe("19 dias, quase todos que você anotou.");
    expect(fraseDoHabito(12, 21)).toBe("12 dias, mais da metade dos que você anotou.");
    expect(fraseDoHabito(3, 21)).toBe("3 dias no mês.");
    expect(fraseDosDiasSemGasto(12, 26)).toBe("de 26. Quase metade.");
    expect(fraseDosDiasSemGasto(20, 26)).toBe("de 26. Mais da metade.");
    expect(fraseDosDiasSemGasto(3, 26)).toBe("de 26.");
    expect(fraseDoFecho(true, "Outubro")).toMatch(/a de outubro chega completa/);
    expect(fraseDoFecho(false, "Outubro")).not.toMatch(/outubro/i);
  });

  it("a linha do 'Meu mês': com o mês anterior superado, 'Tá virando rotina'; nunca 'menos que'", () => {
    const r = retroDe({ "heatmap-log": Object.fromEntries(Array.from({ length: 26 }, (_, i) => [ago(i + 1), true])) });
    expect(linhaDoMeuMes(r)).toBe("Quase todo dia no papel.");
    const pouco = retroDe({ "heatmap-log": Object.fromEntries([2, 9, 16, 23, 30].map((d) => [ago(d), true])), "saude-workout-log": Array.from({ length: 12 }, (_, i) => ago(i + 1)) });
    expect(linhaDoMeuMes(pouco)).not.toMatch(/menos|pouco|falt/i);
  });

  it("sono, humor e o que a pessoa escreveu viram contagens neutras", () => {
    expect(legendaDoSono({ mediaMin: 430, diferencaMin: 20, mesAnterior: "agosto" })).toBe("+20 min que agosto");
    expect(legendaDoSono({ mediaMin: 430, diferencaMin: -75, mesAnterior: "agosto" })).toBe("−1h15 que agosto");
    expect(legendaDoSono({ mediaMin: 430, diferencaMin: 3, mesAnterior: "agosto" })).toBe("igual a agosto");
    expect(legendaDoSono({ mediaMin: 430, diferencaMin: null, mesAnterior: "agosto" })).toBe("por noite");
    expect(contagemDoHumor([{ nota: 5 }, { nota: 4 }, { nota: 3.6 }, { nota: 2 }])).toEqual({ bons: 3, total: 4 });
    expect(partesDoSentir({ porDia: [], palavra: null, pesado: false, diasDeDiario: 1, gratidoes: 9, frase: null }))
      .toEqual(["1 dia de diário", "9 coisas pelas quais você agradeceu"]);
  });

  it("a capa curta mostra a base inteira quando cabe; senão só os dias anotados", () => {
    const nova = retroDe({ "saude-workout-log": [ago(27), ago(29)], "heatmap-log": { [ago(28)]: true } });
    expect(diasDaCapaCurta(nova)).toEqual({ dias: [27, 28, 29, 30, 31], de: 27, ate: 31 });
    expect(diaDoInicio(1)).toBe("1º");
    expect(diaDoInicio(23)).toBe("23");
    const espalhada = retroDe({ "heatmap-log": { [ago(2)]: true, [ago(15)]: true, [ago(29)]: true } });
    expect(diasDaCapaCurta(espalhada).dias).toEqual([2, 15, 29]);
  });

  it("abas e sumário só com as páginas que existem, na ordem, com o próximo mês no foco", () => {
    expect(abasDaRetro(["capa", "meu-mes", "corpo", "card", "foco"], "Setembro").map((a) => a.rotulo)).toEqual(["Meu mês", "Corpo", "Card", "Setembro"]);
    const r = retroDe({
      "heatmap-log": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [ago(i + 1), true])),
      "saude-workout-log": [ago(2), ago(4), ago(6)],
    });
    expect(sumarioDaRetro(r, ["capa", "meu-mes", "corpo", "card", "foco"], "Setembro")).toEqual([
      { n: "02", t: "Meu mês", v: "20 dias anotados" },
      { n: "03", t: "Corpo", v: "3 treinos" },
      { n: "04", t: "O card do mês", v: "Corrente longa" },
      { n: "05", t: "Foco de setembro", v: "você escolhe" },
    ]);
  });
});
