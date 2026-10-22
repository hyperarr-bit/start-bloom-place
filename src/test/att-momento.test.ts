/**
 * `att_momento` — a chave remota de QUANDO o ATT é pedido (1.0.18, lib/att-momento). O que este arquivo trava:
 *   · leitura da metadata: a `current` vence; ausente/estranha = "auto3s" (o de hoje);
 *   · RevenueCat sem resposta (nunca, ou nesta abertura) = "auto3s"; a última resposta fica no aparelho;
 *   · "ab": sorteio 50/50 pelo id do aparelho, gravado em `core-att-braco` e ESTÁVEL (mesmo id = mesmo braço, em
 *     outra abertura e com a RevenueCat calada); ids diferentes caem dos dois lados; o sal é próprio (não é o lado
 *     do braço do dia 1);
 *   · as chaves novas são do aparelho (sobrevivem à vassoura do logout).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  CHAVE_ATT_MOMENTO_APARELHO, CHAVE_BRACO_ATT, CHAVE_REMOTA_ATT_MOMENTO, _zerarAttMomentoRemoto, bracoATT, camposDoATT, lerAttMomentoRemoto, modoAttMomento, registrarAttMomentoRemoto,
} from "@/lib/att-momento";
import { CHAVE_BRACO_DIA1, CHAVE_ID_LOCAL, sortearBraco } from "@/lib/dia1-cheio";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";

const offerings = (current: string | undefined, outras: Record<string, string | undefined> = {}) => {
  const all: Record<string, { identifier: string; metadata: Record<string, unknown> }> = {};
  for (const [id, v] of Object.entries(outras)) all[id] = { identifier: id, metadata: v === undefined ? {} : { [CHAVE_REMOTA_ATT_MOMENTO]: v } };
  const cur = { identifier: "current", metadata: current === undefined ? {} : { [CHAVE_REMOTA_ATT_MOMENTO]: current } };
  all.current = cur;
  return { current: cur, all };
};

beforeEach(() => { localStorage.clear(); _zerarAttMomentoRemoto(); });

describe("leitura da metadata", () => {
  it("a current vence; ausente em todas / valor estranho = auto3s; maiúsculas e espaços não atrapalham", () => {
    expect(lerAttMomentoRemoto(offerings("comecar"))).toBe("comecar");
    expect(lerAttMomentoRemoto(offerings(" AB "))).toBe("ab");
    expect(lerAttMomentoRemoto(offerings(undefined, { anual_69: "comecar" }))).toBe("comecar");
    expect(lerAttMomentoRemoto(offerings("auto3s", { anual_69: "comecar" }))).toBe("auto3s");
    expect(lerAttMomentoRemoto(offerings(undefined))).toBe("auto3s");
    expect(lerAttMomentoRemoto(offerings("amanha"))).toBe("auto3s");
    expect(lerAttMomentoRemoto(null)).toBe("auto3s");
  });

  it("RevenueCat sem resposta = auto3s; respondeu = vale e fica no aparelho; na abertura seguinte (calada) vale a cópia", () => {
    expect(modoAttMomento()).toBe("auto3s");
    expect(bracoATT()).toBe("auto3s");
    registrarAttMomentoRemoto(null); // "respondeu" nada
    expect(modoAttMomento()).toBe("auto3s");
    registrarAttMomentoRemoto(offerings("comecar"));
    expect(modoAttMomento()).toBe("comecar");
    expect(bracoATT()).toBe("comecar");
    expect(localStorage.getItem(CHAVE_ATT_MOMENTO_APARELHO)).toBe("comecar");
    _zerarAttMomentoRemoto(); // nova abertura, getOfferings ainda não respondeu
    expect(modoAttMomento()).toBe("comecar");
    registrarAttMomentoRemoto(offerings(undefined)); // a metadata saiu do ar: volta ao de hoje
    expect(modoAttMomento()).toBe("auto3s");
    expect(localStorage.getItem(CHAVE_ATT_MOMENTO_APARELHO)).toBe("auto3s");
  });
});

describe("modo ab: sorteio 50/50 por aparelho, gravado e estável", () => {
  it("o 1º bracoATT sorteia pelo id e grava; as chamadas seguintes (e a próxima abertura, com a RevenueCat calada) devolvem o mesmo", () => {
    localStorage.setItem(CHAVE_ID_LOCAL, "aparelho-teste-1");
    registrarAttMomentoRemoto(offerings("ab"));
    const b = bracoATT();
    expect(["auto3s", "comecar"]).toContain(b);
    expect(localStorage.getItem(CHAVE_BRACO_ATT)).toBe(b);
    for (let i = 0; i < 5; i++) expect(bracoATT()).toBe(b);
    _zerarAttMomentoRemoto();
    expect(bracoATT()).toBe(b);
    expect(camposDoATT()).toEqual({ att_braco: b, att_momento: "ab" });
    // o braço gravado manda, mesmo que o sorteio pelo id desse o outro lado (id trocado)
    localStorage.setItem(CHAVE_ID_LOCAL, "outro-id");
    expect(bracoATT()).toBe(b);
  });

  it("ids diferentes caem dos dois lados (perto de 50/50) e o lado NÃO é o do braço do dia 1", () => {
    const lados = { auto3s: 0, comecar: 0 };
    let iguaisAoDia1 = 0;
    for (let i = 0; i < 400; i++) {
      localStorage.clear(); _zerarAttMomentoRemoto();
      localStorage.setItem(CHAVE_ID_LOCAL, `id-${i}-x`);
      registrarAttMomentoRemoto(offerings("ab"));
      const b = bracoATT();
      lados[b] += 1;
      if ((sortearBraco(`id-${i}-x`) === "A") === (b === "auto3s")) iguaisAoDia1 += 1;
    }
    expect(lados.auto3s).toBeGreaterThan(140);
    expect(lados.comecar).toBeGreaterThan(140);
    // independente do sorteio do dia 1 (a paridade do FNV com um sal só INVERTE o lado: seria sempre o oposto)
    expect(iguaisAoDia1).toBeGreaterThan(140);
    expect(iguaisAoDia1).toBeLessThan(260);
  });

  it("modos fixos ignoram o braço gravado: 'comecar' e 'auto3s' valem pra todo mundo", () => {
    localStorage.setItem(CHAVE_BRACO_ATT, "comecar");
    registrarAttMomentoRemoto(offerings("auto3s"));
    expect(bracoATT()).toBe("auto3s");
    registrarAttMomentoRemoto(offerings("comecar"));
    expect(bracoATT()).toBe("comecar");
  });
});

describe("chaves do aparelho", () => {
  it("core-att-momento e core-att-braco são do aparelho (a vassoura do logout não leva), como core-dia1-braco", () => {
    for (const k of [CHAVE_ATT_MOMENTO_APARELHO, CHAVE_BRACO_ATT, CHAVE_BRACO_DIA1]) {
      expect(ehChaveDoAparelho(k), k).toBe(true);
      expect(vassouraLeva(k), k).toBe(false);
    }
  });
});
