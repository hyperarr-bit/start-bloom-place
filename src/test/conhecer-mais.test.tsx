/**
 * CONHECER MAIS (17/10, lib/conhecer-mais + components/intro-modulo/ConhecerMais) — o que este arquivo trava:
 *   · só Finanças, Rotina e Saúde têm passeio; 3–5 paradas cada; nenhuma frase de FOMO; a oferta diz o que é e
 *     quanto dura ("Ver mais 4 dicas de Saúde" · "Log médico, remédios, evolução… · 1 min" — a linha pequena cabe numa linha só);
 *   · nunca automático: o cartão do fim da intro oferece como controle SECUNDÁRIO acima do "Pronto"; o passeio só
 *     abre por `abrirConhecerMais` (fim da intro, lembrete, botão de dicas, missão);
 *   · dentro do passeio: faixa com "Sair" escrito e "2 de 4", "Próxima" (a última "Terminar"); a parada troca a
 *     aba e pula o card que não existe; sair = conhecer_mais_sair + fim incompleto (sem marcar feito); terminar =
 *     feito (aparelho + conta) e a oferta não volta;
 *   · o lembrete: SÓ na 3ª abertura do módulo, uma vez; "Agora não" apaga pra sempre; "Ver" abre;
 *   · chaves novas classificadas; eventos conhecer_mais_oferta/abrir/parada/sair/fim;
 *   · (17/10, revisão tela a tela #17) o fim — "Sair" ou "Terminar" — avisa quem abriu: `conhecer-mais:fim` na window,
 *     {modulo, origem, completo}, 1 vez (a missão leva a pessoa de volta pro caminho dela quando abriu pela festa).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { AcessoConhecerMais, ConhecerMaisHost } from "@/components/intro-modulo/ConhecerMais";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { CHAVE_FORCA_INTRO } from "@/lib/intro-modulo";
import {
  ABERTURA_DO_LEMBRETE, CHAVE_TOURS_FEITOS_CONTA, EVENTO_FIM_TOUR, TOURS, abrirConhecerMais, chaveAberturas, chaveLembreteVisto, chaveTourFeito, lembreteDevido, marcarTourFeito, ofertaDoTour, temTour, tourFeito,
  type FimDoTour,
} from "@/lib/conhecer-mais";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}
const montar = (ui: ReactNode, inicial: Dados = {}) => {
  const s = criarStore(inicial);
  const r = render(<MemoryRouter initialEntries={["/financas"]}><s.Provedor>{ui}</s.Provedor></MemoryRouter>);
  return { ...r, ...s };
};
/** O Finanças de mentira com os 5 cards do passeio (títulos iguais aos da tela) e as abas no header. */
const FinancasFalsa = ({ semDividas = false }: { semDividas?: boolean }) => {
  const [aba, setAba] = useState("financeiro");
  return (
    <div>
      <header><button type="button" onClick={() => setAba("dashboard")}>📊 DASHBOARD</button><button type="button" onClick={() => setAba("financeiro")}>💰 MEU FINANCEIRO</button></header>
      {aba === "financeiro" && (
        <div>
          <section data-missao="meu-mes"><h3>MEU MÊS — OUTUBRO</h3></section>
          <div className="rounded-lg"><h3>CUSTOS FIXOS</h3></div>
          <div className="rounded-lg"><h3>💳 TOTAL POR CARTÃO NO MÊS</h3></div>
          {!semDividas && <div className="rounded-lg"><h3>DÍVIDAS E EMPRÉSTIMOS</h3></div>}
        </div>
      )}
      {aba === "dashboard" && <div className="rounded-lg"><h3>DESAFIO DA SEMANA</h3></div>}
      <ConhecerMaisHost moduleId="financas" />
    </div>
  );
};
const nomes = () => eventos.map(([n]) => n);
const medirTudo = () => vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);

beforeAll(() => { window.scrollTo = (() => {}) as typeof window.scrollTo; });
beforeEach(() => { localStorage.clear(); eventos.length = 0; localStorage.setItem(CHAVE_FORCA_INTRO, "on"); });
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.removeAttribute("data-conhecer-mais"); vi.restoreAllMocks(); });

