/**
 * O QUE SÓ A RETROSPECTIVA EM TELA CHEIA TEM (02/11, rodada 2 — src/components/compartilhar/retro-tela-cheia-dados.ts):
 * o perfil "Seu outubro foi…", os extras de quem usou pouco, o "adivinha", o suspense do vídeo e o card mais
 * comprido só na tela (a imagem/vídeo de postar continuam 1080×1920).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AlturaExtraCtx, CardDeCompartilhar } from "@/components/compartilhar/cards";
import { montarRetroOutubro } from "@/components/compartilhar/retro-outubro-dados";
import { adivinhaDaRetro, comExtrasDaTelaCheia, extrasDoPoucoUso, MAX_MEIO_POUCO, montarRetroTelaCheia, opcoesDoAdivinha, perfilDoOutubro } from "@/components/compartilhar/retro-tela-cheia-dados";
import { comSuspense, roteiroQueAcende, temposDoCard, type CamadasDoCard } from "@/components/compartilhar/video-card";
import type { DadosRetroExtra, DadosRetroPerfil } from "@/components/compartilhar/tipos";
import { AGORA_EXEMPLO, SEMENTE_COMPLETA, SEMENTE_POUCO_1, SEMENTE_POUCO_3, leitorDe } from "@/pages/dev/retro-outubro-exemplo";

const NOV = AGORA_EXEMPLO;
const out = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
afterEach(cleanup);

describe("1. o perfil", () => {
  it("conta completa: sai do módulo mais usado (treino 18 dias → 'Modo atleta'), com a frase de verdade e 2 'também'; entra antes do resumo", () => {
    const r = montarRetroTelaCheia(leitorDe(SEMENTE_COMPLETA), { agora: NOV })!;
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "financas", "treino", "rotina", "agua", "leitura", "metas", "perfil", "resumo"]);
    const p = r.cards.find((c) => c.id === "perfil")!.dados as DadosRetroPerfil;
    expect(p).toMatchObject({ tipo: "retro-perfil", modulo: "treino", nome: "Modo atleta", frase: "18 dias de treino em outubro." });
    // os "também" são os itens do resumo (os mesmos números dos cards), nunca o próprio módulo
    const resumo = r.cards.at(-1)!.dados;
    if (resumo.tipo !== "retro-resumo") throw new Error("sem resumo");
    expect(p.tambem).toHaveLength(2);
    for (const t of p.tambem) expect(resumo.itens).toContainEqual(t);
    expect(p.tambem.map((t) => t.modulo)).not.toContain("treino");
  });

  it("os nomes seguem o número (nunca negativo): leitura forte → 'Devorando livros'; rotina quase todo dia → 'Constância de ferro'", () => {
    const so = (s: Record<string, unknown>) => perfilDoOutubro(montarRetroOutubro(leitorDe({ ...s, "rotina-habit-log": SEMENTE_COMPLETA["rotina-habit-log"] }), { agora: NOV })!)!;
    const livros = { "lib-books": SEMENTE_COMPLETA["lib-books"] };
    expect(so(livros)).toMatchObject({ modulo: "leitura", nome: "Devorando livros", frase: "Terminou 4 livros em outubro." });
    const rotina = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [out(i + 1), ["Meditar"]]));
    const p = perfilDoOutubro(montarRetroOutubro(leitorDe({ "rotina-habit-log": rotina }), { agora: NOV })!)!;
    expect(p).toMatchObject({ modulo: "rotina", nome: "Constância de ferro", frase: "Meditar em 30 dos 31 dias de outubro." });
  });

  it("pouco uso não ganha perfil; a tela clássica (montarRetroOutubro) continua sem o perfil", () => {
    const pouco = montarRetroOutubro(leitorDe(SEMENTE_POUCO_3), { agora: NOV })!;
    expect(perfilDoOutubro(pouco)).toBeNull();
    expect(montarRetroOutubro(leitorDe(SEMENTE_COMPLETA), { agora: NOV })!.cards.map((c) => c.id)).not.toContain("perfil");
  });

  it("o card do perfil desenha o nome e a frase", () => {
    const r = montarRetroTelaCheia(leitorDe(SEMENTE_COMPLETA), { agora: NOV })!;
    const { container, getByText } = render(<CardDeCompartilhar dados={r.cards.find((c) => c.id === "perfil")!.dados} formato="stories" />);
    expect(getByText("Seu outubro foi…")).toBeTruthy();
    expect(container.querySelector("[data-perfil-nome]")!.textContent).toBe("Modoatleta");
    expect(getByText("18 dias de treino em outubro.")).toBeTruthy();
  });
});

describe("2. os extras de quem usou pouco (só com dado de verdade)", () => {
  const POUCO = {
    "finance-expenses": [{ id: "g1", date: out(12), value: 40 }, { id: "g2", date: out(19), value: 90 }],
    "saude-workout-log": [out(14), out(21)],
    "core-dias-anotados": [out(12), out(14), out(19), out(21), out(26), "2026-11-01", "2026-09-30"],
    "conquistas-desbloqueadas": { "sequencia-1": out(12), "sequencia-2": out(13), "velha": "2026-09-02" },
  };
  it("1º registro (com o módulo dele), os dias com registro (o app + a retrospectiva, só de outubro) e as figurinhas do mês", () => {
    const r = montarRetroTelaCheia(leitorDe(POUCO), { agora: NOV })!;
    expect(r.poucoDado).toBe(true);
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "primeiro", "financas", "treino", "dias", "figurinhas", "fechamento"]);
    const pega = (id: string) => r.cards.find((c) => c.id === id)!.dados as DadosRetroExtra;
    expect(pega("primeiro")).toMatchObject({ extra: "primeiro", numero: "1º", modulo: "financas", sub: "foi em Finanças", dias: [out(12)] });
    expect(pega("dias")).toMatchObject({ numero: "5", rotulo: "dias com registro", dias: [out(12), out(14), out(19), out(21), out(26)] });
    expect(pega("figurinhas")).toMatchObject({ numero: "2", rotulo: "figurinhas novas no álbum", dias: [out(12), out(13)] });
    // o fechamento diz o mesmo número de dias
    const fim = r.cards.at(-1)!.dados;
    expect(fim.tipo === "retro-fechamento" && fim.diasComRegistro).toBe(5);
  });

  it("um dia só: nenhum extra repetindo o card do módulo (nada de '1º registro' = o único registro)", () => {
    const r = montarRetroTelaCheia(leitorDe(SEMENTE_POUCO_1), { agora: NOV })!;
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "treino", "fechamento"]);
  });

  it("nunca '0': sem figurinha no mês, sem card de figurinha; no máximo MAX_MEIO_POUCO no meio", () => {
    const r = montarRetroOutubro(leitorDe({ ...POUCO, "conquistas-desbloqueadas": { velha: "2026-09-02" } }), { agora: NOV })!;
    const { antes, depois } = extrasDoPoucoUso(r, leitorDe({ ...POUCO, "conquistas-desbloqueadas": {} }));
    expect([...antes, ...depois].map((c) => c.id)).toEqual(["primeiro", "dias"]);
    const cheio = comExtrasDaTelaCheia(montarRetroOutubro(leitorDe(SEMENTE_POUCO_3), { agora: NOV })!, leitorDe(POUCO));
    expect(cheio.cards.length - 2).toBeLessThanOrEqual(MAX_MEIO_POUCO);
  });

  it("os cards extras desenham sem quebrar (os 3 tipos)", () => {
    const r = montarRetroTelaCheia(leitorDe(POUCO), { agora: NOV })!;
    for (const id of ["primeiro", "dias", "figurinhas"]) {
      const { container } = render(<CardDeCompartilhar dados={r.cards.find((c) => c.id === id)!.dados} formato="stories" />);
      expect(container.querySelector("[data-cartao-share='retro-extra']")).toBeTruthy();
      cleanup();
    }
  });
});

describe("3. o adivinha", () => {
  it("as 3 opções: crescentes, distintas, dentro do mês, com a certa numa posição que varia com o número", () => {
    for (let n = 4; n <= 31; n++) {
      const o = opcoesDoAdivinha(n, 31);
      expect(o).toHaveLength(3);
      expect(o).toContain(n);
      expect([...o].sort((a, b) => a - b)).toEqual(o);
      expect(new Set(o).size).toBe(3);
      for (const v of o) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(31); }
    }
    expect(opcoesDoAdivinha(19, 31)).toEqual([14, 19, 24]);
    expect(opcoesDoAdivinha(18, 31)).toEqual([18, 23, 28]);
    expect(opcoesDoAdivinha(2, 6, 1)).toEqual([2, 3, 4]);
  });

  it("a ordem: treino (≥4 dias) primeiro; sem treino, a rotina; número pequeno não vira pergunta", () => {
    const completa = montarRetroOutubro(leitorDe(SEMENTE_COMPLETA), { agora: NOV })!;
    expect(adivinhaDaRetro(completa.cards)).toMatchObject({ antesDe: "treino", modulo: "treino", certo: 18, pergunta: "Quantos dias você acha que treinou em outubro?" });
    const semTreino = montarRetroOutubro(leitorDe({ ...SEMENTE_COMPLETA, "saude-workout-log": [] }), { agora: NOV })!;
    expect(adivinhaDaRetro(semTreino.cards)).toMatchObject({ antesDe: "rotina", certo: 24, pergunta: "Em quantos dias de outubro você acha que fez “meditar”?" });
    expect(adivinhaDaRetro(montarRetroOutubro(leitorDe(SEMENTE_POUCO_1), { agora: NOV })!.cards)).toBeNull();
  });
});

describe("3b. o final calmo (03/11, dono: 'na última parece um pancadão… uma pancada de luz')", () => {
  /** Um contexto de canvas de mentira: conta os clarões (gradiente radial) e guarda o maior "pop" (escala > 1). */
  const ctxFalso = () => {
    const reg = { claroes: 0, maiorEscala: 1 };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => {
        if (k === "createRadialGradient") return () => { reg.claroes++; return { addColorStop: () => {} }; };
        if (k === "createLinearGradient") return () => ({ addColorStop: () => {} });
        if (k === "scale") return (x: number) => { reg.maiorEscala = Math.max(reg.maiorEscala, x); };
        if (k === "measureText") return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, reg };
  };
  const tela = { width: 1080, height: 1920 } as HTMLCanvasElement;
  // o resumo: 6 blocos grandes (446×220), sem número
  const resumo: CamadasDoCard = {
    fundo: tela, apagado: tela, aceso: tela, textos: tela,
    medidas: { largura: 1080, altura: 1920, numero: null, blocos: { titulo: { x: 84, y: 250, w: 912, h: 240 } },
      celulas: Array.from({ length: 6 }, (_, i) => ({ x: 84 + (i % 2) * 466, y: 540 + Math.floor(i / 2) * 240, w: 446, h: 220, feito: true })) },
  };
  const rodar = (calmo: boolean) => {
    const r = roteiroQueAcende(resumo, 1080, 1920, 0.7, calmo);
    const { ctx, reg } = ctxFalso();
    for (let t = 0; t <= r.duracao; t += 1 / 30) r.desenhar(ctx, t, 1);
    return { r, reg };
  };

  it("na tela cheia (calmo): os blocos grandes entram SEM clarão e sem passar do tamanho; postar (sem calmo) continua igual", () => {
    const calmo = rodar(true);
    expect(calmo.reg.claroes).toBe(0);
    expect(calmo.reg.maiorEscala).toBeLessThanOrEqual(1);
    const antes = rodar(false);
    expect(antes.reg.claroes).toBeGreaterThan(0);
    expect(antes.reg.maiorEscala).toBeGreaterThan(1);
  });

  it("calmo: cascata curta (~80 ms entre os blocos) e cada bloco leva ~0,55 s; os tempos de postar não mudam", () => {
    const T = temposDoCard(6, { passoMax: 0.08, pop: 0.55 });
    expect((T.acende[1] - 0.55 - T.acende[0]) / 5).toBeCloseTo(0.08, 5);
    expect(temposDoCard(6)).toEqual({ ...temposDoCard(6, {}), pop: 0.3 });
    expect(temposDoCard(6).acende[1]).toBeCloseTo(0.75 + 0.16 * 5 + 0.3, 5);
  });
});

