import { describe, it, expect } from "vitest";
import { QUIZ, AREA_TRACKS } from "@/lib/funnel";
import { temIconeProprio, iconeDaOpcao, ICONE_PORTA, ICONES_COMPROMISSO, MODULO_VISUAL, ORDEM_CENTRAL, RECORTES_WELCOME } from "@/lib/funnel-icones";
import { passoDeRetomada, ficaNoVoltar } from "@/pages/funis/w/retomada";
import { respondeuTudo } from "@/pages/funis/w/ComecarW";

/**
 * FUNIL v105 (05/09). O dono: "só a primeira pergunta do quiz tá com emojis,
 * o resto não". A regra virou teste: TODA opção de TODA pergunta, de TODAS as
 * trilhas, tem um ícone escolhido de propósito — se alguém acrescentar uma
 * opção nova em funnel.ts sem mapear, este teste avisa antes do build.
 */
describe("ícones do funil v105", () => {
  const trilhas = { dinheiro: QUIZ, ...AREA_TRACKS };
  it("toda opção de toda pergunta tem ícone próprio (21 perguntas, 5 trilhas)", () => {
    const semIcone: string[] = [];
    let perguntas = 0;
    for (const [area, qs] of Object.entries(trilhas)) {
      for (const q of qs) {
        perguntas++;
        for (const o of q.opts) if (!temIconeProprio(o.label)) semIcone.push(`${area}/${q.key}: ${o.label}`);
      }
    }
    expect(perguntas).toBe(21);
    expect(semIcone).toEqual([]);
  });
  it("a porta e os compromissos cobrem as 5 áreas com o módulo certo", () => {
    for (const label of ["Meu dinheiro", "Minha rotina e hábitos", "Treino e alimentação", "Minhas metas paradas", "Tudo, sinceramente"]) {
      expect(MODULO_VISUAL[ICONE_PORTA[label]]).toBeTruthy();
    }
    for (const area of ["dinheiro", "rotina", "corpo", "saude", "metas"]) expect(ICONES_COMPROMISSO[area]).toHaveLength(3);
  });
  it("a central lista os 16 módulos do app na ordem de uso real, e o welcome os 8 mais usados", () => {
    expect(ORDEM_CENTRAL).toHaveLength(16);
    expect(new Set(ORDEM_CENTRAL).size).toBe(16);
    expect(ORDEM_CENTRAL.slice(0, 3)).toEqual(["financas", "rotina", "treino"]);
    expect(RECORTES_WELCOME).toHaveLength(8);
    for (const rc of RECORTES_WELCOME) expect(MODULO_VISUAL[rc.m]).toBeTruthy();
  });
  it("rótulo desconhecido não quebra a tela: cai num ícone, nunca em nada", () => {
    expect(iconeDaOpcao("opção que não existe")).toBeTruthy();
  });
});

describe("eco e retomada v105", () => {
  it("o eco entra só pra quem respondeu 'tudo' na 1ª pergunta (46% das respostas)", () => {
    expect(respondeuTudo({ atrapalha: "Quero organizar tudo" })).toBe(true);
    expect(respondeuTudo({ atrapalha: "Um pouco de tudo" })).toBe(true);
    expect(respondeuTudo({ atrapalha: "Gasto sem perceber" })).toBe(false);
    expect(respondeuTudo({})).toBe(false);
    expect(respondeuTudo(null)).toBe(false);
  });
  it("morreu na comemoração do 'pago': retoma no cadastro; e o Voltar físico fica nela", () => {
    expect(passoDeRetomada("pago", true)).toBe("signup");
    expect(ficaNoVoltar("pago")).toBe(true);
  });
});
