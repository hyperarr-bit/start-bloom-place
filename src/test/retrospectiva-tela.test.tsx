/**
 * RETROSPECTIVA DE 01/10 — a tela (26/09; rodada 3: o SISTEMA DE TEMAS —
 * "Páginas de dentro" é o padrão, "Edição" e "Recortes" as outras peles).
 *  - aberta pela notificação com o app frio: espera o store, abre o mês,
 *    gera wrapped_open (origem notif) e acompanha a virada sem piscar;
 *  - "O setembro de Ana": o nome que a pessoa deu;
 *  - lê pelo store (chaves pesadas fora do localStorage);
 *  - dinheiro: sem R$ até tocar pra ver; sem renda, sem saldo; no vermelho,
 *    frase neutra (nunca "rombo"/"faltou");
 *  - card: interruptor de valores desligado; Salvar e Postar nos Stories;
 *  - pouco dado: capa + fatos + fecho, sem perfil nem %;
 *  - segurar pausa (e não vira a página);
 *  - foco do mês seguinte gravado em month-goals;
 *  - a entrada da Home (RetrospectivaNaHome);
 *  - os temas: padrão, chip "Tema" na capa, folha com as 3 capas, a escolha
 *    em `retro-tema`, wrapped_tema, `tema` no wrapped_open/wrapped_share e o
 *    "Estilo do card" (planner | o card do tema).
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const UID = "u-retro-tela";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-retro-tela", user_metadata: {} }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/avaliacao", () => ({ pedirAvaliacaoSePuder: vi.fn(async () => false) }));
vi.mock("@/components/wrapped/wrapped-share", async (orig) => ({
  ...(await orig<typeof import("@/components/wrapped/wrapped-share")>()),
  compartilharCard: vi.fn(async () => "shared"),
}));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { compartilharCard } from "@/components/wrapped/wrapped-share";
import { StoryPlanner } from "@/components/wrapped/CardPlanner";
import { StoryRevista } from "@/components/wrapped/tema-edicao";
import { StoryRecortes } from "@/components/wrapped/tema-recortes";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { MonthlyWrapped } from "@/components/wrapped/MonthlyWrapped";
import { RetrospectivaNaHome } from "@/components/wrapped/RetrospectivaNaHome";
import Retrospectiva from "@/pages/Retrospectiva";
import { construirRetroMes, conteudoDoCard, type Leitor, type RetroMes } from "@/lib/retrospectiva";

const ago = (dia: number) => `2026-08-${String(dia).padStart(2, "0")}`;
const set = (dia: number) => `2026-09-${String(dia).padStart(2, "0")}`;
const HOJE = new Date(2026, 8, 26, 12);
const DIA_1 = new Date(2026, 9, 1, 10, 0);
const leitor = (dados: Record<string, unknown>): Leitor => (chave) => dados[chave];

/* store controlável: `get` muda de identidade a cada mudança, como no app */
type Controle = { setLoaded: (v: boolean) => void; trocar: (d: Record<string, unknown>) => void; dados: () => Record<string, unknown> };
const Provedor = ({ inicial, loaded: l0 = true, controle, children }: {
  inicial: Record<string, unknown>; loaded?: boolean; controle: Controle; children?: React.ReactNode;
}) => {
  const [store, setStore] = useState<Record<string, unknown>>(inicial);
  const [loaded, setLoaded] = useState(l0);
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const setK = useCallback((k: string, v: unknown) => setStore((p) => ({ ...p, [k]: v })), []);
  controle.setLoaded = setLoaded;
  controle.trocar = setStore;
  controle.dados = () => store;
  const valor = useMemo<UserDataContextType>(
    () => ({ get, set: setK, loaded, isGuest: false, fetchKey: async () => null }), [get, setK, loaded],
  );
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const telaAtual = () => document.querySelector("[data-tela]")?.getAttribute("data-tela") ?? null;
const textoDaTela = () => document.querySelector("[data-tela]")?.textContent ?? "";
const nBarras = () => document.querySelectorAll("[data-barra]").length;
const zonaDireita = () => document.querySelector("div.absolute.inset-y-0.right-0") as HTMLElement;
const avancar = async () => {
  const antes = telaAtual();
  fireEvent.click(zonaDireita());
  await waitFor(() => expect(telaAtual()).not.toBe(antes));
};
/** Percorre a retrospectiva toda e devolve [id, texto] de cada página. */
const percorrer = async () => {
  await waitFor(() => expect(telaAtual()).toBe("capa"));
  const telas: [string, string][] = [];
  const total = nBarras();
  for (let i = 0; i < total; i++) {
    await act(() => new Promise((r) => setTimeout(r, 20))); // contagens animadas assentam
    telas.push([telaAtual()!, textoDaTela()]);
    if (i < total - 1) await avancar();
  }
  return telas;
};
const zonaEsquerda = () => document.querySelector("div.absolute.inset-y-0.left-0") as HTMLElement;
const voltar = async () => {
  const antes = telaAtual();
  fireEvent.click(zonaEsquerda());
  await waitFor(() => expect(telaAtual()).not.toBe(antes));
};
/** Vai até a página `id`: volta até a capa se preciso e avança a partir dela. */
const irPara = async (id: string) => {
  await waitFor(() => expect(telaAtual()).not.toBeNull());
  for (let i = 0; i < 12 && telaAtual() !== "capa" && telaAtual() !== id; i++) await voltar();
  for (let i = 0; i < 12 && telaAtual() !== id; i++) await avancar();
  expect(telaAtual()).toBe(id);
};

beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
  localStorage.clear();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  vi.mocked(compartilharCard).mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* ---------------------------------------------------------------- dados */

const gastosDeSetembro = Array.from({ length: 16 }, (_, i) => ({
  id: `s${i}`, date: set(2 + i), value: 30 + i, description: "Mercado", category: i % 2 ? "mercado" : "delivery", paymentMethod: "pix",
}));
const setembroNoBalde = {
  "core-user-name": "Ana Beatriz",
  "finance-incomes": [{ id: "r1", date: set(5), value: 5000, description: "Salário" }],
  "finance-expenses": gastosDeSetembro,
  "finance-fixed-expenses": [{ id: "fx1", description: "Aluguel", value: 2000, category: "moradia" }],
};
const setembroArquivado = {
  "core-user-name": "Ana Beatriz",
  "finance-2026-setembro-incomes": setembroNoBalde["finance-incomes"],
  "finance-2026-setembro-expenses": gastosDeSetembro,
  "finance-2026-setembro-fixed": setembroNoBalde["finance-fixed-expenses"],
  "finance-incomes": [], "finance-expenses": [],
  "finance-fixed-expenses": setembroNoBalde["finance-fixed-expenses"],
};

const gastosDeAgosto = Array.from({ length: 18 }, (_, i) => ({
  id: `g${i}`, date: ago(2 + i), value: 25 + i, description: "Compra", category: ["mercado", "delivery", "transporte"][i % 3], paymentMethod: i % 2 ? "pix" : "debito",
}));
const soGastos = () => construirRetroMes(2026, 7, UID, undefined, { agora: HOJE, ler: leitor({ "finance-2026-agosto-expenses": gastosDeAgosto }) })!;

const comRenda = (renda: number) => construirRetroMes(2026, 7, UID, undefined, {
  agora: HOJE,
  ler: leitor({
    "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: renda }],
    "finance-2026-agosto-expenses": gastosDeAgosto,
    "finance-2026-agosto-fixed": [{ id: "f", value: 1850, category: "moradia" }],
    "heatmap-log": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [ago(i + 1), true])),
    "saude-workout-log": [ago(2), ago(4), ago(6)],
  }),
})!;