describe("o passeio: configuração, oferta e chaves", () => {
  it("só Finanças, Rotina e Saúde; 3 a 5 paradas; a oferta diz o que é e quanto dura; nada de FOMO", () => {
    expect(Object.keys(TOURS).sort()).toEqual(["financas", "rotina", "saude"]);
    expect(temTour("casa")).toBe(false);
    for (const t of Object.values(TOURS)) {
      expect(t.paradas.length).toBeGreaterThanOrEqual(3);
      expect(t.paradas.length).toBeLessThanOrEqual(5);
      const texto = JSON.stringify(t).toLowerCase();
      for (const proibido of ["não perca", "nao perca", "vai perder", "última chance", "imperdível"]) expect(texto, proibido).not.toContain(proibido);
      for (const p of t.paradas) { expect(p.texto.length).toBeGreaterThan(30); expect(p.texto.length).toBeLessThan(170); }
    }
    // dono 17/10: "Ver mais N dicas de X"; a linha pequena numa linha só do botão — entra nome por nome, o resto vira "…"
    // o "1 min" vai preso por um espaço que não quebra (17/10, revisão tela a tela #42: nunca "min" sozinho na linha de baixo)
    expect(ofertaDoTour("financas")).toEqual({ titulo: "Ver mais 5 dicas de Finanças", linha: "Meu Mês, contas fixas, cartão… · 1\u00a0min" });
    expect(ofertaDoTour("saude")).toEqual({ titulo: "Ver mais 4 dicas de Saúde", linha: "Log médico, remédios, evolução… · 1\u00a0min" });
    expect(ofertaDoTour("rotina")).toEqual({ titulo: "Ver mais 3 dicas de Rotina", linha: "Rotina semanal, meu mês e foco · 1\u00a0min" }); // os 3 cabem: sem "…"
    for (const m of ["financas", "rotina", "saude"]) expect(ofertaDoTour(m)!.linha.replace(/ · 1\u00a0min$/, "").length).toBeLessThanOrEqual(33); // 32 letras + "…"
    expect(ofertaDoTour("casa")).toBeNull();
  });
  it("as chaves novas estão classificadas; feito vale no aparelho e na conta; o lembrete é só na 3ª abertura", () => {
    for (const k of [chaveTourFeito("financas"), chaveLembreteVisto("saude"), chaveAberturas("rotina")]) { expect(ehChaveDoAparelho(k)).toBe(true); expect(vassouraLeva(k)).toBe(false); }
    expect(vassouraLeva(CHAVE_TOURS_FEITOS_CONTA)).toBe(true);
    expect(tourFeito("financas")).toBe(false);
    const get = <T,>(k: string, f: T): T => (k === CHAVE_TOURS_FEITOS_CONTA ? (["financas"] as never) : f);
    expect(tourFeito("financas", get)).toBe(true); // o 2º aparelho sabe pela conta
    expect(lembreteDevido("financas", ABERTURA_DO_LEMBRETE)).toBe(true);
    expect(lembreteDevido("financas", 2)).toBe(false);
    expect(lembreteDevido("financas", 4)).toBe(false);
    expect(lembreteDevido("casa", ABERTURA_DO_LEMBRETE)).toBe(false);
    marcarTourFeito("financas");
    expect(lembreteDevido("financas", ABERTURA_DO_LEMBRETE)).toBe(false);
    expect(abrirConhecerMais("casa", "menu")).toBe(false);
  });
});

