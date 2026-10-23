/**
 * RETROSPECTIVA DE OUTUBRO (23/10, estreia 1º/11) — as regras de dados e a chave.
 *   · só módulo com registro de verdade (e o mínimo) vira card; abertura e resumo sempre;
 *   · pouco dado: só o que tem, sem completar nada;
 *   · janela 01/10–31/10 (30/09 e 01/11 ficam fora; antes de 01/11 o "hoje" corta);
 *   · "no azul" só com o mês anotado (CRITERIO_AZUL); senão o card neutro de lançamentos;
 *   · R$ escondido por padrão (e o texto das metas tapado);
 *   · chave `retro_outubro` desligada = nada muda; ligada, só a partir de 01/11 (ou a força de QA na web).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { montarRetroOutubro, comEscolhas, CRITERIO_AZUL, MINIMOS_RETRO } from "@/components/compartilhar/retro-outubro-dados";
import { CardDeCompartilhar } from "@/components/compartilhar/cards";
import { TEMAS, contraste } from "@/components/compartilhar/temas";
import {
  RETRO_OUTUBRO_APP, RETRO_OUTUBRO_WEB, CHAVE_FORCA_RETRO_OUTUBRO, retroOutubroAtiva, retroOutubroLigada, outubroJaAcabou,
  registrarRetroOutubroRemoto, _zerarRetroOutubroRemoto, guardarForcaRetroOutubro, lerChaveRemotaRetroOutubro,
} from "@/lib/retro-outubro";
import { SEMENTE_COMPLETA, SEMENTE_FIN_INCOMPLETA, SEMENTE_POUCA, AGORA_EXEMPLO, leitorDe } from "@/pages/dev/retro-outubro-exemplo";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
const eventos = vi.hoisted(() => [] as { nome: string; dados: Record<string, unknown> }[]);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown> = {}) => { eventos.push({ nome, dados }); },
  trackEventBeacon: (nome: string, dados: Record<string, unknown> = {}) => { eventos.push({ nome, dados }); },
}));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));

const NOV = AGORA_EXEMPLO; // 01/11/2026 10h
const out = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const montar = (s: Record<string, unknown>, agora = NOV) => montarRetroOutubro(leitorDe(s), { agora });
const ids = (s: Record<string, unknown>, agora = NOV) => montar(s, agora)?.cards.map((c) => c.id) ?? null;

beforeEach(() => { nativo.v = false; eventos.length = 0; });
afterEach(() => {
  cleanup();
  _zerarRetroOutubroRemoto();
  try { localStorage.removeItem(CHAVE_FORCA_RETRO_OUTUBRO); } catch { /* sem storage */ }
});

describe("1. só módulo com registro vira card; abertura e resumo sempre", () => {
  it("a conta completa: abertura → finanças → treino → rotina → água → leitura → metas → resumo", () => {
    const r = montar(SEMENTE_COMPLETA)!;
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "financas", "treino", "rotina", "agua", "leitura", "metas", "resumo"]);
    expect(r.poucoDado).toBe(false);
    expect(r.financas).toBe("azul");
  });
  it("conta vazia: nada (null) — nunca uma sequência vazia", () => {
    expect(montar({})).toBeNull();
  });
  it("só treino: abertura, treino, resumo — os outros módulos não aparecem", () => {
    expect(ids({ "saude-workout-log": [out(3), out(9), out(20)] })).toEqual(["abertura", "treino", "resumo"]);
  });
  it("cada card de módulo tem número > 0 (nunca card vazio) e o resumo tem um bloco por módulo", () => {
    const r = montar(SEMENTE_COMPLETA)!;
    const resumo = r.cards.at(-1)!.dados;
    expect(resumo.tipo).toBe("retro-resumo");
    if (resumo.tipo !== "retro-resumo") return;
    expect(resumo.itens.map((i) => i.modulo)).toEqual(["financas", "treino", "rotina", "agua", "leitura", "metas"]);
    for (const it of resumo.itens) expect(Number.parseInt(it.numero, 10)).toBeGreaterThan(0);
    const abertura = r.cards[0].dados;
    if (abertura.tipo === "retro-abertura") expect(abertura.modulos).toEqual(resumo.itens.map((i) => i.modulo));
  });
  it("hábito, água, livro e meta sem o mínimo não viram card", () => {
    const s = {
      "rotina-habit-log": { [out(2)]: ["Ler"], [out(3)]: ["Ler"] }, // 2 dias < 3
      "water-log": { [out(1)]: 8, [out(2)]: 8 }, // 2 dias na meta < 3
      "lib-books": [{ title: "X", status: "lendo" }],
      "month-goals": { "2026-10": [{ text: "A", done: false }] },
    };
    expect(ids(s)).toEqual(["abertura", "resumo"]);
    expect(MINIMOS_RETRO.rotina).toBe(3);
  });
});