/* ================================================================ testes */

describe("7/8. aberta pela notificação no dia 1º, com o app frio", () => {
  it("espera o store, abre setembro (ainda no balde) com o nome, conta wrapped_open 'notif' e segue firme quando a virada arquiva", async () => {
    vi.setSystemTime(DIA_1);
    const c = {} as Controle;
    render(
      <Provedor inicial={{}} loaded={false} controle={c}>
        <MemoryRouter initialEntries={["/retrospectiva?mes=Setembro"]}><Retrospectiva /></MemoryRouter>
      </Provedor>,
    );
    // nada de "primeira retrospectiva tá vindo" enquanto o store não chegou
    expect(screen.getByLabelText("Carregando a retrospectiva")).toBeInTheDocument();
    expect(screen.queryByText(/Sua primeira retrospectiva tá vindo/)).toBeNull();

    // o cache do aparelho chega (setembro ainda no balde corrente)
    act(() => c.trocar(setembroNoBalde));
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    // a capa do tema padrão: a etiqueta com o nome, o mês em foil, a grade dos dias e o lacre
    expect(textoDaTela()).toMatch(/O setembro de.*Ana Beatriz.*fechado em 30\/09 · 16 dias anotados.*Setembro.*2026.*Os 30 dias.*16 com algo anotado.*SETEMBRO · 2026 · FECHADO/);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_open", { month: "Setembro", origem: "notif", tema: "paginas" });
    expect(trackEvent).toHaveBeenCalledWith("wrapped_tela", { month: "Setembro", i: 0, id: "capa", curta: false });

    // o servidor termina e a virada arquiva: a retrospectiva continua aberta e igual
    act(() => c.setLoaded(true));
    act(() => c.trocar(setembroArquivado));
    await avancar();
    expect(telaAtual()).toBe("meu-mes");
    await waitFor(() => expect(textoDaTela()).toMatch(/16dias ?com a vida ?anotada/));
    expect(vi.mocked(trackEvent).mock.calls.filter(([e]) => e === "wrapped_open")).toHaveLength(1);

    // fechar pelo X: despedida com a página, o tempo e se chegou ao fim
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(trackEventBeacon).toHaveBeenCalledWith("wrapped_fechou", {
      month: "Setembro", tela: "meu-mes", segundos: expect.any(Number), completou: false,
    });
    expect(await screen.findByText("Setembro")).toBeInTheDocument(); // volta pra lista
  });

  it("mês pedido sem dado nenhum: depois da carga, mostra a lista (não fica esperando)", async () => {
    vi.setSystemTime(DIA_1);
    const c = {} as Controle;
    render(
      <Provedor inicial={{}} loaded={false} controle={c}>
        <MemoryRouter initialEntries={["/retrospectiva?mes=Setembro"]}><Retrospectiva /></MemoryRouter>
      </Provedor>,
    );
    act(() => c.setLoaded(true));
    expect(await screen.findByText(/Sua primeira retrospectiva tá vindo/)).toBeInTheDocument();
  });
});