describe("o passeio na tela", () => {
  it("abre pelo pedido, passa pelas paradas trocando de aba, pula o card que não existe, 'Terminar' marca feito (aparelho + conta) e emite os eventos", async () => {
    medirTudo();
    const fins: FimDoTour[] = [];
    const ouvirFim = (e: Event) => fins.push((e as CustomEvent<FimDoTour>).detail);
    window.addEventListener(EVENTO_FIM_TOUR, ouvirFim);
    const { estado } = montar(<FinancasFalsa semDividas />);
    expect(screen.queryByTestId("conhecer-mais-faixa")).toBeNull(); // nunca automático
    act(() => { abrirConhecerMais("financas", "menu"); });
    expect(screen.getByTestId("conhecer-mais-faixa").textContent).toContain("Conhecer mais · Finanças");
    expect(eventos.find(([n, d]) => n === "conhecer_mais_abrir" && d.origem === "menu")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-balao")).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByTestId("conhecer-mais-passo").textContent).toBe("1 de 5");
    expect(screen.getByTestId("conhecer-mais-balao").textContent).toContain("Meu Mês");
    expect(screen.getByTestId("conhecer-mais-proxima").textContent).toContain("Próxima");
    expect(screen.getByTestId("conhecer-mais-sair").textContent).toBe("Sair");
    fireEvent.click(screen.getByTestId("conhecer-mais-proxima"));
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-passo").textContent).toBe("2 de 5"), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-balao").textContent).toContain("Custos fixos"), { timeout: 4000 });
    fireEvent.click(screen.getByTestId("conhecer-mais-proxima"));
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-balao").textContent).toContain("Total por cartão"), { timeout: 4000 });
    fireEvent.click(screen.getByTestId("conhecer-mais-proxima"));
    // "Dívidas" não existe nesta conta: pula pro Desafio (em outra aba, que o passeio abre sozinho)
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-balao").textContent).toContain("Desafio da semana"), { timeout: 6000 });
    expect(screen.getByTestId("conhecer-mais-passo").textContent).toBe("5 de 5");
    expect(screen.getByTestId("conhecer-mais-proxima").textContent).toContain("Terminar");
    fireEvent.click(screen.getByTestId("conhecer-mais-proxima"));
    await waitFor(() => expect(screen.queryByTestId("conhecer-mais-faixa")).toBeNull());
    expect(localStorage.getItem(chaveTourFeito("financas"))).toBeTruthy();
    expect(estado.dados[CHAVE_TOURS_FEITOS_CONTA]).toEqual(["financas"]);
    expect(eventos.filter(([n]) => n === "conhecer_mais_parada").map(([, d]) => d.n)).toEqual([1, 2, 3, 5]);
    expect(eventos.find(([n, d]) => n === "conhecer_mais_fim" && d.completo === true)).toBeTruthy();
    expect(nomes()).not.toContain("conhecer_mais_sair");
    expect(document.documentElement.hasAttribute("data-conhecer-mais")).toBe(false);
    window.removeEventListener(EVENTO_FIM_TOUR, ouvirFim);
    // quem abriu fica sabendo que acabou, com a origem (a missão leva a pessoa de volta quando abriu pela festa) — 1 vez
    expect(fins).toEqual([{ modulo: "financas", origem: "menu", completo: true }]);
  });

  it("'Sair' no meio: fim incompleto, sem marcar feito; a oferta pode voltar", async () => {
    medirTudo();
    const fins: FimDoTour[] = [];
    const ouvirFim = (e: Event) => fins.push((e as CustomEvent<FimDoTour>).detail);
    window.addEventListener(EVENTO_FIM_TOUR, ouvirFim);
    montar(<FinancasFalsa />);
    act(() => { abrirConhecerMais("financas", "fim_dose"); });
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-balao")).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByTestId("conhecer-mais-proxima"));
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-passo").textContent).toBe("2 de 5"), { timeout: 4000 });
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    await waitFor(() => expect(screen.queryByTestId("conhecer-mais-faixa")).toBeNull());
    expect(eventos.find(([n, d]) => n === "conhecer_mais_sair" && d.n === 2)).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "conhecer_mais_fim" && d.completo === false)).toBeTruthy();
    expect(localStorage.getItem(chaveTourFeito("financas"))).toBeNull();
    expect(tourFeito("financas")).toBe(false);
    window.removeEventListener(EVENTO_FIM_TOUR, ouvirFim);
    // o "Sair" também avisa o fim (incompleto), com quem abriu — aqui, a festa da dose (17/10, revisão tela a tela #17)
    expect(fins).toEqual([{ modulo: "financas", origem: "fim_dose", completo: false }]);
  });

  it("o lembrete: nada na 1ª e 2ª aberturas, aparece na 3ª (com evento de oferta), 'Agora não' apaga pra sempre; 'Ver' abre", async () => {
    medirTudo();
    for (let i = 1; i <= 2; i++) { montar(<FinancasFalsa />); expect(screen.queryByTestId("conhecer-mais-lembrete")).toBeNull(); cleanup(); }
    montar(<FinancasFalsa />); // 3ª abertura
    expect(screen.getByTestId("conhecer-mais-lembrete").textContent).toContain("5 coisas úteis");
    expect(eventos.find(([n, d]) => n === "conhecer_mais_oferta" && d.origem === "lembrete")).toBeTruthy();
    fireEvent.click(screen.getByTestId("conhecer-mais-lembrete-nao"));
    expect(screen.queryByTestId("conhecer-mais-lembrete")).toBeNull();
    cleanup();
    for (let i = 4; i <= 6; i++) { montar(<FinancasFalsa />); expect(screen.queryByTestId("conhecer-mais-lembrete")).toBeNull(); cleanup(); } // nunca mais sozinho
    localStorage.clear(); localStorage.setItem(CHAVE_FORCA_INTRO, "on"); localStorage.setItem(chaveAberturas("financas"), "2");
    montar(<FinancasFalsa />); // 3ª de novo, noutro aparelho: "Ver" abre
    fireEvent.click(screen.getByTestId("conhecer-mais-lembrete-ver"));
    expect(screen.queryByTestId("conhecer-mais-lembrete")).toBeNull();
    expect(screen.getByTestId("conhecer-mais-faixa")).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "conhecer_mais_abrir" && d.origem === "lembrete")).toBeTruthy();
    expect(localStorage.getItem(chaveLembreteVisto("financas"))).toBeTruthy();
  });

  it("o acesso permanente no cabeçalho ('Dicas') abre o passeio; some pra módulo sem passeio e com a chave desligada", () => {
    medirTudo();
    montar(<><AcessoConhecerMais moduleId="financas" /><FinancasFalsa /></>);
    fireEvent.click(screen.getByTestId("conhecer-mais-acesso"));
    expect(screen.getByTestId("conhecer-mais-faixa")).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "conhecer_mais_abrir" && d.origem === "menu")).toBeTruthy();
    cleanup();
    const a = montar(<AcessoConhecerMais moduleId="casa" />);
    expect(a.container.innerHTML).toBe("");
    cleanup(); localStorage.removeItem(CHAVE_FORCA_INTRO);
    const b = montar(<AcessoConhecerMais moduleId="financas" />);
    expect(b.container.innerHTML).toBe("");
  });

  it("a IntroDoModulo monta o host nos módulos com passeio mesmo sem intro na tela (a missão pode pedir o passeio pelo fim de uma dose)", () => {
    medirTudo();
    localStorage.setItem("core-intro-vista-financas", "feita@2026-10-17T10:00:00.000Z"); // intro já vista: nada por cima
    montar(<><header><button type="button">💰 MEU FINANCEIRO</button></header><section data-missao="meu-mes"><h3>MEU MÊS</h3></section><IntroDoModulo moduleId="financas" /></>);
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    act(() => { expect(abrirConhecerMais("financas", "fim_dose")).toBe(true); });
    expect(screen.getByTestId("conhecer-mais-faixa")).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "conhecer_mais_abrir" && d.origem === "fim_dose")).toBeTruthy();
  });
});