describe("2. pouco dado", () => {
  it("2 treinos + 3 gastos: abertura, treino, resumo — finanças não entra (3 < 5 lançamentos)", () => {
    const r = montar(SEMENTE_POUCA)!;
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "treino", "resumo"]);
    expect(r.poucoDado).toBe(true);
    expect(r.financas).toBeNull();
  });
  it("1 treino só: não tem card de treino (mínimo 2); a abertura e o resumo contam os dias", () => {
    const r = montar({ "saude-workout-log": [out(18)] })!;
    expect(r.cards.map((c) => c.id)).toEqual(["abertura", "resumo"]);
    const resumo = r.cards[1].dados;
    if (resumo.tipo === "retro-resumo") { expect(resumo.itens).toEqual([]); expect(resumo.diasComRegistro).toBe(1); }
  });
  it("o resumo sem nenhum módulo mostra o número de dias (não fica vazio)", () => {
    const r = montar({ "saude-workout-log": [out(18)] })!;
    render(<CardDeCompartilhar dados={r.cards[1].dados} formato="stories" />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getAllByText(/dia com registro/).length).toBeGreaterThan(0);
  });
});

describe("3. janela 01/10–31/10", () => {
  it("30/09 e 01/11 ficam fora; 01/10 e 31/10 entram", () => {
    const r = montar({ "saude-workout-log": ["2026-09-30", out(1), out(31), "2026-11-01"] })!;
    const t = r.cards.find((c) => c.id === "treino")!.dados;
    expect(t.tipo === "treinos" && t.dias).toEqual([out(1), out(31)]);
  });
  it("livro terminado em 30/09 não entra; o de 31/10 entra", () => {
    const r = montar({ "lib-books": [{ title: "Set", status: "lido", endDate: "2026-09-30" }, { title: "Out", status: "lido", endDate: out(31), cover: "https://covers.openlibrary.org/b/id/1-L.jpg" }] })!;
    const l = r.cards.find((c) => c.id === "leitura")!.dados;
    expect(l.tipo === "livros" && l.livros.map((x) => [x.titulo, x.capa])).toEqual([["Out", "https://covers.openlibrary.org/b/id/1-L.jpg"]]);
  });
  it("livro sem capa vai sem capa (o card desenha a capa tipográfica com título e autor)", () => {
    const r = montar({ "lib-books": [{ title: "Tudo é rio", author: "Carla Madeira", status: "lido", endDate: out(5), cover: "" }] })!;
    const l = r.cards.find((c) => c.id === "leitura")!.dados;
    expect(l.tipo === "livros" && l.livros[0].capa).toBeUndefined();
    render(<CardDeCompartilhar dados={l} formato="stories" />);
    expect(screen.getByText("Tudo é rio")).toBeTruthy();
    expect(screen.getByText("Carla Madeira")).toBeTruthy();
  });
  it("antes de 01/11 (só o QA vê) o hoje corta os dias que não chegaram", () => {
    const r = montar({ "saude-workout-log": [out(1), out(10), out(25)] }, new Date(2026, 9, 23, 12))!;
    const t = r.cards.find((c) => c.id === "treino")!.dados;
    expect(t.tipo === "treinos" && t.dias).toEqual([out(1), out(10)]);
    expect(t.tipo === "treinos" && t.hoje).toBe("2026-10-23");
  });
});