describe("4. a lista lê pelo store", () => {
  it("livro terminado que só existe no store (chave pesada, fora do localStorage) aparece", () => {
    const c = {} as Controle;
    render(
      <Provedor controle={c} inicial={{
        "heatmap-log": { [ago(3)]: true },
        "lib-books": [{ title: "Tudo é Rio", status: "lido", endDate: ago(20), pages: 210 }],
      }}>
        <MemoryRouter initialEntries={["/retrospectiva"]}><Retrospectiva /></MemoryRouter>
      </Provedor>,
    );
    expect(screen.getByText("Agosto")).toBeInTheDocument();
    expect(screen.getByText("1 dia ativo · 1 livro")).toBeInTheDocument();
  });
});

describe("1. dinheiro: sem R$ até tocar pra ver, e nunca uma narrativa de prejuízo", () => {
  it("sem renda: gastos anotados, pódio em %, dias sem gastar; ao revelar, só o que saiu", async () => {
    render(<MonthlyWrapped retro={soGastos()} onClose={() => {}} nome="Carla" />);
    const telas = await percorrer();
    expect(telas.map(([id]) => id)).toEqual(["capa", "meu-mes", "dinheiro", "card"]);
    expect(telas[0][1]).toMatch(/O agosto de.*Carla/);
    const tudo = telas.map(([, t]) => t).join(" | ");
    expect(tudo).not.toMatch(/faltaram|faltou|sobraram|rombo|apertado|Turbulento|saiu mais do que entrou|A real de/i);
    const dinheiro = telas[2][1];
    expect(dinheiro).toMatch(/18gastos ?anotados/);
    expect(dinheiro).toMatch(/Pra onde foi.*%/i);
    expect(dinheiro).toMatch(/dias sem gastar nada/i);
    expect(dinheiro).not.toMatch(/R\$\s?\d/); // nenhum valor antes do toque

    await irPara("dinheiro");
    fireEvent.click(screen.getByRole("button", { name: /Tocar pra ver/ }));
    expect(screen.getByTestId("valores-revelados").textContent).toMatch(/Saiu R\$ 603 em agosto\..*Anote também o que entra/);
    expect(textoDaTela()).not.toMatch(/faltou|rombo|sobrou/i);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_valores", { month: "Agosto" });
  });

  it("com renda e no vermelho: frase neutra só dentro do app ('setembro é página nova')", async () => {
    render(<MonthlyWrapped retro={comRenda(1000)} onClose={() => {}} />);
    await irPara("dinheiro");
    fireEvent.click(screen.getByRole("button", { name: /Tocar pra ver/ }));
    const revelado = screen.getByTestId("valores-revelados").textContent ?? "";
    expect(revelado).toMatch(/Entrou R\$ 1\.000 · saiu R\$ 2\.453/);
    expect(revelado).toMatch(/Saiu R\$ 1\.453 a mais do que entrou — setembro é página nova\./);
    expect(textoDaTela()).not.toMatch(/rombo|faltou|apertado/i);
  });
});

