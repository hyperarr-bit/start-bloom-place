/**
 * O fogo que evolui e as capas que o tempo libera (02/10): faixas por dias
 * seguidos, subir/descer de faixa, requisito e frase das capas travadas.
 */
import { describe, it, expect } from "vitest";
import {
  FAIXAS, faixaDoFogo, proximaFaixa, diasParaProximaFaixa, fraseDaProximaFaixa, mudancaDeFaixa, lerFaixaVista,
  capaLiberada, faltamPraCapa, capasLiberadas, capasNovas, fraseDaCapaTravada, requisitoEmTexto, REQUISITO_DA_CAPA, lerCapasVistas,
} from "@/lib/fogo-sequencia";

describe("faixas do fogo", () => {
  it("laranja 1–6 · vermelho 7–13 · roxo 14–29 · azul 30–99 · dourado 100+", () => {
    expect(FAIXAS.map((f) => [f.id, f.min])).toEqual([["laranja", 1], ["vermelho", 7], ["roxo", 14], ["azul", 30], ["dourado", 100]]);
    expect(faixaDoFogo(0).id).toBe("laranja");
    expect(faixaDoFogo(1).id).toBe("laranja");
    expect(faixaDoFogo(6).id).toBe("laranja");
    expect(faixaDoFogo(7).id).toBe("vermelho");
    expect(faixaDoFogo(13).id).toBe("vermelho");
    expect(faixaDoFogo(14).id).toBe("roxo");
    expect(faixaDoFogo(29).id).toBe("roxo");
    expect(faixaDoFogo(30).id).toBe("azul");
    expect(faixaDoFogo(99).id).toBe("azul");
    expect(faixaDoFogo(100).id).toBe("dourado");
    expect(faixaDoFogo(365).id).toBe("dourado");
  });

  it("lixo vira laranja (NaN, negativo, fração pra baixo)", () => {
    expect(faixaDoFogo(NaN).id).toBe("laranja");
    expect(faixaDoFogo(-3).id).toBe("laranja");
    expect(faixaDoFogo(6.9).id).toBe("laranja");
    expect(faixaDoFogo(13.9).id).toBe("vermelho");
  });

  it("a próxima faixa e quantos dias faltam; no topo, nada", () => {
    expect(proximaFaixa(3)?.id).toBe("vermelho");
    expect(diasParaProximaFaixa(3)).toBe(4);
    expect(diasParaProximaFaixa(6)).toBe(1);
    expect(diasParaProximaFaixa(0)).toBe(7);
    expect(fraseDaProximaFaixa(3)).toBe("faltam 4 dias pro fogo vermelho");
    expect(fraseDaProximaFaixa(13)).toBe("amanhã o fogo fica roxo");
    expect(fraseDaProximaFaixa(45)).toBe("faltam 55 dias pro fogo dourado");
    expect(proximaFaixa(100)).toBeNull();
    expect(diasParaProximaFaixa(150)).toBeNull();
    expect(fraseDaProximaFaixa(100)).toBeNull();
  });

  it("subiu de faixa = festa; desceu (perdeu a sequência) = quieto; 1ª vez = só grava", () => {
    expect(mudancaDeFaixa(1, 0)).toBe("subiu");
    expect(mudancaDeFaixa(0, 2)).toBe("desceu");
    expect(mudancaDeFaixa(2, 2)).toBe("igual");
    expect(mudancaDeFaixa(3, null)).toBe("igual");
    expect(lerFaixaVista(2)).toBe(2);
    expect(lerFaixaVista(9)).toBeNull();
    expect(lerFaixaVista("2")).toBeNull();
    expect(lerFaixaVista(undefined)).toBeNull();
  });
});

describe("capas que o tempo libera", () => {
  it("Bordô com 14 dias e Noite com 30 — pelo RECORDE; as outras sempre", () => {
    expect(REQUISITO_DA_CAPA).toEqual({ bordo: 14, noite: 30 });
    expect(capaLiberada("grafite", 0)).toBe(true);
    expect(capaLiberada("vichy", 0)).toBe(true);
    expect(capaLiberada("bordo", 13)).toBe(false);
    expect(capaLiberada("bordo", 14)).toBe(true);
    expect(capaLiberada("noite", 29)).toBe(false);
    expect(capaLiberada("noite", 30)).toBe(true);
    expect(faltamPraCapa("bordo", 5)).toBe(9);
    expect(faltamPraCapa("bordo", 20)).toBe(0);
    expect(faltamPraCapa("noite", NaN)).toBe(30);
  });

  it("as liberadas, as novas (ainda sem festa) e a frase do cadeado", () => {
    expect(capasLiberadas(10)).toEqual([]);
    expect(capasLiberadas(14)).toEqual(["bordo"]);
    expect(capasLiberadas(40)).toEqual(["bordo", "noite"]);
    expect(capasNovas(40, [])).toEqual(["bordo", "noite"]);
    expect(capasNovas(40, ["bordo"])).toEqual(["noite"]);
    expect(capasNovas(40, ["bordo", "noite"])).toEqual([]);
    expect(requisitoEmTexto("bordo")).toBe("libera com 14 dias seguidos");
    expect(fraseDaCapaTravada("Bordô", "bordo", 5)).toBe("Bordô: libera com 14 dias seguidos — faltam 9 dias.");
    expect(fraseDaCapaTravada("Bordô", "bordo", 13)).toBe("Bordô: libera com 14 dias seguidos — falta 1 dia.");
    expect(lerCapasVistas(["bordo", 3, null])).toEqual(["bordo"]);
    expect(lerCapasVistas("x")).toBeNull();
  });
});
