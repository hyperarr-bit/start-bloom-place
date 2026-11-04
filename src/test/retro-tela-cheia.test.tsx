/**
 * A RETROSPECTIVA EM TELA CHEIA (02/11, protótipo — src/components/compartilhar/RetroTelaCheia + retro-tela-cheia.ts).
 *
 * O dono: "a pessoa não vê a retrospectiva normal? fica nisso de stories e feed… tem que ser assim [tela cheia como o
 * Spotify], o principal". Aqui: o card de ponta a ponta (o fundo dele esticado sem emenda), as barrinhas passando
 * sozinhas, toque/segurar/arrastar, o compartilhar na folha de baixo (que pausa), o botão do último card, os eventos
 * (os de antes + os novos, sem e-mail/uid) e a chave que volta pra tela clássica.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  ALTURA_CONTROLES, CHAVE_FORCA_TELA_CHEIA, CONTEUDO, FOLGA_TOPO, MARGEM_LADO, PROPORCAO_COLUNA, RESERVA_BASE, RETRO_TELA_CHEIA, TEMPOS,
  encaixeDoCard, fundoClaro, fundoEsticado, guardarForcaTelaCheia, lerFundoDoCard, telaCheiaLigada, tempoDoCard, texturaEsticada, type ReservaBase,
} from "@/components/compartilhar/retro-tela-cheia";
import { SEMENTE_COMPLETA, SEMENTE_POUCO_1, AGORA_EXEMPLO, leitorDe } from "@/pages/dev/retro-outubro-exemplo";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
const eventos = vi.hoisted(() => [] as { nome: string; dados: Record<string, unknown> }[]);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown> = {}) => { eventos.push({ nome, dados }); },
  trackEventBeacon: (nome: string, dados: Record<string, unknown> = {}) => { eventos.push({ nome, dados }); },
}));
// aparelho sem vídeo: o card fica parado e o relógio dele anda na hora (sem esperar animação)
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));
const movimento = vi.hoisted(() => ({ reduzir: false }));
vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => movimento.reduzir }));

const NOV = AGORA_EXEMPLO;
const de = (nome: string) => eventos.filter((e) => e.nome === nome);

const abrir = async (semente: Record<string, unknown> = SEMENTE_COMPLETA, onClose = vi.fn()) => {
  const { RetroOutubro } = await import("@/components/compartilhar/RetroOutubro");
  const r = render(<RetroOutubro ler={leitorDe(semente)} agora={NOV} onClose={onClose} />);
  await act(async () => { await Promise.resolve(); }); // o suporteVideo responde
  return { ...r, tela: screen.getByTestId("retro-outubro"), onClose };
};
const atual = () => screen.getByTestId("retro-outubro").getAttribute("data-card-atual");
const barraTermina = () => fireEvent.animationEnd(screen.getByTestId("retro-barra-atual"));
/** O dedo (jsdom não tem PointerEvent com coordenada: monta um MouseEvent com o nome certo). */
const dedo = (alvo: Element, tipo: "pointerdown" | "pointermove" | "pointerup", x: number, y: number) => {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  fireEvent(alvo, e);
};

beforeEach(() => { nativo.v = false; movimento.reduzir = false; eventos.length = 0; });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  try { localStorage.removeItem(CHAVE_FORCA_TELA_CHEIA); } catch { /* sem storage */ }
});

describe("1. a chave", () => {
  it("protótipo: ligada no código; ?retro-tela=classica volta pra antiga neste navegador, =auto apaga; no app a força é ignorada", () => {
    expect(RETRO_TELA_CHEIA).toBe("on");
    expect(telaCheiaLigada()).toBe(true);
    guardarForcaTelaCheia("?retro-tela=classica");
    expect(telaCheiaLigada()).toBe(false);
    guardarForcaTelaCheia("?retro-tela=auto");
    expect(telaCheiaLigada()).toBe(true);
    localStorage.setItem(CHAVE_FORCA_TELA_CHEIA, "off");
    nativo.v = true;
    expect(telaCheiaLigada()).toBe(true);
  });
  it("desligada: a tela clássica de antes (botões embaixo do card, sem barrinha andando)", async () => {
    localStorage.setItem(CHAVE_FORCA_TELA_CHEIA, "off");
    const { tela } = await abrir();
    expect(tela.getAttribute("data-modo")).toBeNull();
    expect(screen.getByTestId("retro-postar")).toBeTruthy();
    expect(screen.queryByTestId("retro-barra-atual")).toBeNull();
  });
});