describe("o cartão do fim da intro guiada", () => {
  it("oferece o passeio como controle secundário acima do 'Pronto' (evento de oferta), e não oferece quando já foi feito", async () => {
    medirTudo();
    const Modulo = () => (
      <div>
        <header><button type="button">💰 MEU FINANCEIRO</button></header>
        <div><input placeholder="+ Novo gasto" /><button data-spotlight="add-expense">+</button></div>
        <IntroDoModulo moduleId="financas" />
      </div>
    );
    montar(<Modulo />);
    const chip = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    fireEvent.click(chip[0]);
    await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 4000 });
    const pronto = screen.getByTestId("intro-modulo-pronto");
    const botoes = Array.from(pronto.querySelectorAll("button"));
    expect(botoes.map((b) => b.getAttribute("data-testid"))).toEqual(["intro-modulo-conhecer-mais", "intro-modulo-fechar"]); // a oferta ACIMA, o Pronto por último
    expect(screen.getByTestId("intro-modulo-fechar").textContent).toBe("Pronto");
    // dono 17/10: um botão de verdade — lâmpada na frente, rótulo numa linha + linha pequena dentro, "›" atrás
    const oferta = screen.getByTestId("intro-modulo-conhecer-mais");
    expect(oferta.tagName).toBe("BUTTON");
    expect(oferta.querySelector(".im-pronto-oferta-titulo")?.textContent).toBe("Ver mais 5 dicas de Finanças");
    expect(oferta.querySelector(".im-pronto-oferta-linha")?.textContent).toBe("Meu Mês, contas fixas, cartão… · 1\u00a0min"); // "1 min" preso
    expect(oferta.querySelector("svg.im-pronto-oferta-icone")).toBeTruthy();
    expect(oferta.querySelector("svg.im-pronto-oferta-seta")).toBeTruthy();
    const partes = ["im-pronto-oferta-icone", "im-pronto-oferta-textos", "im-pronto-oferta-seta"]; // nessa ordem: lâmpada, textos, "›"
    expect(Array.from(oferta.children).map((c) => partes.find((k) => c.classList.contains(k)))).toEqual(partes);
    expect(eventos.find(([n, d]) => n === "conhecer_mais_oferta" && d.origem === "fim_tutorial")).toBeTruthy();
    fireEvent.click(screen.getByTestId("intro-modulo-conhecer-mais"));
    await waitFor(() => expect(screen.getByTestId("conhecer-mais-faixa")).toBeTruthy(), { timeout: 3000 });
    expect(eventos.find(([n, d]) => n === "conhecer_mais_abrir" && d.origem === "fim_tutorial")).toBeTruthy();
    expect(localStorage.getItem("core-intro-vista-financas")).toMatch(/^feita@/); // a intro terminou como feita
    cleanup(); localStorage.clear(); localStorage.setItem(CHAVE_FORCA_INTRO, "on"); eventos.length = 0;
    marcarTourFeito("financas");
    montar(<Modulo />);
    const chip2 = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    fireEvent.click(chip2[0]);
    await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId("intro-modulo-conhecer-mais")).toBeNull();
    expect(nomes()).not.toContain("conhecer_mais_oferta");
  });
});
