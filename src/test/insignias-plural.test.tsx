/**
 * "1 MESES NO AZUL" (29/09, o dono viu no card de compartilhar): o rótulo do
 * selo das insígnias ATUAIS segue o número — singular com 1, plural com 2 —
 * usando a `unidade` que cada insígnia já declara. Passa por TODAS as 53 com
 * valor 1 e 2, e confere o texto desenhado dentro do pin.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CATALOGO, montarInsignia, rotuloPeloValor } from "@/components/conquistas/insignias";
import { Insignia } from "@/components/conquistas/Insignia";

const def = (id: string) => {
  const d = CATALOGO.find((x) => x.id === id);
  if (!d) throw new Error(`sem ${id}`);
  return d;
};
/** As palavras que só existem no plural da unidade ("meses", "dias", "quitadas"…). */
const soDoPlural = (u: [string, string]) => {
  const s = u[0].toLowerCase().split(/\s+/), p = u[1].toLowerCase().split(/\s+/);
  return s.length === p.length ? p.filter((w, i) => w && w !== s[i]) : [];
};

describe("o rótulo do selo no número certo — todas as insígnias", () => {
  it.each(CATALOGO.map((d) => [d.id]))("%s: com 2 é o rótulo de sempre; com 1 nenhuma palavra fica no plural", (id) => {
    const d = def(id);
    const com2 = montarInsignia(d, { valor: 2 });
    const com1 = montarInsignia(d, { valor: 1 });
    expect(com2.rotulo).toBe(d.rotulo);
    if (d.fmt !== "int") {
      expect(com1.rotulo).toBe(d.rotulo); // %, R$, kg, horas e meses: o rótulo não é unidade contável
      return;
    }
    const palavras = com1.rotulo.toLowerCase().split(" ");
    for (const plural of [...soDoPlural(d.unidade), "feitas"]) expect(palavras, `${id}: "${com1.rotulo}"`).not.toContain(plural);
    // o resto da insígnia não muda
    expect(com1.texto).toBe("1");
    expect(com1.unid).toBe(d.unidade[0]);
  });

  it("os casos que o dono vai ver", () => {
    const casos: [string, string, string][] = [
      ["fin-azul", "MÊS NO AZUL", "MESES NO AZUL"],
      ["fin-dividas", "QUITADA", "QUITADAS"],
      ["fin-sem-gastar", "DIA SEM GASTAR", "DIAS SEM GASTAR"],
      ["tre-mes", "TREINO", "TREINOS"],
      ["tre-semanas", "SEMANA NA META", "SEMANAS NA META"],
      ["tre-recordes", "RECORDE", "RECORDES"],
      ["die-impecaveis", "DIA NA DIETA", "DIAS NA DIETA"],
      ["die-refeicoes", "REFEIÇÃO", "REFEIÇÕES"],
      ["die-seguidos", "SEGUIDO NA DIETA", "SEGUIDOS NA DIETA"],
      ["sau-agua", "DIA DE ÁGUA", "DIAS DE ÁGUA"],
      ["sau-sono", "NOITE DE SONO", "NOITES DE SONO"],
      ["rot-campeao", "DIA DE", "DIAS DE"],
      ["rot-ritual", "MANHÃ", "MANHÃS"],
      ["est-sessoes", "SESSÃO", "SESSÕES"],
      ["lei-livros", "LIVRO LIDO", "LIVROS LIDOS"],
      ["lei-ano", "LIVRO NO ANO", "LIVROS NO ANO"],
      ["met-mes", "META DO MÊS", "METAS DO MÊS"],
      ["met-feitas", "META FEITA", "METAS FEITAS"],
      ["cas-manutencoes", "MANUTENÇÃO", "MANUTENÇÕES"],
      ["via-paises", "PAÍS", "PAÍSES"],
      ["via-viagens", "VIAGEM", "VIAGENS"],
      // rótulo que não é unidade: igual nos dois
      ["seq-recorde", "RECORDE", "RECORDE"],
      ["det-sequencia", "SEM RECAÍDA", "SEM RECAÍDA"],
      ["pet-diario", "DO PET", "DO PET"],
      ["fin-delivery", "SEM DELIVERY", "SEM DELIVERY"],
      ["fin-reserva", "DE RESERVA", "DE RESERVA"],
    ];
    for (const [id, um, dois] of casos) {
      expect(montarInsignia(def(id), { valor: 1 }).rotulo, id).toBe(um);
      expect(montarInsignia(def(id), { valor: 2 }).rotulo, id).toBe(dois);
    }
    // 0 continua no plural ("0 treinos"), e o número arredondado decide
    expect(rotuloPeloValor(def("tre-mes"), 0)).toBe("TREINOS");
    expect(rotuloPeloValor(def("tre-mes"), 1.2)).toBe("TREINO");
  });

  it("o pin desenha '1 · MÊS NO AZUL' (e o hábito campeão, 'DIA DE MEDITAR')", () => {
    const { container } = render(
      <>
        <Insignia ins={montarInsignia(def("fin-azul"), { valor: 1 })} tamanho={120} estatico />
        <Insignia ins={montarInsignia(def("rot-campeao"), { valor: 1, sub: "Meditar" })} tamanho={120} estatico />
        <Insignia ins={montarInsignia(def("fin-azul"), { valor: 2 })} tamanho={120} estatico />
      </>,
    );
    const textos = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(textos).toContain("MÊS NO AZUL");
    expect(textos).toContain("DIA DE MEDITAR");
    expect(textos).toContain("MESES NO AZUL");
    expect(textos.filter((t) => t === "MESES NO AZUL")).toHaveLength(1); // só o do valor 2
  });
});