describe("2. onde o card fica (02/11: o conteúdo logo abaixo dos botões, o card esticado até o pé — sem faixa vazia)", () => {
  const confere = (e: ReturnType<typeof encaixeDoCard>, H: number, topo: number, base: number, reserva: ReservaBase = "nada") => {
    // o chip do card começa logo abaixo das barrinhas/botões (nunca atrás da ilha, nem lá no meio da tela)
    expect(e.y + CONTEUDO.topo * e.escala).toBeCloseTo(topo + ALTURA_CONTROLES + FOLGA_TOPO, 5);
    // o fim do conteúdo (com o extra) não passa da base nem da pílula/botões
    expect(e.y + (CONTEUDO.fim + e.extra) * e.escala).toBeLessThanOrEqual(H - base - RESERVA_BASE[reserva] + 0.01);
  };
  it("iPhone 390×844 (ilha 47, barra 34): a largura manda (margem fina dos lados), o card fica mais comprido e chega no pé", () => {
    for (const reserva of ["nada", "pilula", "final"] as const) {
      const e = encaixeDoCard({ largura: 390, altura: 844, topoSeguro: 47, baseSeguro: 34, reserva });
      expect(e.coluna).toBe(390);
      expect(e.escala).toBeCloseTo((390 - 2 * MARGEM_LADO) / CONTEUDO.largura, 5);
      expect(e.extra).toBeGreaterThan(0);
      confere(e, 844, 47, 34, reserva);
      // o que sobra embaixo é só o respiro (menos de 1 px de card de folga)
      expect(844 - 34 - RESERVA_BASE[reserva] - (e.y + (CONTEUDO.fim + e.extra) * e.escala)).toBeLessThan(1);
    }
    // sem pílula, o card é mais comprido que com pílula, e com os botões finais ainda menos
    const [a, b, c] = (["nada", "pilula", "final"] as const).map((reserva) => encaixeDoCard({ largura: 390, altura: 844, topoSeguro: 47, baseSeguro: 34, reserva }).extra);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
  it("iPhone pequeno 375×667 (com e sem a faixa do relógio): nada atrás dos botões; sem espaço, encolhe em vez de cortar", () => {
    for (const topo of [0, 20]) {
      for (const reserva of ["nada", "pilula", "final"] as const) {
        const e = encaixeDoCard({ largura: 375, altura: 667, topoSeguro: topo, baseSeguro: 0, reserva });
        expect(e.w).toBeGreaterThan(330);
        expect(e.extra).toBeGreaterThanOrEqual(0);
        confere(e, 667, topo, 0, reserva);
      }
    }
  });
  it("PC/tablet (mais largo que 9:16): uma coluna 9:16 no meio", () => {
    const e = encaixeDoCard({ largura: 1440, altura: 900, topoSeguro: 0, baseSeguro: 0 });
    expect(1440 / 900).toBeGreaterThan(PROPORCAO_COLUNA);
    expect(e.coluna).toBe(506);
    expect(e.w).toBeLessThanOrEqual(e.coluna + 2 * 84 * e.escala);
    confere(e, 900, 0, 0);
  });
});

describe("3. o fundo esticado até as bordas (sem barra preta, sem emenda)", () => {
  it("lê o degradê do card (com e sem posições) e a cor lisa do papel", () => {
    expect(lerFundoDoCard("linear-gradient(165deg, rgb(124, 58, 237), rgb(109, 40, 217), rgb(76, 29, 149))", "")).toEqual({ angulo: 165, liso: null, paradas: [{ cor: "rgb(124, 58, 237)", pos: 0 }, { cor: "rgb(109, 40, 217)", pos: 0.5 }, { cor: "rgb(76, 29, 149)", pos: 1 }] });
    expect(lerFundoDoCard("linear-gradient(172deg, #2c2b31 0%, #232228 55%, #1d1c21 100%)", "")!.paradas.map((p) => p.pos)).toEqual([0, 0.55, 1]);
    expect(lerFundoDoCard("", "rgb(245, 240, 230)")).toEqual({ angulo: 180, paradas: [], liso: "rgb(245, 240, 230)" });
    expect(lerFundoDoCard("", "")).toBeNull();
  });
  it("o degradê refeito pra tela bate com o do card dentro dele (180°: deslocado pelo topo do card)", () => {
    const f = lerFundoDoCard("linear-gradient(180deg, #000000, #ffffff)", "")!;
    expect(fundoEsticado(f, { x: 0, y: 75, w: 390, h: 693 }, { w: 390, h: 844 })).toBe("linear-gradient(180deg, #000000 75px, #ffffff 768px)");
    // inclinado: o mesmo card na mesma caixa não desloca nada
    const g = lerFundoDoCard("linear-gradient(165deg, #000000, #ffffff)", "")!;
    const css = fundoEsticado(g, { x: 0, y: 0, w: 390, h: 693 }, { w: 390, h: 693 });
    const L = Math.abs(390 * Math.sin((165 * Math.PI) / 180)) + Math.abs(693 * Math.cos((165 * Math.PI) / 180));
    expect(css).toBe(`linear-gradient(165deg, #000000 0px, #ffffff ${Math.round(L * 100) / 100}px)`);
  });
  it("a textura de pontinhos na escala da tela e alinhada com a do card", () => {
    const t = texturaEsticada("radial-gradient(circle, rgba(255,255,255,.07) 1.6px, transparent 1.9px)", "44px 44px", 0.5, { x: 0, y: 75 })!;
    expect(t.backgroundSize).toBe("22px 22px");
    expect(t.backgroundImage).toContain("0.8px");
    expect(t.backgroundPosition).toBe("0px 9px");
  });
  it("papel/creme = controles escuros; grafite/roxo = controles brancos", () => {
    expect(fundoClaro(lerFundoDoCard("", "rgb(245, 240, 230)"))).toBe(true);
    expect(fundoClaro(lerFundoDoCard("linear-gradient(180deg, #f5efe3, #f1e9da)", ""))).toBe(true);
    expect(fundoClaro(lerFundoDoCard("linear-gradient(165deg, #7c3aed, #4c1d95)", ""))).toBe(false);
  });
});

describe("4. o tempo de cada card", () => {
  it("abertura ≥ 6 s; módulo = a animação + respiro (5,5–9 s); sem animação 6 s", () => {
    expect(tempoDoCard("abertura")).toBe(6000);
    expect(tempoDoCard("treino")).toBe(TEMPOS.padrao);
    expect(tempoDoCard("treino", 5.6)).toBe(7100);
    expect(tempoDoCard("treino", 2)).toBe(TEMPOS.minimo);
    expect(tempoDoCard("treino", 20)).toBe(TEMPOS.maximo);
  });
});

describe("5. a tela cheia", () => {
  it("abre na abertura, de tela cheia, SEM os botões de postar embaixo do card (só o ícone do canto)", async () => {
    const { tela } = await abrir();
    expect(tela.getAttribute("data-modo")).toBe("tela-cheia");
    expect(atual()).toBe("abertura");
    expect(screen.queryByTestId("retro-postar")).toBeNull();
    expect(screen.queryByTestId("retro-salvar")).toBeNull();
    expect(screen.queryByTestId("retro-valores")).toBeNull();
    expect(screen.getByTestId("retro-compartilhar")).toBeTruthy();
    // 9 cards (com o perfil) + o adivinha
    expect(screen.getAllByTestId("retro-barras")[0].children.length).toBe(10);
    expect(de("wrapped_cards")[0].dados).toMatchObject({ mes: "outubro", cards: "abertura,financas,treino,rotina,agua,leitura,metas,perfil,resumo", pouco_dado: false, versao: "tela-cheia", adivinha: true });
    expect(de("wrapped_tela")[0].dados).toMatchObject({ mes: "outubro", id: "abertura", i: 0, como: "inicio", versao: "tela-cheia" });
  });

  it("passa sozinho: a barrinha termina → próximo card (wrapped_auto_avancou + wrapped_tela como 'auto')", async () => {
    const { tela } = await abrir();
    expect(tela.getAttribute("data-relogio")).toBe("andando");
    barraTermina();
    expect(atual()).toBe("financas");
    expect(de("wrapped_auto_avancou")[0].dados).toMatchObject({ mes: "outubro", de: "abertura", i: 0 });
    expect(de("wrapped_tela")[1].dados).toMatchObject({ id: "financas", como: "auto" });
  });

  it("toque à direita avança, à esquerda volta; no 1º card, à esquerda recomeça (fica nele)", async () => {
    await abrir();
    fireEvent.click(screen.getByTestId("retro-anterior"));
    expect(atual()).toBe("abertura");
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("financas");
    expect(de("wrapped_tela")[1].dados).toMatchObject({ id: "financas", como: "toque" });
    fireEvent.click(screen.getByTestId("retro-proximo"));
    fireEvent.click(screen.getByTestId("retro-anterior"));
    expect(atual()).toBe("financas");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(atual()).toBe("adivinha");
  });

  it("SEGURAR pausa (o relógio para; wrapped_pausou) e soltar continua — sem pular de card", async () => {
    vi.useFakeTimers();
    const { tela } = await abrir();
    const direita = screen.getByTestId("retro-proximo");
    dedo(direita, "pointerdown", 300, 400);
    act(() => { vi.advanceTimersByTime(TEMPOS.segurar + 30); });
    expect(tela.getAttribute("data-pausado")).toBe("sim");
    expect(tela.getAttribute("data-relogio")).toBe("parado");
    expect(de("wrapped_pausou")[0].dados).toMatchObject({ mes: "outubro", card: "abertura" });
    dedo(direita, "pointerup", 300, 400);
    fireEvent.click(direita); // o clique que o navegador manda depois de soltar não conta como toque
    expect(atual()).toBe("abertura");
    expect(tela.getAttribute("data-pausado")).toBe("nao");
    expect(tela.getAttribute("data-relogio")).toBe("andando");
  });

  it("arrastar pra baixo fecha (wrapped_fechou como 'arrastou'); arrasto curto volta pro lugar", async () => {
    const { onClose, unmount } = await abrir();
    const area = screen.getByTestId("retro-proximo");
    dedo(area, "pointerdown", 200, 300);
    dedo(area, "pointermove", 200, 340);
    dedo(area, "pointerup", 200, 340);
    expect(onClose).not.toHaveBeenCalled();
    dedo(area, "pointerdown", 200, 300);
    dedo(area, "pointermove", 200, 360);
    dedo(area, "pointermove", 200, 460);
    dedo(area, "pointerup", 200, 460);
    // (03/11) some suave antes de sair
    expect(screen.getByTestId("retro-outubro").getAttribute("data-fechando")).toBe("sim");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    unmount();
    expect(de("wrapped_fechou")[0].dados).toMatchObject({ mes: "outubro", como: "arrastou", versao: "tela-cheia", vistos: 1, total: 10, chegou_ao_fim: false });
  });

  it("o X fecha (wrapped_fechou como 'x')", async () => {
    const { onClose, unmount } = await abrir();
    fireEvent.click(screen.getByTestId("retro-fechar"));
    expect(onClose).not.toHaveBeenCalled(); // (03/11) primeiro some suave…
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1)); // …depois sai (uma vez só)
    fireEvent.click(screen.getByTestId("retro-fechar"));
    unmount();
    expect(de("wrapped_fechou")[0].dados).toMatchObject({ como: "x" });
  });

  it("o ícone de compartilhar abre a folha (pausa): Stories | Feed, Postar nos Stories, Salvar; R$ só no card de Finanças, começa desligado", async () => {
    const { tela } = await abrir();
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("financas");
    fireEvent.click(screen.getByTestId("retro-compartilhar"));
    expect(screen.getByTestId("retro-folha")).toBeTruthy();
    expect(tela.getAttribute("data-pausado")).toBe("sim");
    expect(de("wrapped_compartilhar_aberto")[0].dados).toMatchObject({ mes: "outubro", card: "financas", origem: "icone" });
    expect(screen.getByTestId("retro-postar").textContent).toMatch(/Postar nos Stories/);
    expect(screen.getByTestId("retro-salvar").textContent).toMatch(/Salvar/);
    expect(screen.getByTestId("retro-valores").getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByText("Feed"));
    expect(screen.getByTestId("retro-postar").textContent).toMatch(/Postar no feed/);
    expect(screen.getByTestId("retro-folha-previa").getAttribute("data-formato")).toBe("feed");
    // Esc fecha a folha primeiro (não a retrospectiva)
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("retro-folha")).toBeNull();
    expect(screen.getByTestId("retro-outubro")).toBeTruthy();
    expect(tela.getAttribute("data-pausado")).toBe("nao");
  });

  it("a folha fechada no toque no escuro; na abertura não tem interruptor de R$", async () => {
    await abrir();
    fireEvent.click(screen.getByTestId("retro-compartilhar"));
    expect(screen.queryByTestId("retro-valores")).toBeNull();
    fireEvent.click(screen.getByTestId("retro-folha-fundo"));
    expect(screen.queryByTestId("retro-folha")).toBeNull();
  });

  it("último card (resumo): o botão grande 'Compartilhar meu outubro' abre a mesma folha com o resumo; não passa sozinho daí", async () => {
    await abrir();
    for (let k = 0; k < 9; k++) fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("resumo");
    barraTermina();
    expect(atual()).toBe("resumo");
    const botao = screen.getByTestId("retro-compartilhar-final");
    expect(botao.textContent).toMatch(/Compartilhar meu outubro/);
    fireEvent.click(botao);
    expect(screen.getByTestId("retro-folha")).toBeTruthy();
    expect(de("wrapped_compartilhar_aberto").at(-1)!.dados).toMatchObject({ card: "resumo", origem: "final" });
    expect(de("wrapped_tela").map((e) => e.dados.id)).toEqual(["abertura", "financas", "adivinha", "treino", "rotina", "agua", "leitura", "metas", "perfil", "resumo"]);
  });

  it("pouco uso: o último é o fechamento, com o mesmo botão grande", async () => {
    await abrir(SEMENTE_POUCO_1);
    expect(de("wrapped_cards")[0].dados).toMatchObject({ cards: "abertura,treino,fechamento", pouco_dado: true });
    barraTermina();
    barraTermina();
    expect(atual()).toBe("fechamento");
    expect(screen.getByTestId("retro-compartilhar-final")).toBeTruthy();
  });

  it("'reduzir movimento' do sistema: não passa sozinho (o relógio fica parado), o toque continua", async () => {
    movimento.reduzir = true;
    const { tela } = await abrir();
    expect(tela.getAttribute("data-relogio")).toBe("parado");
    barraTermina();
    expect(atual()).toBe("abertura");
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("financas");
  });

  it("sem nenhum registro: a mesma tela acolhedora de sempre", async () => {
    const { RetroOutubro } = await import("@/components/compartilhar/RetroOutubro");
    render(<RetroOutubro ler={leitorDe({})} agora={NOV} onClose={() => {}} />);
    expect(screen.getByTestId("retro-outubro").getAttribute("data-card-atual")).toBe("vazio");
    expect(screen.getByText("Seu mês não")).toBeTruthy();
    expect(screen.getByTestId("retro-vazio-ok")).toBeTruthy();
  });

  it("nenhum evento leva e-mail ou id da pessoa", async () => {
    const { unmount } = await abrir();
    fireEvent.click(screen.getByTestId("retro-proximo"));
    fireEvent.click(screen.getByTestId("retro-compartilhar"));
    unmount();
    for (const e of eventos) {
      for (const k of Object.keys(e.dados)) expect(k, e.nome).not.toMatch(/mail|uid|user/i);
      expect(JSON.stringify(e.dados), e.nome).not.toMatch(/@/);
    }
  });
});

