/**
 * OS CARDS DE COMPARTILHAR (29/09) — o que não pode quebrar:
 *  1. PLURAL certo ("1 mês", "2 meses") — o card antigo dizia "1 MESES NO AZUL";
 *  2. NADA de R$ sem a pessoa escolher ("mostrar valores");
 *  3. cada card no TAMANHO certo (1080×1920 · 1080×1350 · 1080×1080);
 *  4. o PERÍODO dito (o card antigo punha "Setembro foi de academia." num total de 7 meses);
 *  5. o texto branco passa no AA em todos os fundos.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CardDeCompartilhar, coresDoLeque, fonteDoTituloDaCapa, posicoesDoLeque } from "@/components/compartilhar/cards";
import { FORMATOS, type DadosCard, type Formato } from "@/components/compartilhar/tipos";
import { TEMAS, contraste, temaDaCor } from "@/components/compartilhar/temas";
import { desdeMes, noMes, palavra, plural, porcento, primeiroNome, reais, UNIDADES } from "@/components/compartilhar/textos";
import { diasMarcadosNoMes, faixaDeSemanas, maiorCorrida, semanasDoMes } from "@/components/compartilhar/calendario";
import { partesDoNumero, temposDoCard, textoContando } from "@/components/compartilhar/video-card";
import { legendaDoCard } from "@/components/compartilhar/legenda";
import { AGUA, AZUL_1, AZUL_3, FIGURINHA_LENDARIA, HABITOS, INSIGNIA_OURO, LIVROS_MES, METAS, POUPANCA, SEQUENCIA, SONO, TREINOS_MES, TREINOS_TOTAL } from "@/pages/dev/compartilhar-exemplos";

afterEach(cleanup);

const TODOS: DadosCard[] = [TREINOS_MES, TREINOS_TOTAL, AZUL_1, AZUL_3, POUPANCA, LIVROS_MES, SEQUENCIA, AGUA, SONO, HABITOS, METAS, INSIGNIA_OURO, FIGURINHA_LENDARIA,
  { tipo: "numero", modulo: "Estudos", cor: "#4338ca", numero: "12", rotulo: "sessões de estudo", sub: "em setembro", periodo: "SETEMBRO 2026" }];
const FORMATOS_TODOS: Formato[] = ["stories", "feed", "adesivo"];

const textoDo = (d: DadosCard, f: Formato) => {
  const { container } = render(<CardDeCompartilhar dados={d} formato={f} />);
  const t = (container.textContent ?? "").replace(/\s+/g, " ");
  cleanup();
  return t;
};

describe("textos: plural, período e dinheiro", () => {
  it("plural: só exatamente 1 é singular", () => {
    expect(plural(1, UNIDADES.mes)).toBe("1 mês");
    expect(plural(2, UNIDADES.mes)).toBe("2 meses");
    expect(plural(0, UNIDADES.treino)).toBe("0 treinos");
    expect(plural(1, UNIDADES.mesNoAzul)).toBe("1 mês no azul");
    expect(plural(3, UNIDADES.mesNoAzul)).toBe("3 meses no azul");
    expect(plural(1.5, UNIDADES.noite, 1)).toBe("1,5 noites");
    expect(plural(1234, UNIDADES.pagina)).toBe("1.234 páginas");
    expect(palavra(1, UNIDADES.livro)).toBe("livro");
    expect(palavra(7, UNIDADES.livro)).toBe("livros");
  });

  it("período explícito", () => {
    expect(noMes(8, 2026)).toBe("em setembro");
    expect(noMes(11, 2025, 2026)).toBe("em dezembro de 2025");
    expect(desdeMes(2, 2026)).toBe("desde março");
  });

  it("R$ só com 'mostrar valores' ligado", () => {
    expect(reais(612, false)).toBeNull();
    expect(reais(undefined, true)).toBeNull();
    expect(reais(1240.6, true)).toBe("R$ 1.241");
    expect(porcento(17.6)).toBe("18%");
    expect(primeiroNome("João Victor Silva")).toBe("João");
  });
});

describe("calendário", () => {
  it("setembro de 2026 começa numa terça (semana SEG→DOM) e tem 5 linhas", () => {
    const s = semanasDoMes(2026, 8);
    expect(s).toHaveLength(5);
    expect(s[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(s[4]).toEqual([28, 29, 30, null, null, null, null]);
  });
  it("dias do mês, sem repetir e sem vazar de outro mês", () => {
    expect(diasMarcadosNoMes(2026, 8, ["2026-09-03", "2026-09-01", "2026-09-03", "2026-08-31", "x"])).toEqual([1, 3]);
    expect(maiorCorrida([1, 3, 4, 5, 9, 10])).toBe(3);
    expect(maiorCorrida([])).toBe(0);
  });
  it("a faixa de semanas vai do 1º dia até hoje e marca onde cada mês começa", () => {
    const { semanas, meses } = faixaDeSemanas("2026-08-26", "2026-09-10");
    expect(semanas.flat().filter(Boolean)).toHaveLength(16);
    expect(meses.map((m) => m.mesIdx)).toEqual([7, 8]);
  });
});

describe("os cards", () => {
  it("cada card, em cada formato, tem o tamanho certo", () => {
    for (const d of TODOS) {
      for (const f of FORMATOS_TODOS) {
        const { container } = render(<CardDeCompartilhar dados={d} formato={f} />);
        const raiz = container.querySelector<HTMLElement>("[data-cartao-share]")!;
        expect(raiz, `${d.tipo}/${f}`).toBeTruthy();
        expect(raiz.style.width).toBe(`${FORMATOS[f].w}px`);
        expect(raiz.style.height).toBe(`${FORMATOS[f].h}px`);
        cleanup();
      }
    }
  });

  it("NADA de R$ sem a pessoa escolher — em nenhum card, em nenhum formato", () => {
    for (const d of TODOS) for (const f of FORMATOS_TODOS) expect(textoDo(d, f), `${d.tipo}/${f}`).not.toMatch(/R\$/);
  });

  it("com 'mostrar valores' ligado, o mês no azul e o guardei mostram o R$", () => {
    expect(textoDo({ ...AZUL_1, valoresLigados: true }, "stories")).toMatch(/R\$ 612/);
    expect(textoDo({ ...POUPANCA, valoresLigados: true }, "stories")).toMatch(/R\$ 780/);
  });

  it("o mês no azul: 1 mês é '1º mês no azul', nunca '1 meses'; 3 meses é '3 meses seguidos'", () => {
    const um = textoDo(AZUL_1, "stories");
    expect(um).toMatch(/Agosto ?fechou/);
    expect(um).toMatch(/no azul\./);
    expect(um).toMatch(/1º/);
    expect(um).not.toMatch(/1 meses/i);
    const tres = textoDo(AZUL_3, "stories");
    expect(tres).toMatch(/3 meses ?seguidos/);
    expect(tres).toMatch(/JUN.*JUL.*AGO/);
  });

  it("o card do treino diz o período: 'em setembro' no mês, 'desde março' no total", () => {
    const mes = textoDo(TREINOS_MES, "stories");
    expect(mes).toMatch(/18/);
    expect(mes).toMatch(/treinos em setembro/);
    const total = textoDo(TREINOS_TOTAL, "stories");
    expect(total).toMatch(/35/);
    expect(total).toMatch(/treinos desde março/);
    expect(total).not.toMatch(/Setembro foi de/);
  });

  it("singular de verdade nos cards (1 livro lido, 1 meta batida)", () => {
    const umLivro = textoDo({ ...LIVROS_MES, livros: LIVROS_MES.livros.slice(0, 1) }, "stories");
    expect(umLivro).toMatch(/1 ?livro lido em setembro/);
    expect(umLivro).not.toMatch(/livros lidos/);
    expect(textoDo({ ...METAS, feitas: 1, total: 1 }, "stories")).toMatch(/meta do mês batida/);
  });

  it("as metas vão TAPADAS por padrão (o texto é da pessoa); com a escolha, aparecem", () => {
    expect(textoDo(METAS, "stories")).not.toMatch(/dentista/);
    expect(textoDo({ ...METAS, mostrarTextos: true }, "stories")).toMatch(/dentista/);
  });

  it("a marca: o ícone do app e o @ nos formatos grandes; o adesivo leva só o ícone", () => {
    const t = textoDo(TREINOS_MES, "stories");
    expect(t).toMatch(/CORE/);
    expect(t).toMatch(/@coreorganizesuavida/);
    expect(textoDo(TREINOS_MES, "adesivo")).not.toMatch(/@/);
  });

  it("as camadas do vídeo não mostram o número (o vídeo conta em cima dele)", () => {
    for (const camada of ["fundo", "apagado", "aceso", "textos"] as const) {
      const { container } = render(<CardDeCompartilhar dados={TREINOS_MES} formato="stories" camada={camada} />);
      const num = container.querySelector<HTMLElement>("[data-numero]")!;
      expect(num.closest<HTMLElement>("[style*='visibility: hidden']"), camada).toBeTruthy();
      cleanup();
    }
  });

  it("a insígnia usa a moeda de verdade quando ela chega (o encaixe com a frente das insígnias)", () => {
    const { container } = render(<CardDeCompartilhar dados={INSIGNIA_OURO} formato="stories" moeda={<svg data-testid="moeda-real" />} />);
    expect(container.querySelector("[data-testid='moeda-real']")).toBeTruthy();
    expect(container.querySelector("[data-vaga-moeda]")).toBeNull();
  });
});

describe("a legenda da miniatura (a folha de postar)", () => {
  it("diz o número e o período, com o plural certo — e nunca R$", () => {
    expect(legendaDoCard(TREINOS_MES)).toBe("18 treinos em setembro.");
    expect(legendaDoCard(TREINOS_TOTAL)).toBe("35 treinos desde março.");
    expect(legendaDoCard(AZUL_1)).toBe("Agosto fechou no azul.");
    expect(legendaDoCard(AZUL_3)).toBe("3 meses seguidos no azul.");
    expect(legendaDoCard({ ...LIVROS_MES, livros: LIVROS_MES.livros.slice(0, 1) })).toBe("1 livro lido em setembro.");
    expect(legendaDoCard({ ...METAS, feitas: 1, total: 1 })).toBe("1/1 meta do mês batida.");
    for (const d of TODOS) expect(legendaDoCard({ ...d, ...("valoresLigados" in d ? { valoresLigados: false } : {}) } as DadosCard)).not.toMatch(/R\$/);
  });
});

describe("contraste (AA)", () => {
  it("texto branco passa 4,5:1 em todas as paradas dos fundos coloridos; o escuro, nos claros", () => {
    for (const [tipo, t] of Object.entries(TEMAS)) {
      for (const cor of t.paradas) {
        expect(contraste(t.tinta.startsWith("#") ? t.tinta : "#ffffff", cor), `${tipo} ${cor}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("o card geral escurece qualquer cor de área até passar", () => {
    for (const cor of ["#0891b2", "#65a30d", "#fcd34d", "#0d9488", "#c026d3"]) {
      const t = temaDaCor(cor, "X");
      for (const p of t.paradas) expect(contraste("#ffffff", p), cor).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("a contagem do vídeo", () => {
  it("separa o número do resto e conta com o milhar certo", () => {
    expect(partesDoNumero("18")).toEqual({ valor: 18, sufixo: "" });
    expect(partesDoNumero("18%")).toEqual({ valor: 18, sufixo: "%" });
    expect(partesDoNumero("4/5")).toEqual({ valor: 4, sufixo: "/5" });
    expect(partesDoNumero("1.234")).toEqual({ valor: 1234, sufixo: "" });
    expect(partesDoNumero("OURO")).toBeNull();
    expect(textoContando(1234, "")).toBe("1.234");
  });
  it("os tempos: acende em até ~2,4 s e o vídeo fica entre 5,5 e ~6 s", () => {
    const t18 = temposDoCard(18);
    expect(t18.acende[1] - t18.acende[0]).toBeLessThanOrEqual(2.75);
    expect(t18.duracao).toBeGreaterThanOrEqual(5.5);
    expect(t18.duracao).toBeLessThan(6.5);
    const t60 = temposDoCard(60);
    expect(t60.duracao).toBeLessThan(6.5);
    expect(temposDoCard(0).duracao).toBe(5.5);
  });
});

describe("as capas em leque: o texto da capa não some embaixo da vizinha", () => {
  // Geometria do leque como o CSS desenha: cada capa numa caixa de largura w,
  // puxada `sobrepoe·w` pra esquerda, descida `desce·|i−meio|` e girada no centro.
  // Mede quanto a vizinha de cima entra na capa (na altura da própria capa) e
  // confere que o recuo do texto cobre isso — com folga pequena, sem desperdiçar.
  const invadido = (n: number, w: number, passo: number, desce: number, sobrepoe: number) => {
    const h = Math.round(w * 1.5);
    const pos = posicoesDoLeque(n, w, h, passo, sobrepoe);
    const rad = (g: number) => (g * Math.PI) / 180;
    const centro = (i: number) => ({ x: i * (w - w * sobrepoe) + w / 2, y: h / 2 + pos[i].desce * desce });
    return pos.map((p, i) => {
      if (!p.tapado) return { p, entra: 0 };
      const v = p.tapado.lado === "esquerda" ? i - 1 : i + 1;
      const cv = centro(v), ci = centro(i), gv = rad(pos[v].giro), gi = rad(p.giro);
      const bordaU = p.tapado.lado === "esquerda" ? w / 2 : -w / 2; // a borda da vizinha que entra na capa
      let entra = 0;
      for (let k = 0; k <= 200; k++) {
        const t = -h / 2 + (h * k) / 200;
        const x = cv.x + bordaU * Math.cos(gv) - t * Math.sin(gv);
        const y = cv.y + bordaU * Math.sin(gv) + t * Math.cos(gv);
        const u = (x - ci.x) * Math.cos(gi) + (y - ci.y) * Math.sin(gi);
        const vv = -(x - ci.x) * Math.sin(gi) + (y - ci.y) * Math.cos(gi);
        if (Math.abs(vv) > h / 2) continue;
        entra = Math.max(entra, p.tapado.lado === "esquerda" ? u + w / 2 : w / 2 - u);
      }
      return { p, entra };
    });
  };

  for (const [nome, w, passo, desce, sobrepoe] of [["stories", 300, 5, 18, 0.08], ["stories 4+", 230, 5, 18, 0.08], ["feed", 190, 5, 18, 0.08], ["adesivo", 130, 4, 6, 0.12]] as const) {
    it(`${nome}: de 1 a 5 capas, o recuo cobre o que a vizinha tapa`, () => {
      for (let n = 1; n <= 5; n++) {
        const medidas = invadido(n, w, passo, desce, sobrepoe);
        expect(medidas.filter((m) => m.p.tapado).length, `${n} capas`).toBe(n - 1); // só a de cima fica inteira
        for (const { p, entra } of medidas) {
          if (!p.tapado) continue;
          expect(p.tapado.px, `${n} capas`).toBeGreaterThanOrEqual(entra);
          expect(p.tapado.px - entra, `${n} capas`).toBeLessThanOrEqual(14);
        }
      }
    });
  }

  it("o 'Itamar' do Torto arado: a capa da direita recua o texto da esquerda, a do meio não", () => {
    const { container } = render(<CardDeCompartilhar dados={LIVROS_MES} formato="stories" />);
    const textos = [...container.querySelectorAll<HTMLElement>("[data-capa-texto]")];
    expect(textos).toHaveLength(3);
    const esquerda = (el: HTMLElement) => parseFloat(el.style.padding.split(" ")[3]);
    const direita = (el: HTMLElement) => parseFloat(el.style.padding.split(" ")[1]);
    expect(esquerda(textos[2])).toBeGreaterThan(esquerda(textos[1]) + 40);
    expect(direita(textos[0])).toBeGreaterThan(direita(textos[1]) + 40);
    expect(esquerda(textos[1])).toBe(direita(textos[1]));
    expect(container.textContent).toContain("Itamar Vieira Junior");
  });

  it("título com palavra longa diminui até caber na largura livre", () => {
    expect(fonteDoTituloDaCapa("Torto arado", 300, 240)).toBe(48);
    const f = fonteDoTituloDaCapa("Essencialismo", 300, 190);
    expect(f).toBeLessThan(48);
    expect(f * 13 * 0.44).toBeLessThanOrEqual(190 + 1e-9);
  });

  it("capas do leque em cores diferentes (até 6), e vizinhas nunca iguais", () => {
    const cinco = coresDoLeque(["Essencialismo", "A psicologia financeira", "Pai rico, pai pobre", "O poder do hábito", "Mindset"]);
    expect(new Set(cinco).size).toBe(5);
    expect(new Set(coresDoLeque(["Tudo é rio", "Hábitos atômicos", "Torto arado"])).size).toBe(3);
    const oito = coresDoLeque(["a", "b", "c", "d", "e", "f", "g", "h"]);
    for (let i = 1; i < oito.length; i++) expect(oito[i]).not.toBe(oito[i - 1]);
  });

  it("capas vizinhas nunca da mesma cor (e cada livro mantém a cor dele quando pode)", () => {
    const titulos = ["Essencialismo", "A psicologia financeira", "Pai rico, pai pobre", "O poder do hábito", "Mindset", "Tudo é rio", "Hábitos atômicos", "Torto arado"];
    for (let a = 0; a < titulos.length; a++) for (let b = 0; b < titulos.length; b++) {
      const cores = coresDoLeque([titulos[a], titulos[b], titulos[a], titulos[a], titulos[b]]);
      for (let i = 1; i < cores.length; i++) expect(cores[i], `${titulos[a]} × ${titulos[b]}`).not.toBe(cores[i - 1]);
    }
    const sozinho = coresDoLeque(["Torto arado"]);
    expect(coresDoLeque(["Tudo é rio", "Torto arado"])[1] === sozinho[0] || coresDoLeque(["Tudo é rio"])[0] === sozinho[0]).toBe(true);
  });
});

vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));