describe("2. o card: sem valores por padrão; Salvar e Postar nos Stories", () => {
  it("interruptor desligado; cada botão compartilha com o destino dele; ligar põe os R$ no card", async () => {
    render(<MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} nome="ana beatriz" />);
    await irPara("card");
    // o card do planner (o de todos os temas): etiqueta, perfil, números e o lacre
    const card = screen.getByTestId("card-da-retro");
    expect(card).toHaveAttribute("data-card", "planner");
    expect(card.textContent).toMatch(/O agosto de.*Ana Beatriz.*20 dias anotados, 20 seguidos/);
    expect(card.textContent).toMatch(/AGOSTO · 2026 · FECHADO/);
    expect(card.textContent).not.toMatch(/R\$/);

    const chave = screen.getByRole("switch", { name: /Mostrar valores em R\$/ });
    expect(chave).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(compartilharCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(compartilharCard).mock.calls[0].slice(1)).toEqual(["Agosto", "salvar"]);
    // a arte que vai pros Stories é a do planner ("Agosto, fechado.")
    expect((vi.mocked(compartilharCard).mock.calls[0][0] as React.ReactElement).type).toBe(StoryPlanner);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_share", { month: "Agosto", valores: false, destino: "salvar", tema: "paginas", card: "planner" });

    fireEvent.click(chave);
    expect(chave).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("card-da-retro").textContent).toMatch(/R\$ 6\.200.*ENTROU/);
    fireEvent.click(screen.getByRole("button", { name: /Postar nos Stories/ }));
    await waitFor(() => expect(compartilharCard).toHaveBeenCalledTimes(2));
    expect(vi.mocked(compartilharCard).mock.calls[1].slice(1)).toEqual(["Agosto", "stories"]);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_share", { month: "Agosto", valores: true, destino: "stories", tema: "paginas", card: "planner" });
    expect(telaAtual()).toBe("card"); // tocar nos controles não fecha nem vira a página
  });
});

describe("9. pouco dado: versão curta", () => {
  it("3 dias de uso: capa curta, 1 fato de verdade e o fecho — sem perfil, sem %, sem saldo", async () => {
    const r: RetroMes = construirRetroMes(2026, 7, UID, undefined, {
      agora: HOJE,
      ler: leitor({
        "finance-2026-agosto-expenses": [{ id: "n1", date: ago(27), value: 23 }, { id: "n2", date: ago(28), value: 64 }, { id: "n3", date: ago(29), value: 19 }],
        "saude-workout-log": [ago(28), ago(29)],
        "heatmap-log": { [ago(28)]: true, [ago(29)]: true },
      }),
    })!;
    expect(r.curta).toBe(true);
    const onClose = vi.fn();
    render(<MonthlyWrapped retro={r} onClose={onClose} />);
    const telas = await percorrer();
    expect(telas.map(([id]) => id)).toEqual(["capa", "fato", "fecho"]);
    expect(telas[0][1]).toMatch(/Retrospectiva.*O seu agosto.*começou dia 27.*Seus primeiros.*3.*dias.*De 27 a 31 de agosto/);
    const tudo = telas.map(([, t]) => t).join(" | ");
    expect(tudo).toContain("2treinos registrados");
    expect(telas[1][1]).toMatch(/1 fato de verdade.*Por que isso importa/);
    expect(telas[2][1]).toMatch(/Cada registro conta\..*a de setembro chega completa.*Voltar pro planner/);
    expect(tudo).not.toMatch(/%|perfil|R\$|faltaram|Turbulento/i);
    // tocar no fim fecha, e a despedida diz que chegou ao fim
    fireEvent.click(zonaDireita());
    expect(onClose).toHaveBeenCalled();
    cleanup();
    expect(trackEventBeacon).toHaveBeenCalledWith("wrapped_fechou", expect.objectContaining({ tela: "fecho", completou: true }));
  });
});