describe("4. o suspense e o card mais comprido (só na tela cheia)", () => {
  it("o suspense empurra a prova e o número, não a frase; sem suspense (postar) os tempos ficam iguais", () => {
    const T = temposDoCard(18);
    expect(comSuspense(T, 0)).toBe(T);
    const S = comSuspense(T, 0.7);
    expect(S.rotulo).toEqual([0.1, 0.55]);
    expect(S.acende[0]).toBeCloseTo(T.acende[0] + 0.7, 5);
    expect(S.duracao).toBeCloseTo(T.duracao + 0.7, 5);
    expect(S.acende[0]).toBeGreaterThan(S.rotulo[1]);
  });

  it("sem AlturaExtraCtx o card é 1080×1920 (a imagem de postar); com extra, só a tela fica mais comprida e a assinatura desce", () => {
    const r = montarRetroOutubro(leitorDe(SEMENTE_COMPLETA), { agora: NOV })!;
    const treino = r.cards.find((c) => c.id === "treino")!.dados;
    const a = render(<CardDeCompartilhar dados={treino} formato="stories" />);
    const cartao = a.container.querySelector<HTMLElement>("[data-cartao-share]")!;
    expect(cartao.style.height).toBe("1920px");
    const ass = a.container.querySelector<HTMLElement>("[data-bloco='assinatura']")!.style.top;
    cleanup();
    const b = render(<AlturaExtraCtx.Provider value={300}><CardDeCompartilhar dados={treino} formato="stories" /></AlturaExtraCtx.Provider>);
    expect(b.container.querySelector<HTMLElement>("[data-cartao-share]")!.style.height).toBe("2220px");
    expect(parseFloat(b.container.querySelector<HTMLElement>("[data-bloco='assinatura']")!.style.top)).toBe(parseFloat(ass) + 300);
  });
});