describe("5b. transições (03/11: 'vê se aparece animações em todas transição')", () => {
  const camadas = () => Array.from(screen.getByTestId("retro-telas").children) as HTMLElement[];

  it("avançar: a tela de antes fica embaixo (o conteúdo sai pro lado) e a nova entra por cima com fade + deslize; depois só fica a nova", async () => {
    await abrir();
    expect(camadas()).toHaveLength(1);
    fireEvent.click(screen.getByTestId("retro-proximo"));
    const [antes, agora] = camadas();
    expect(antes.getAttribute("data-camada")).toBe("saindo");
    expect(agora.getAttribute("data-camada")).toBe("atual");
    expect(agora.style.animation).toMatch(/retroTcEntraDir/);
    expect((antes.lastElementChild as HTMLElement).style.animation).toMatch(/retroTcSaiEsq/);
    expect(screen.getAllByTestId("retro-palco")).toHaveLength(1); // a de antes não tem os ids (os testes e o toque vão na de agora)
    await waitFor(() => expect(camadas()).toHaveLength(1));
    expect(camadas()[0].style.animation).toBe("");
  });

  it("voltar: entra do outro lado; voltar num card já visto também anima (o card pronto)", async () => {
    await abrir();
    fireEvent.click(screen.getByTestId("retro-proximo"));
    await waitFor(() => expect(camadas()).toHaveLength(1));
    fireEvent.click(screen.getByTestId("retro-anterior"));
    expect(atual()).toBe("abertura");
    expect(camadas()[1].style.animation).toMatch(/retroTcEntraEsq/);
    expect((camadas()[0].lastElementChild as HTMLElement).style.animation).toMatch(/retroTcSaiDir/);
  });

  it("adivinha → card: a pergunta sai com fade por cima, sem duplicar os ids", async () => {
    await abrir();
    for (let k = 0; k < 2; k++) fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("adivinha");
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("treino");
    expect(screen.queryByTestId("retro-adivinha")).toBeNull();
    expect(document.querySelectorAll('[data-revelado]').length).toBe(1); // a cópia que está sumindo
  });

  it("'reduzir movimento': só fade curto, sem deslize", async () => {
    movimento.reduzir = true;
    await abrir();
    fireEvent.click(screen.getByTestId("retro-proximo"));
    const [antes, agora] = camadas();
    expect(agora.style.animation).toMatch(/retroTcEntra /);
    expect(agora.style.animation).not.toMatch(/Dir|Esq/);
    expect((antes.lastElementChild as HTMLElement).style.animation).toBe("");
  });

  it("a folha desce suave ao fechar (sem toque nela enquanto desce) e a retrospectiva volta a andar na hora", async () => {
    const { tela } = await abrir();
    fireEvent.click(screen.getByTestId("retro-compartilhar"));
    fireEvent.click(screen.getByTestId("retro-folha-fechar"));
    expect(screen.queryByTestId("retro-folha")).toBeNull();
    expect(screen.getByTestId("retro-folha-saindo").style.pointerEvents).toBe("none");
    expect(tela.getAttribute("data-pausado")).toBe("nao");
    await waitFor(() => expect(screen.queryByTestId("retro-folha-saindo")).toBeNull());
  });
});