describe("stories: segurar pausa e não vira a página", () => {
  it("dedo pousado mais de 350 ms e solto: continua na mesma página; um toque vira", async () => {
    render(<MonthlyWrapped retro={soGastos()} onClose={() => {}} />);
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    const zona = zonaDireita();
    fireEvent.pointerDown(zona);
    // a barra da página congela enquanto segura
    expect((document.querySelector("[data-barra] b") as HTMLElement).style.animationPlayState).toBe("paused");
    vi.setSystemTime(new Date(HOJE.getTime() + 800));
    fireEvent.pointerUp(zona);
    fireEvent.click(zona);
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(telaAtual()).toBe("capa");
    await avancar();
    expect(telaAtual()).toBe("meu-mes");
  });
});

describe("foco: 1 foco pro mês que começa, gravado em month-goals", () => {
  it("escolher a sugestão e anotar grava em outubro (sem duplicar) e mostra o post-it", async () => {
    vi.setSystemTime(DIA_1);
    const c = {} as Controle;
    const retro = construirRetroMes(2026, 8, UID, undefined, { agora: DIA_1, ler: leitor(setembroArquivado) })!;
    render(
      <Provedor inicial={{ "month-goals": { "2026-10": [{ id: "x", text: "Anotar todo gasto", done: false }] } }} controle={c}>
        <MonthlyWrapped retro={retro} onClose={() => {}} agora={DIA_1} />
      </Provedor>,
    );
    await irPara("foco");
    expect(textoDaTela()).toMatch(/Foco de outubro.*Escolha 1 foco.*pro mês.*aba Mês/);
    // cada opção diz de onde veio; a 1ª já vem marcada (desenho do designer)
    expect(screen.getByRole("button", { name: /Anotar todo gasto/ }).textContent).toMatch(/16 anotados/);
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Anotar todo gasto/ }));
    expect(screen.getByRole("button", { name: /Anotar todo gasto/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Guardar foco/ }));
    expect(screen.getByTestId("foco-salvo").textContent).toContain("Anotar todo gasto");
    // já existia: não duplica
    expect((c.dados()["month-goals"] as Record<string, unknown[]>)["2026-10"]).toHaveLength(1);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_foco", { month: "Setembro", sugestao: true });
  });

  it("escrever o próprio foco grava no mês novo", async () => {
    vi.setSystemTime(DIA_1);
    const c = {} as Controle;
    const retro = construirRetroMes(2026, 8, UID, undefined, { agora: DIA_1, ler: leitor(setembroArquivado) })!;
    render(<Provedor inicial={{}} controle={c}><MonthlyWrapped retro={retro} onClose={() => {}} agora={DIA_1} /></Provedor>);
    await irPara("foco");
    fireEvent.change(screen.getByLabelText("Seu foco pro mês"), { target: { value: "Caminhar 3x por semana" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar foco/ }));
    expect(c.dados()["month-goals"]).toEqual({ "2026-10": [expect.objectContaining({ text: "Caminhar 3x por semana", done: false })] });
  });

  it("retrospectiva de um mês antigo não pede foco (o mês seguinte já passou)", async () => {
    const c = {} as Controle;
    const retro = construirRetroMes(2026, 6, UID, undefined, {
      agora: HOJE, ler: leitor({ "saude-workout-log": Array.from({ length: 16 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`) }),
    })!;
    render(<Provedor inicial={{}} controle={c}><MonthlyWrapped retro={retro} onClose={() => {}} agora={HOJE} /></Provedor>);
    const telas = await percorrer();
    expect(telas.map(([id]) => id)).not.toContain("foco");
  });
});

describe("a retrospectiva na Home", () => {
  const home = (agora: Date, inicial: Record<string, unknown>, c = {} as Controle) =>
    render(<Provedor inicial={inicial} controle={c}><MemoryRouter><RetrospectivaNaHome agora={agora} /></MemoryRouter></Provedor>);

  it("nos 10 primeiros dias, com o mês anterior anotado: aparece; o X dispensa aquele mês", () => {
    const c = {} as Controle;
    home(new Date(2026, 9, 3, 9), setembroArquivado, c);
    expect(screen.getByText("Sua retrospectiva de setembro tá pronta")).toBeInTheDocument();
    expect(screen.getByText("16 páginas preenchidas. Bora folhear?")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith("wrapped_home_visto", { month: "Setembro" });
    fireEvent.click(screen.getByLabelText("Dispensar retrospectiva"));
    expect(screen.queryByTestId("retrospectiva-na-home")).toBeNull();
    expect(c.dados()["retro-home-dispensada"]).toBe("2026-09");
  });

  it("depois do dia 10, ou sem nada no mês anterior: não aparece", () => {
    home(new Date(2026, 9, 15, 9), setembroArquivado);
    expect(screen.queryByTestId("retrospectiva-na-home")).toBeNull();
    cleanup();
    home(new Date(2026, 9, 3, 9), {});
    expect(screen.queryByTestId("retrospectiva-na-home")).toBeNull();
  });
});

describe("TEMAS (26/09): padrão, chip na capa, folha com as 3 capas, retro-tema e eventos", () => {
  const raiz = () => screen.getByTestId("retrospectiva");

  it("sem escolha: abre no planner; o chip 'Tema' mora na capa e na tela do card", async () => {
    const c = {} as Controle;
    render(<Provedor inicial={{}} controle={c}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} nome="Ana" agora={HOJE} /></Provedor>);
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    expect(raiz()).toHaveAttribute("data-tema", "paginas");
    expect(screen.getByRole("button", { name: /Trocar o tema/ })).toBeInTheDocument();
    await avancar();
    expect(screen.queryByRole("button", { name: /Trocar o tema/ })).toBeNull();
    await irPara("card");
    fireEvent.click(screen.getByRole("button", { name: /Trocar o tema/ }));
    fireEvent.click(screen.getByRole("button", { name: /Edição de Agosto/ }));
    // trocou na tela do card: continua no card, agora com o "Estilo do card" da revista
    await waitFor(() => expect(raiz()).toHaveAttribute("data-tema", "edicao"));
    expect(telaAtual()).toBe("card");
    expect(screen.getByRole("radio", { name: "Revista" })).toBeInTheDocument();
  });

  it("versão curta: 3 páginas na barra; o foco abre pelo link do fecho e grava em month-goals", async () => {
    const c = {} as Controle;
    const r = construirRetroMes(2026, 7, UID, undefined, {
      agora: HOJE,
      ler: leitor({ "saude-workout-log": [ago(28), ago(29)], "heatmap-log": { [ago(28)]: true, [ago(29)]: true } }),
    })!;
    expect(r.curta).toBe(true);
    const onClose = vi.fn();
    render(<Provedor inicial={{}} controle={c}><MonthlyWrapped retro={r} onClose={onClose} agora={HOJE} /></Provedor>);
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    expect(nBarras()).toBe(3);
    await avancar();
    await avancar();
    expect(telaAtual()).toBe("fecho");
    fireEvent.click(screen.getByRole("button", { name: /Escolher 1 foco pra setembro/ }));
    await waitFor(() => expect(telaAtual()).toBe("foco"));
    expect(nBarras()).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Guardar foco/ }));
    expect((c.dados()["month-goals"] as Record<string, unknown[]>)["2026-09"]).toHaveLength(1);
    // de volta ao fecho, tocar pra frente fecha (o foco não é a 4ª página)
    await voltar();
    expect(telaAtual()).toBe("fecho");
    fireEvent.click(zonaDireita());
    expect(onClose).toHaveBeenCalled();
  });

  it("trocar pela folha grava retro-tema, troca a pele na hora e conta wrapped_tema (uma vez só)", async () => {
    const c = {} as Controle;
    render(<Provedor inicial={{}} controle={c}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} nome="Ana Beatriz" agora={HOJE} /></Provedor>);
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    fireEvent.click(screen.getByRole("button", { name: /Trocar o tema/ }));
    const folha = screen.getByTestId("folha-de-tema");
    expect(folha.textContent).toMatch(/Tema da retrospectiva.*Muda as páginas\. O card final é sempre o do planner\./);
    // as 3 miniaturas são as capas de verdade, com o nome da pessoa
    const opcoes = screen.getAllByRole("button", { name: /Páginas de dentro|Edição de Agosto|Recortes/ });
    expect(opcoes.map((b) => b.getAttribute("aria-label"))).toEqual(["Páginas de dentro (atual)", "Edição de Agosto", "Recortes"]);
    expect(folha.textContent).toMatch(/Ingresso/); // a capa dos recortes está lá dentro
    // escolher o que já está: só fecha
    fireEvent.click(opcoes[0]);
    expect(screen.queryByTestId("folha-de-tema")).toBeNull();
    expect(vi.mocked(trackEvent).mock.calls.filter(([e]) => e === "wrapped_tema")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Trocar o tema/ }));
    fireEvent.click(screen.getByRole("button", { name: "Recortes" }));
    expect(c.dados()["retro-tema"]).toBe("recortes");
    await waitFor(() => expect(raiz()).toHaveAttribute("data-tema", "recortes"));
    expect(telaAtual()).toBe("capa"); // continua na mesma página, agora na outra pele
    expect(textoDaTela()).toMatch(/Ingresso.*válido pra 1 pessoa/);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_tema", { month: "Agosto", tema: "recortes", de: "paginas" });
  });

  it("a escolha salva abre direto no tema; lixo na chave cai no padrão", async () => {
    const c = {} as Controle;
    render(<Provedor inicial={{ "retro-tema": "edicao" }} controle={c}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} nome="Ana" agora={HOJE} /></Provedor>);
    await waitFor(() => expect(telaAtual()).toBe("capa"));
    expect(raiz()).toHaveAttribute("data-tema", "edicao");
    expect(textoDaTela()).toMatch(/Edição nº 08 · Agosto de 2026.*Nesta edição/);
    cleanup();
    render(<Provedor inicial={{ "retro-tema": "xyz" }} controle={{} as Controle}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} agora={HOJE} /></Provedor>);
    await waitFor(() => expect(raiz()).toHaveAttribute("data-tema", "paginas"));
  });

  it("revista: o card padrão é o do planner; 'Estilo do card' troca pra revista e o compartilhar leva a arte dela", async () => {
    const c = {} as Controle;
    render(<Provedor inicial={{ "retro-tema": "edicao" }} controle={c}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} nome="Ana" agora={HOJE} /></Provedor>);
    await irPara("card");
    expect(screen.getByTestId("card-da-retro")).toHaveAttribute("data-card", "planner");
    const planner = screen.getByRole("radio", { name: "Planner" });
    expect(planner).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Revista" }));
    const card = screen.getByTestId("card-da-retro");
    expect(card).toHaveAttribute("data-card", "revista");
    expect(card.textContent).toMatch(/CORE.*Nº 08 · AGOSTO DE 2026.*O agosto de Ana foi/);
    expect(card.textContent).not.toMatch(/R\$/);
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(compartilharCard).toHaveBeenCalledTimes(1));
    expect((vi.mocked(compartilharCard).mock.calls[0][0] as React.ReactElement).type).toBe(StoryRevista);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_share", { month: "Agosto", valores: false, destino: "salvar", tema: "edicao", card: "revista" });
    // com valores: as linhas da capa ganham os R$ (entrou/saiu/sobrou), nunca "faltou"
    fireEvent.click(screen.getByRole("switch", { name: /Mostrar valores em R\$/ }));
    expect(screen.getByTestId("card-da-retro").textContent).toMatch(/R\$ 6\.200entrou.*R\$ 2\.453saiu.*R\$ 3\.747sobrou/);
    expect(screen.getByTestId("card-da-retro").textContent).not.toMatch(/faltou|rombo/i);
  });

  it("recortes: o card padrão também é o do planner; o estilo 'Recortes' troca a arte e nada escrito pela pessoa entra", async () => {
    const r = construirRetroMes(2026, 7, UID, undefined, {
      agora: HOJE,
      ler: leitor({
        "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: 6200 }],
        "finance-2026-agosto-expenses": gastosDeAgosto,
        "heatmap-log": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [ago(i + 1), true])),
        "saude-workout-log": [ago(2), ago(4), ago(6)],
        "month-retro": { "2026-08": "Agosto foi o mês em que eu parei de adiar as coisas." },
      }),
    })!;
    render(<Provedor inicial={{ "retro-tema": "recortes" }} controle={{} as Controle}><MonthlyWrapped retro={r} onClose={() => {}} nome="Ana" agora={HOJE} /></Provedor>);
    await irPara("card");
    expect(screen.getByTestId("card-da-retro")).toHaveAttribute("data-card", "planner");
    fireEvent.click(screen.getByRole("radio", { name: "Recortes" }));
    const card = screen.getByTestId("card-da-retro");
    expect(card).toHaveAttribute("data-card", "recortes");
    expect(card.textContent).toMatch(/AGOSTO · 2026.*O agosto de Ana foi.*um mês pra guardar/);
    expect(card.textContent).not.toMatch(/R\$|adiar/);
    // com valores: o cupom "O MÊS EM R$" entra no card (só se a pessoa ligar)
    fireEvent.click(screen.getByRole("switch", { name: /Mostrar valores em R\$/ }));
    expect(screen.getByTestId("cupom-do-card").textContent).toMatch(/O MÊS EM R\$.*entrou.*R\$ 6\.200/);
    fireEvent.click(screen.getByRole("button", { name: /Postar nos Stories/ }));
    await waitFor(() => expect(compartilharCard).toHaveBeenCalledTimes(1));
    expect((vi.mocked(compartilharCard).mock.calls[0][0] as React.ReactElement).type).toBe(StoryRecortes);
    expect(trackEvent).toHaveBeenCalledWith("wrapped_share", { month: "Agosto", valores: true, destino: "stories", tema: "recortes", card: "recortes" });
  });

  it("a arte dos Stories do planner: 'Agosto, fechado.', a página e o rodapé; R$ só com o interruptor", () => {
    const { container, unmount } = render(<StoryPlanner c={conteudoDoCard(comRenda(6200), { nome: "ana beatriz" })} />);
    expect(container.textContent).toMatch(/Agosto, fechado\..*O agosto de.*Ana Beatriz.*Perfil do mês.*Os 31 dias.*CORE · ORGANIZE SUA VIDA/);
    expect(container.textContent).not.toMatch(/R\$/);
    unmount();
    const comValores = render(<StoryPlanner c={conteudoDoCard(comRenda(6200), { nome: "ana beatriz", valores: true })} />);
    expect(comValores.container.textContent).toMatch(/R\$ 6\.200.*ENTROU/);
  });

  it("o planner não tem 'Estilo do card' (o card dele é o padrão)", async () => {
    render(<Provedor inicial={{}} controle={{} as Controle}><MonthlyWrapped retro={comRenda(6200)} onClose={() => {}} agora={HOJE} /></Provedor>);
    await irPara("card");
    expect(screen.queryByRole("radiogroup", { name: "Estilo do card" })).toBeNull();
  });

  it("wrapped_open pela lista leva o tema salvo", async () => {
    const c = {} as Controle;
    render(
      <Provedor controle={c} inicial={{ "retro-tema": "recortes", "heatmap-log": Object.fromEntries(Array.from({ length: 12 }, (_, i) => [ago(i + 1), true])), "saude-workout-log": [ago(2), ago(4), ago(6)] }}>
        <MemoryRouter initialEntries={["/retrospectiva"]}><Retrospectiva /></MemoryRouter>
      </Provedor>,
    );
    fireEvent.click(screen.getByText("Agosto"));
    expect(trackEvent).toHaveBeenCalledWith("wrapped_open", { month: "Agosto", origem: "lista", tema: "recortes" });
    await waitFor(() => expect(screen.getByTestId("retrospectiva")).toHaveAttribute("data-tema", "recortes"));
  });
});