describe("4. Finanças: 'no azul' só com o mês anotado", () => {
  it("mês anotado pela metade (9 gastos até o dia 15) → card NEUTRO de lançamentos, nunca azul", () => {
    const r = montar(SEMENTE_FIN_INCOMPLETA)!;
    expect(r.financas).toBe("neutro");
    const f = r.cards.find((c) => c.id === "financas")!.dados;
    expect(f.tipo).toBe("lancamentos");
    if (f.tipo === "lancamentos") expect(f.lancamentos).toBe(10);
    render(<CardDeCompartilhar dados={f} formato="stories" />);
    expect(screen.queryByText(/azul/i)).toBeNull();
  });
  it("gastos espalhados mas sem nada da última semana → neutro", () => {
    const s = { "finance-incomes": [{ id: "r", date: out(5), value: 5000 }], "finance-expenses": [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((d) => ({ id: `g${d}`, date: out(d), value: 50 })) };
    expect(montar(s)!.financas).toBe("neutro");
    expect(CRITERIO_AZUL.ultimoGastoAPartirDoDia).toBe(24);
  });
  it("saiu mais do que entrou → neutro (o card não diz 'no vermelho' nem 'no azul')", () => {
    const s = { "finance-incomes": [{ id: "r", date: out(5), value: 100 }], "finance-expenses": [1, 4, 7, 10, 13, 16, 19, 22, 25, 28].map((d) => ({ id: `g${d}`, date: out(d), value: 50 })) };
    expect(montar(s)!.financas).toBe("neutro");
  });
  it("sem nenhuma entrada → neutro", () => {
    const s = { "finance-expenses": [1, 4, 7, 10, 13, 16, 19, 22, 25, 28].map((d) => ({ id: `g${d}`, date: out(d), value: 50 })) };
    expect(montar(s)!.financas).toBe("neutro");
  });
  it("mês completo e positivo → azul, com a corrida dos meses anteriores (agosto, setembro, outubro) e a %", () => {
    const f = montar(SEMENTE_COMPLETA)!.cards.find((c) => c.id === "financas")!.dados;
    expect(f.tipo).toBe("azul");
    if (f.tipo !== "azul") return;
    expect(f.meses.map((m) => m.mes)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(f.meses.at(-1)!.pct).toBe(21);
  });
});

describe("5. R$ escondido por padrão; texto das metas tapado", () => {
  it("o card de Finanças sai com valoresLigados false e sem 'R$' no desenho", () => {
    const f = montar(SEMENTE_COMPLETA)!.cards.find((c) => c.id === "financas")!.dados;
    expect(f.tipo === "azul" && f.valoresLigados).toBe(false);
    const { container, unmount } = render(<CardDeCompartilhar dados={f} formato="stories" />);
    expect(container.textContent).not.toMatch(/R\$/);
    unmount();
    const { container: c2 } = render(<CardDeCompartilhar dados={comEscolhas(f, { valores: true, textosDasMetas: false })} formato="stories" />);
    expect(c2.textContent).toMatch(/R\$\s?712/);
  });
  it("nenhum card da sequência leva R$ sem a escolha", () => {
    for (const c of montar(SEMENTE_COMPLETA)!.cards) {
      const { container, unmount } = render(<CardDeCompartilhar dados={c.dados} formato="stories" />);
      expect(container.textContent, c.id).not.toMatch(/R\$/);
      unmount();
    }
  });
  it("metas: os textos (pessoais) só com a escolha", () => {
    const m = montar(SEMENTE_COMPLETA)!.cards.find((c) => c.id === "metas")!.dados;
    const { container, unmount } = render(<CardDeCompartilhar dados={m} formato="stories" />);
    expect(container.textContent).not.toMatch(/Correr meus primeiros 5 km/);
    unmount();
    const { container: c2 } = render(<CardDeCompartilhar dados={comEscolhas(m, { valores: false, textosDasMetas: true })} formato="stories" />);
    expect(c2.textContent).toMatch(/Correr meus primeiros 5 km/);
  });
});

describe("6. o Treino tem cor própria", () => {
  it("não é mais o azul de Finanças, não repete nenhuma cor da sequência e passa no AA", () => {
    const treino = TEMAS.treinos.paradas[0];
    for (const outro of [TEMAS.lancamentos, TEMAS.habitos, TEMAS.agua, TEMAS.livros, TEMAS.metas, TEMAS["retro-abertura"]]) expect(outro.paradas[0]).not.toBe(treino);
    expect(treino).not.toBe("#2563eb");
    for (const p of TEMAS.treinos.paradas) expect(contraste("#ffffff", p)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("7. a chave retro_outubro e a data", () => {
  it("padrão: desligada no app e na web — outubro segue a retrospectiva de sempre", () => {
    expect(RETRO_OUTUBRO_APP).toBe("off");
    expect(RETRO_OUTUBRO_WEB).toBe("off");
    expect(retroOutubroLigada()).toBe(false);
    expect(retroOutubroAtiva(2026, 9, NOV)).toBe(false);
  });
  it("ligada pelo RevenueCat: só a partir de 01/11 no relógio do aparelho, e só pra outubro de 2026", () => {
    registrarRetroOutubroRemoto({ current: { metadata: { retro_outubro: "on" } }, all: {} });
    expect(retroOutubroLigada()).toBe(true);
    expect(retroOutubroAtiva(2026, 9, new Date(2026, 9, 31, 23, 59))).toBe(false);
    expect(retroOutubroAtiva(2026, 9, new Date(2026, 10, 1, 0, 0))).toBe(true);
    expect(retroOutubroAtiva(2026, 8, NOV)).toBe(false); // setembro continua o de sempre
    expect(outubroJaAcabou(new Date(2026, 9, 31, 23, 59))).toBe(false);
  });
  it("a current vence; metadata estranha não liga", () => {
    expect(lerChaveRemotaRetroOutubro({ current: { metadata: { retro_outubro: "off" } }, all: { x: { metadata: { retro_outubro: "on" } } } })).toBe("off");
    expect(lerChaveRemotaRetroOutubro({ current: { metadata: { retro_outubro: "talvez" } }, all: {} })).toBeNull();
  });
  it("?retro=outubro (QA na web) liga e abre antes de 01/11; ?retro=auto apaga; no app das lojas a força é ignorada", () => {
    guardarForcaRetroOutubro("?retro=outubro");
    expect(retroOutubroAtiva(2026, 9, new Date(2026, 9, 23))).toBe(true);
    guardarForcaRetroOutubro("?retro=auto");
    expect(retroOutubroAtiva(2026, 9, new Date(2026, 9, 23))).toBe(false);
    nativo.v = true;
    try { localStorage.setItem(CHAVE_FORCA_RETRO_OUTUBRO, "on"); } catch { /* */ }
    expect(retroOutubroLigada()).toBe(false);
  });
});

describe("8. a tela", () => {
  it("sem nada pra mostrar, mostra o que quem chamou mandou (a retrospectiva antiga)", async () => {
    const { RetroOutubro } = await import("@/components/compartilhar/RetroOutubro");
    render(<RetroOutubro ler={leitorDe({})} agora={NOV} onClose={() => {}} semDados={<div>a de sempre</div>} />);
    expect(screen.getByText("a de sempre")).toBeTruthy();
  });
  it("conta completa: abre na abertura, avança, conta os cards e as telas com mes: 'outubro'; R$ começa desligado", async () => {
    const { RetroOutubro } = await import("@/components/compartilhar/RetroOutubro");
    render(<RetroOutubro ler={leitorDe(SEMENTE_COMPLETA)} agora={NOV} onClose={() => {}} semDados={null} />);
    const tela = screen.getByTestId("retro-outubro");
    expect(tela.getAttribute("data-card-atual")).toBe("abertura");
    expect(screen.getByTestId("retro-postar").textContent).toMatch(/Postar nos Stories/);
    expect(screen.getByTestId("retro-salvar").textContent).toMatch(/Salvar/);
    const cards = eventos.find((e) => e.nome === "wrapped_cards")!;
    expect(cards.dados).toMatchObject({ mes: "outubro", cards: "abertura,financas,treino,rotina,agua,leitura,metas,resumo", pouco_dado: false });
    fireEvent.click(screen.getByTestId("retro-proximo"));
    expect(tela.getAttribute("data-card-atual")).toBe("financas");
    const sw = screen.getByTestId("retro-valores");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(eventos.filter((e) => e.nome === "wrapped_tela").map((e) => [e.dados.mes, e.dados.id])).toEqual([["outubro", "abertura"], ["outubro", "financas"]]);
  });
});
