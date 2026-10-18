import { describe, it, expect, beforeEach } from "vitest";
import { CHAVES, TABELA, type Chave } from "@/pages/raiox/conteudo";
import { arredondarDezena, diasDaAncora, estimar, faixaDeValor } from "@/pages/raiox/estimativa";
import { demoTemVideo } from "@/pages/raiox/Demo";
import { _zerarEstadoRaiox, hash32, resolverDemo } from "@/pages/raiox/estado";

const faixa = (n: number): Partial<Record<Chave, number>> => Object.fromEntries(CHAVES.map((c) => [c, n]));

describe("estimativa", () => {
  it("cada faixa da tabela entra no mês daquela chave", () => {
    for (const chave of CHAVES) {
      for (const i of [0, 1, 2, 3] as const) {
        const r = estimar({ [chave]: i });
        const esperado = TABELA[chave][i];
        if (esperado >= 30) expect(r.vazamentos.find((v) => v.chave === chave)?.mes).toBe(esperado);
        else expect(r.vazamentos.find((v) => v.chave === chave)).toBeUndefined();
      }
    }
  });

  it("soma só quem passa de R$ 30, no máximo 4, os maiores primeiro", () => {
    const r = estimar(faixa(3));
    expect(r.vazamentos).toHaveLength(4);
    expect(r.vazamentos.map((v) => v.mes)).toEqual([1160, 660, 650, 420]);
    expect(r.vazamentos.some((v) => v.chave === "assinaturas")).toBe(false);
    expect(r.vazou_mes).toBe(1160 + 660 + 650 + 420);
    expect(r.vazou_ano).toBe(r.vazou_mes * 12);
    for (const v of r.vazamentos) expect(v.ano).toBe(v.mes * 12);
  });

  it("arredonda a projeção pra dezena", () => {
    expect(arredondarDezena(125)).toBe(130);
    expect(arredondarDezena(124)).toBe(120);
    const r = estimar({ delivery: 1, assinaturas: 1, transporte_app: 0, compras_online: 1, formiga: 1 });
    expect(r.vazou_mes).toBe(290 + 75 + 90 + 130);
    expect(r.projecao).toBe(arredondarDezena(r.vazou_ano * 0.5));
    expect(r.projecao % 10).toBe(0);
  });

  it("tudo no primeiro degrau é o caso extremo, e a soma abaixo de 60 também", () => {
    const r = estimar(faixa(0));
    expect(r.extremo).toBe(true);
    expect(r.vazou_mes).toBe(30);
    expect(r.vazamentos.map((v) => v.chave)).toEqual(["delivery"]);
    const baixo = estimar({ delivery: 0 });
    expect(baixo.vazou_mes).toBe(30);
    expect(baixo.extremo).toBe(true);
  });

  it("faixa de valor não é o número", () => {
    expect(faixaDeValor(30)).toBe("ate_59");
    expect(faixaDeValor(585)).toBe("500_999");
    expect(faixaDeValor(2890)).toBe("1000_mais");
  });

  it("âncora só quando o número de dias faz sentido", () => {
    expect(diasDaAncora(290)).toBe(10);
    expect(diasDaAncora(10)).toBeNull();
    expect(diasDaAncora(30)).toBeNull();
    expect(diasDaAncora(0)).toBeNull();
  });
});

describe("variante da demo", () => {
  beforeEach(() => {
    _zerarEstadoRaiox();
    sessionStorage.clear();
  });

  it("?demo=1 e ?demo=0 ganham da chave", () => {
    expect(resolverDemo({ search: "?demo=1", flag: "off" })).toBe("com");
    expect(resolverDemo({ search: "?demo=0", flag: "on" })).toBe("sem");
  });

  it("o mesmo fbclid cai sempre na mesma variante, mesmo sem storage", () => {
    const a = resolverDemo({ search: "", fbclid: "IwAR_abc", flag: "ab" });
    _zerarEstadoRaiox();
    sessionStorage.clear();
    const b = resolverDemo({ search: "", fbclid: "IwAR_abc", flag: "ab" });
    expect(b).toBe(a);
    expect(hash32("IwAR_abc") % 2 === 0 ? "com" : "sem").toBe(a);
  });

  it("a memória segura a variante se o storage zera", () => {
    const a = resolverDemo({ search: "", flag: "ab" });
    sessionStorage.clear();
    expect(resolverDemo({ search: "", flag: "ab" })).toBe(a);
  });
});

describe("vídeo da demo", () => {
  it("ignora o HTML do rewrite e aceita mp4 até 1,5 MB", () => {
    expect(demoTemVideo("text/html", 1200)).toBe(false);
    expect(demoTemVideo(null, 0)).toBe(false);
    expect(demoTemVideo("video/mp4", 800_000)).toBe(true);
    expect(demoTemVideo("video/mp4", 1_500_001)).toBe(false);
    expect(demoTemVideo("application/octet-stream", 0)).toBe(true);
  });
});