describe("6. rodada 2 (02/11): pílula, adivinha, perfil, próximo passo", () => {
  const ate = (id: string) => { for (let k = 0; k < 12 && atual() !== id; k++) fireEvent.click(screen.getByTestId("retro-proximo")); expect(atual()).toBe(id); };

  it("a pílula 'Compartilhar' só nos cards bons de postar (Finanças, Treino, Leitura, Perfil); abre a mesma folha (origem 'pilula')", async () => {
    await abrir();
    const com: Record<string, boolean> = {};
    for (let k = 0; k < 10; k++) {
      com[atual()!] = !!screen.queryByTestId("retro-compartilhar-pilula");
      fireEvent.click(screen.getByTestId("retro-proximo"));
    }
    expect(com).toMatchObject({ abertura: false, financas: true, adivinha: false, treino: true, rotina: false, agua: false, leitura: true, metas: false, perfil: true, resumo: false });
    fireEvent.click(screen.getByTestId("retro-anterior")); // perfil
    expect(atual()).toBe("perfil");
    fireEvent.click(screen.getByTestId("retro-compartilhar-pilula"));
    expect(screen.getByTestId("retro-folha")).toBeTruthy();
    expect(de("wrapped_compartilhar_aberto").at(-1)!.dados).toMatchObject({ card: "perfil", origem: "pilula" });
  });

  it("adivinha antes do treino: 3 opções com a certa; tocar na certa → 'Acertou!' (wrapped_adivinha acertou) e o relógio anda pra passar", async () => {
    const { tela } = await abrir();
    ate("adivinha");
    expect(screen.getByTestId("retro-adivinha-pergunta").textContent).toBe("Quantos dias você acha que treinou em outubro?");
    expect(screen.queryByTestId("retro-compartilhar")).toBeNull(); // não é card: nada pra postar
    const ops = screen.getAllByTestId("retro-adivinha-opcao").map((b) => Number(b.getAttribute("data-valor")));
    expect(ops).toHaveLength(3);
    expect(ops).toContain(18);
    expect(tela.getAttribute("data-relogio")).toBe("parado"); // espera o palpite
    fireEvent.click(screen.getAllByTestId("retro-adivinha-opcao").find((b) => b.getAttribute("data-valor") === "18")!);
    expect(screen.getByTestId("retro-adivinha-resposta").textContent).toMatch(/Acertou!/);
    expect(de("wrapped_adivinha")[0].dados).toMatchObject({ mes: "outubro", modulo: "treino", respondeu: true, acertou: true, como: "escolheu", versao: "tela-cheia" });
    expect(tela.getAttribute("data-relogio")).toBe("andando");
    barraTermina();
    expect(atual()).toBe("treino");
  });

  it("adivinha: errou → 'Foram 18!'; sem toque, revela sozinho em 8 s (respondeu: false)", async () => {
    await abrir();
    ate("adivinha");
    const errada = screen.getAllByTestId("retro-adivinha-opcao").find((b) => b.getAttribute("data-valor") !== "18")!;
    fireEvent.click(errada);
    expect(screen.getByTestId("retro-adivinha-resposta").textContent).toMatch(/Foram 18!/);
    expect(de("wrapped_adivinha")[0].dados).toMatchObject({ respondeu: true, acertou: false });
    cleanup();
    eventos.length = 0;
    vi.useFakeTimers();
    await abrir();
    ate("adivinha");
    act(() => { vi.advanceTimersByTime(TEMPOS.adivinha + 50); });
    expect(screen.getByTestId("retro-adivinha-resposta").textContent).toMatch(/Foram 18!/);
    expect(de("wrapped_adivinha")[0].dados).toMatchObject({ respondeu: false, acertou: false, como: "sozinho" });
  });

  it("adivinha: passar sem responder conta como 'pulou'; com 'reduzir movimento' revela mas não passa sozinho", async () => {
    await abrir();
    ate("adivinha");
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(atual()).toBe("treino");
    expect(de("wrapped_adivinha")[0].dados).toMatchObject({ como: "pulou", respondeu: false });
    cleanup();
    movimento.reduzir = true;
    const { tela } = await abrir();
    ate("adivinha");
    fireEvent.click(screen.getAllByTestId("retro-adivinha-opcao")[0]);
    expect(screen.getByTestId("retro-adivinha").getAttribute("data-revelado")).toBe("sim");
    expect(tela.getAttribute("data-relogio")).toBe("parado");
  });

  it("pouco uso sem número que valha: sem adivinha", async () => {
    await abrir(SEMENTE_POUCO_1);
    expect(screen.getAllByTestId("retro-barras")[0].children.length).toBe(3);
    expect(de("wrapped_cards")[0].dados).toMatchObject({ adivinha: false });
  });

  it("o perfil: antes do resumo, com o evento wrapped_perfil (sem dado pessoal)", async () => {
    await abrir();
    ate("perfil");
    expect(screen.getByText("Seu outubro foi…")).toBeTruthy();
    expect(de("wrapped_perfil")[0].dados).toEqual({ mes: "outubro", perfil: "Modo atleta", modulo: "treino", versao: "tela-cheia" });
  });

  it("o próximo passo no fim: 'Novembro começa agora → registrar algo hoje' leva pro módulo do perfil (wrapped_proximo_passo; fechou como 'proximo')", async () => {
    const { RetroOutubro } = await import("@/components/compartilhar/RetroOutubro");
    const ir = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(<RetroOutubro ler={leitorDe(SEMENTE_COMPLETA)} agora={NOV} onClose={onClose} onProximoPasso={ir} />);
    await act(async () => { await Promise.resolve(); });
    ate("resumo");
    const passo = screen.getByTestId("retro-proximo-passo");
    expect(passo.textContent).toMatch(/Novembro começa agora.*registrar algo hoje/);
    fireEvent.click(passo);
    await waitFor(() => expect(ir).toHaveBeenCalledWith("/treino"));
    expect(de("wrapped_proximo_passo")[0].dados).toMatchObject({ mes: "outubro", destino: "/treino", card: "resumo", versao: "tela-cheia" });
    unmount();
    expect(de("wrapped_fechou")[0].dados).toMatchObject({ como: "proximo", chegou_ao_fim: true });
  });

  it("o card na tela cheia é mais comprido (extra), mas o da folha/postar continua 1080×1920", async () => {
    await abrir();
    const palco = screen.getByTestId("retro-palco");
    expect(Number(palco.getAttribute("data-extra"))).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getByTestId("retro-compartilhar"));
    const previa = screen.getByTestId("retro-folha-previa").querySelector<HTMLElement>("[data-cartao-share]")!;
    expect(previa.style.height).toBe("1920px");
  });
});

