/**
 * ABAS "CADERNO" COM SUMÁRIO (07/11, SPEC novidades-guardadas/2026-11-07/trial-abas/SPEC.md).
 *
 * Trava: (1) as chaves — padrão = app de hoje; remota só no iPhone; braço estável e igual pro mesmo id; forças de QA;
 * campos dos eventos só fora do padrão; (2) os ids das abas e o ABAS_QUE_NUNCA_SAEM não mudaram; (3) o SUMÁRIO: abrir
 * não grava; a linha abre a aba tracejada sem gravar e ela sai da fileira ao trocar; o marcador grava SÓ aquela aba, no
 * mesmo tipo (string[]); a última à vista trava; "Pôr todas" = o "Mostrar todas" de hoje; (4) braço TODAS = sem padrão
 * enxuto; (5) visual caderno/fixa: porta presa fora da faixa, ids/`data-spotlight` iguais, conta antiga não muda;
 * (6) links e dicas que abrem aba guardada continuam abrindo; (7) a medição nova: `aba_aberta` com origem, `origem` nos
 * eventos, `uso_modulo` 1x por chave por dia, *-last-seen-* não vira first_transaction; (8) frases e 3ª dica.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const ativacoes = vi.hoisted(() => [] as string[]);
const plataforma = vi.hoisted(() => ({ nativo: false, ios: false }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: (a: string) => { ativacoes.push(a); return Promise.resolve(); },
}));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isIOS: () => plataforma.ios,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useAbasOcultas, usePortaDoSumario, type AbaOcultavel } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { _zerarTodasAsAbas, abasEnxutasLigada } from "@/lib/abas-ocultas";
import { ABAS_POUCO_USO, ABAS_QUE_NUNCA_SAEM } from "@/lib/abas-enxutas";
import { CHAVE_ORIGEM_CONTA, _zerarHomeNova } from "@/lib/home-nova";
import {
  ABAS_MEDICAO_PADRAO, ABAS_MODO_PADRAO, ABAS_VISUAL_PADRAO, CHAVE_ABAS_BRACO, CHAVE_ABAS_MODO_APARELHO, CHAVE_ABAS_VISUAL_APARELHO,
  CHAVE_FORCA_ABAS_BRACO, CHAVE_FORCA_ABAS_MEDICAO, CHAVE_FORCA_ABAS_VISUAL, _zerarAbasCaderno, bracoAbas, camposAbasCaderno,
  guardarForcaAbasCaderno, medicaoAbasLigada, modoAbas, registrarAbasRemoto, sortearBracoAbas, usoModuloPrimeiraVezHoje, visualAbas,
} from "@/lib/abas-caderno";
import { FRASE_DA_ABA, tituloDasGuardadas } from "@/lib/abas-sumario";
import { DICA_SUMARIO, EVENTO_ABRIR_ABA, EVENTO_ORGANIZAR_ABAS } from "@/lib/dicas-do-modulo";
import { CHAVES_DO_APARELHO, vassouraLeva } from "@/lib/chaves-do-aparelho";

const FIN: AbaOcultavel[] = [
  { id: "dashboard", label: "DASHBOARD", icon: "📊" },
  { id: "financeiro", label: "MEU FINANCEIRO", icon: "💰", spotlight: "financeiro" },
  { id: "investimentos", label: "INVESTIMENTOS", icon: "📈" },
  { id: "itens", label: "DESEJOS", icon: "❤️" },
  { id: "simuladores", label: "SIMULADORES", icon: "🧮" },
  { id: "limites", label: "LIMITES", icon: "🎯" },
  { id: "relatorios", label: "RELATÓRIOS", icon: "📋" },
  { id: "saude", label: "SAÚDE FINANCEIRA", icon: "💚" },
];
const OCULTAS_FIN = ["investimentos", "itens", "simuladores", "limites", "relatorios", "saude"];

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { escritas.push(key); dados[key] = JSON.parse(JSON.stringify(value)); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
const Com = ({ store, children }: { store: ReturnType<typeof criarStore>; children: ReactNode }) => (
  <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>
);
const Pagina = ({ inicial = "financeiro" }: { inicial?: string }) => {
  const [ativa, setAtiva] = useState(inicial);
  const abas = useAbasOcultas("financas", FIN);
  return (
    <div>
      <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} />
      <p data-testid="ativa">{ativa}</p>
      <button type="button" onClick={() => setAtiva("limites")}>atalho limites</button>
    </div>
  );
};
const NOVA = { [CHAVE_ORIGEM_CONTA]: { tipo: "nova" } };
const ANTIGA = { [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } };
const naFileira = () => Array.from(document.querySelectorAll<HTMLElement>("[data-spotlight]")).map((b) => b.getAttribute("data-spotlight"));
const linha = (id: string) => document.querySelector<HTMLElement>(`[data-testid="sumario-linha"][data-aba="${id}"]`)!;
const nomes = () => eventos.map((e) => e[0]);
const iPhone = () => { plataforma.nativo = true; plataforma.ios = true; };
const offerings = (metadata: Record<string, unknown>) => ({ current: { identifier: "x", metadata }, all: { x: { identifier: "x", metadata } } });

beforeEach(() => {
  eventos.length = 0; ativacoes.length = 0;
  plataforma.nativo = false; plataforma.ios = false;
  localStorage.clear();
  _zerarTodasAsAbas(); _zerarHomeNova(); _zerarAbasCaderno();
});
afterEach(() => cleanup());

/* ------------------------------------------------------------------ 1. as chaves */
describe("as chaves (padrão = o app de hoje)", () => {
  it("padrões: enxuto de hoje, fileira de hoje, medição de antes; nenhum campo novo nos eventos", () => {
    expect([ABAS_MODO_PADRAO, ABAS_VISUAL_PADRAO, ABAS_MEDICAO_PADRAO]).toEqual(["on", "hoje", "off"]);
    for (const nativo of [false, true]) {
      plataforma.nativo = nativo; plataforma.ios = nativo;
      expect(modoAbas()).toBe("on");
      expect(bracoAbas()).toBe("hoje");
      expect(visualAbas()).toBe("hoje");
      expect(medicaoAbasLigada()).toBe(false);
      expect(camposAbasCaderno()).toEqual({});
      expect(abasEnxutasLigada()).toBe(true);
    }
    expect(localStorage.getItem(CHAVE_ABAS_BRACO)).toBeNull(); // com o padrão, nada é sorteado nem gravado
  });

  it("a chave remota só vale no iPhone (site e Android ignoram a metadata)", () => {
    const meta = offerings({ abas_enxutas: "sumario", abas_visual: "caderno", abas_medicao: "on" });
    for (const [nativo, ios] of [[false, false], [true, false]] as const) {
      plataforma.nativo = nativo; plataforma.ios = ios;
      registrarAbasRemoto(meta);
      expect(bracoAbas()).toBe("hoje");
      expect(visualAbas()).toBe("hoje");
      expect(medicaoAbasLigada()).toBe(false);
      expect(localStorage.getItem(CHAVE_ABAS_MODO_APARELHO)).toBeNull();
    }
    iPhone();
    registrarAbasRemoto(meta);
    expect(bracoAbas()).toBe("sumario");
    expect(visualAbas()).toBe("caderno");
    expect(medicaoAbasLigada()).toBe(true);
    expect(camposAbasCaderno()).toEqual({ abas_braco: "sumario", abas_visual: "caderno" });
    // a última resposta fica no aparelho (próxima abertura sem rede)
    _zerarAbasCaderno();
    expect(localStorage.getItem(CHAVE_ABAS_VISUAL_APARELHO)).toBe("caderno");
    expect(visualAbas()).toBe("caderno");
    // valor estranho não muda nada; rollback "on"/"hoje" volta pro app de hoje
    registrarAbasRemoto(offerings({ abas_enxutas: "talvez", abas_visual: 3 }));
    expect(visualAbas()).toBe("caderno");
    registrarAbasRemoto(offerings({ abas_enxutas: "on", abas_visual: "hoje" }));
    expect(bracoAbas()).toBe("hoje");
    expect(visualAbas()).toBe("hoje");
  });

  it("sorteio: determinístico pelo id, gravado 1x por modo, e os braços saem equilibrados", () => {
    expect(sortearBracoAbas("aparelho-1", ["hoje", "todas", "sumario"])).toBe(sortearBracoAbas("aparelho-1", ["hoje", "todas", "sumario"]));
    const conta = { hoje: 0, todas: 0, sumario: 0 } as Record<string, number>;
    for (let i = 0; i < 3000; i++) conta[sortearBracoAbas(`id-${i}`, ["hoje", "todas", "sumario"])] += 1;
    for (const n of Object.values(conta)) expect(n).toBeGreaterThan(850);
    const dois = { hoje: 0, sumario: 0 } as Record<string, number>;
    for (let i = 0; i < 2000; i++) dois[sortearBracoAbas(`id-${i}`, ["hoje", "sumario"])] += 1;
    expect(dois.hoje).toBeGreaterThan(850); expect(dois.sumario).toBeGreaterThan(850);

    iPhone();
    registrarAbasRemoto(offerings({ abas_enxutas: "abc" }));
    const b = bracoAbas();
    expect(localStorage.getItem(CHAVE_ABAS_BRACO)).toBe(`abc:${b}`);
    for (let i = 0; i < 5; i++) { _zerarAbasCaderno(); expect(bracoAbas()).toBe(b); } // estável entre aberturas
    expect(camposAbasCaderno().abas_braco).toBe(b);
  });

  it("forças de QA por URL: braço, visual e medição; `auto` desfaz; ?abas-enxutas=off vence o braço", () => {
    guardarForcaAbasCaderno("?abas-braco=sumario&abas-visual=fixa&abas-medicao=on");
    expect(localStorage.getItem(CHAVE_FORCA_ABAS_BRACO)).toBe("sumario");
    expect(bracoAbas()).toBe("sumario");
    expect(visualAbas()).toBe("fixa");
    expect(medicaoAbasLigada()).toBe(true);
    guardarForcaAbasCaderno("?abas-braco=todas");
    expect(abasEnxutasLigada()).toBe(false); // braço todas = sem o padrão enxuto
    localStorage.setItem("forcar-abas-enxutas", "on");
    expect(abasEnxutasLigada()).toBe(true); // a força de antes vence o braço
    localStorage.removeItem("forcar-abas-enxutas");
    guardarForcaAbasCaderno("?abas-braco=auto&abas-visual=auto&abas-medicao=auto&lixo=1");
    expect([localStorage.getItem(CHAVE_FORCA_ABAS_BRACO), localStorage.getItem(CHAVE_FORCA_ABAS_VISUAL), localStorage.getItem(CHAVE_FORCA_ABAS_MEDICAO)]).toEqual([null, null, null]);
    expect(bracoAbas()).toBe("hoje");
    // as forças ficam fora dos prefixos varridos; as core-* novas estão nas chaves do aparelho (as 2 vassouras usam a lista)
    for (const k of [CHAVE_FORCA_ABAS_BRACO, CHAVE_FORCA_ABAS_VISUAL, CHAVE_FORCA_ABAS_MEDICAO]) expect(vassouraLeva(k)).toBe(false);
    for (const k of ["core-abas-enxutas", "core-abas-visual", "core-abas-medicao", "core-abas-braco", "core-uso-modulo-dia"]) {
      expect(CHAVES_DO_APARELHO.has(k), k).toBe(true);
      expect(vassouraLeva(k), k).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ 2. ids */
describe("nenhuma aba muda de id nem sai do app", () => {
  it("ABAS_POUCO_USO e ABAS_QUE_NUNCA_SAEM são os de antes do caderno", () => {
    expect(ABAS_POUCO_USO).toEqual({
      financas: ["investimentos", "itens", "simuladores", "limites", "relatorios", "saude"], rotina: ["diario", "revisao"], saude: [], treino: [],
      dieta: ["jejum", "receitas"], beleza: [], casa: ["utilidades", "rotina", "cardapio", "coop", "seguranca", "manutencao"],
      biblioteca: ["desafio", "emprestados", "insights"], desenvolvimento: ["desafios", "gratidao", "respiracao", "carta"],
      estudos: ["caderno", "tarefas", "grade"], relacionamentos: ["momentos", "presentes"], detox: ["conquistas", "stats", "diario"],
      hiperfoco: ["sonhos", "estrategia", "timeline", "busca"], carreira: ["skills", "network", "interview", "portfolio"], pet: ["gastos", "diario"],
      viagens: ["cronograma", "countdown", "mala", "lugares", "seguranca", "passeios", "divisor", "moeda", "diario"],
    });
    expect(ABAS_QUE_NUNCA_SAEM).toEqual({
      financas: ["financeiro", "dashboard"], rotina: ["semana"], treino: ["hoje", "plano"], saude: ["hoje"], desenvolvimento: ["sobre", "metas"],
      casa: ["comodos", "mercado"], viagens: ["destinos"], carreira: ["dia"], biblioteca: ["lendo"], pet: ["hoje"], relacionamentos: ["pessoas"],
      dieta: ["cardapio"], hiperfoco: ["dia"], detox: ["rastreador"], estudos: ["estudos"], beleza: ["routine"],
    });
  });
});

/* ------------------------------------------------------------------ 3. o sumário */
describe("braço SUMÁRIO (conta nova)", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_ABAS_BRACO, "sumario"); });

  it("a porta é 'Sumário +6'; abrir NÃO grava nada e manda sumario_aberto", async () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).toEqual(["tab-dashboard", "financeiro"]);
    expect(screen.queryByTestId("abas-mostrar-todas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("abas-organizar")).not.toBeInTheDocument();
    const porta = screen.getByTestId("abas-sumario");
    expect(porta.textContent).toContain("+6");
    expect(porta.getAttribute("aria-label")).toBe("Sumário, 6 abas guardadas");
    fireEvent.click(porta);
    expect(screen.getByTestId("abas-sumario-folha")).toBeInTheDocument();
    expect(store.escritas).toEqual([]);
    expect(eventos.find((e) => e[0] === "sumario_aberto")?.[1]).toMatchObject({ modulo: "financas", guardadas: 6 });
    // seções: NA FILEIRA (2) e PLANEJAR (6), numeração seguida, frase de cada linha
    const secoes = Array.from(document.querySelectorAll('[data-testid="sumario-secao"]')).map((s) => s.getAttribute("data-titulo"));
    expect(secoes).toEqual(["NA FILEIRA", "PLANEJAR"]);
    const linhas = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="sumario-linha"]')).map((l) => l.getAttribute("data-aba"));
    expect(linhas).toEqual(["dashboard", "financeiro", ...OCULTAS_FIN]);
    expect(linha("investimentos").textContent).toContain("03");
    expect(linha("investimentos").textContent).toContain("carteira e aportes");
  });

  it("tocar numa linha abre a aba TRACEJADA sem gravar; trocar de aba tira ela da fileira; continua guardada", async () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    fireEvent.click(screen.getByTestId("abas-sumario"));
    fireEvent.click(linha("investimentos").querySelector("button")!);
    expect(screen.getByTestId("ativa").textContent).toBe("investimentos");
    await waitFor(() => expect(screen.queryByTestId("abas-sumario-folha")).not.toBeInTheDocument());
    const aba = document.querySelector<HTMLElement>('[data-spotlight="tab-investimentos"]')!;
    expect(aba.getAttribute("data-oculta")).toBe("1");
    expect(store.escritas).toEqual([]);
    fireEvent.click(document.querySelector('[data-spotlight="tab-dashboard"]')!);
    expect(naFileira()).toEqual(["tab-dashboard", "financeiro"]);
    expect(store.escritas).toEqual([]);
  });

  it("o MARCADOR grava só aquela aba (string[] em abas-ocultas:financas); tirar de novo devolve; a última trava", () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    fireEvent.click(screen.getByTestId("abas-sumario"));
    fireEvent.click(linha("investimentos").querySelector('[data-testid="sumario-marcador"]')!);
    expect(store.escritas).toEqual(["abas-ocultas:financas"]);
    expect(store.dados["abas-ocultas:financas"]).toEqual(OCULTAS_FIN.filter((x) => x !== "investimentos"));
    expect(naFileira()).toContain("tab-investimentos");
    expect(eventos.find((e) => e[0] === "aba_mostrada")?.[1]).toMatchObject({ modulo: "financas", aba: "investimentos", origem: "sumario" });
    fireEvent.click(linha("investimentos").querySelector('[data-testid="sumario-marcador"]')!);
    expect(store.dados["abas-ocultas:financas"]).toEqual([...OCULTAS_FIN.filter((x) => x !== "investimentos"), "investimentos"]);
    expect(eventos.find((e) => e[0] === "aba_ocultada")?.[1]).toMatchObject({ aba: "investimentos", origem: "sumario" });
    // tirar Dashboard → sobra Meu financeiro, travado
    fireEvent.click(linha("dashboard").querySelector('[data-testid="sumario-marcador"]')!);
    expect(linha("financeiro").querySelector<HTMLButtonElement>('[data-testid="sumario-marcador"]')!.disabled).toBe(true);
    expect(Array.isArray(store.dados["abas-ocultas:financas"])).toBe(true);
  });

  it("'Pôr todas na fileira' = o Mostrar todas de hoje ([] gravado); a porta fica 'Sumário' sem número", () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    fireEvent.click(screen.getByTestId("abas-sumario"));
    fireEvent.click(screen.getByTestId("sumario-por-todas"));
    expect(store.dados["abas-ocultas:financas"]).toEqual([]);
    expect(naFileira()).toHaveLength(8);
    expect(screen.getByTestId("abas-sumario").textContent).not.toContain("+");
  });

  it("'Mudar a ordem' troca os marcadores pelas setas e grava abas-ordem:financas", () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    fireEvent.click(screen.getByTestId("abas-sumario"));
    fireEvent.click(screen.getByTestId("sumario-mudar-ordem"));
    expect(document.querySelector('[data-testid="sumario-marcador"]')).toBeNull();
    fireEvent.click(screen.getByLabelText("Mover MEU FINANCEIRO pra cima"));
    expect(store.escritas).toEqual(["abas-ordem:financas"]);
    expect((store.dados["abas-ordem:financas"] as string[]).slice(0, 2)).toEqual(["financeiro", "dashboard"]);
  });

  it("a 3ª dica (evento de organizar) abre o sumário; dica e link que abrem aba guardada continuam abrindo", () => {
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ORGANIZAR_ABAS, { detail: { modulo: "financas" } })); });
    expect(screen.getByTestId("abas-sumario-folha")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ABA, { detail: { modulo: "financas", aba: "relatorios" } })); });
    expect(screen.getByTestId("ativa").textContent).toBe("relatorios");
    fireEvent.click(screen.getByText("atalho limites"));
    expect(document.querySelector('[data-spotlight="tab-limites"]')?.getAttribute("data-oculta")).toBe("1");
    expect(store.escritas).toEqual([]);
  });

  it("conta ANTIGA no braço sumário: a fileira de hoje (sem porta do sumário)", () => {
    const store = criarStore(ANTIGA);
    render(<Com store={store}><Pagina /></Com>);
    expect(screen.queryByTestId("abas-sumario")).not.toBeInTheDocument();
    expect(screen.getByTestId("abas-organizar")).toBeInTheDocument();
    expect(naFileira()).toHaveLength(8);
  });

  it("usePortaDoSumario: só conta nova no braço sumário, e só em módulo que guarda aba (Beleza fica com a dica de hoje)", () => {
    const Le = ({ m = "financas" }: { m?: string }) => <p data-testid="porta">{String(usePortaDoSumario(m))}</p>;
    render(<Com store={criarStore(NOVA)}><Le /></Com>);
    expect(screen.getByTestId("porta").textContent).toBe("true");
    cleanup();
    render(<Com store={criarStore(NOVA)}><Le m="beleza" /></Com>);
    expect(screen.getByTestId("porta").textContent).toBe("false");
    cleanup();
    render(<Com store={criarStore(ANTIGA)}><Le /></Com>);
    expect(screen.getByTestId("porta").textContent).toBe("false");
    cleanup();
    localStorage.setItem(CHAVE_FORCA_ABAS_BRACO, "hoje");
    render(<Com store={criarStore(NOVA)}><Le /></Com>);
    expect(screen.getByTestId("porta").textContent).toBe("false");
  });
});

/* ------------------------------------------------------------------ 4. braço todas */
describe("braço TODAS", () => {
  it("conta nova vê todas as abas e só o ícone de organizar (como na 1.0.21)", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_BRACO, "todas");
    const store = criarStore(NOVA);
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).toHaveLength(8);
    expect(screen.queryByTestId("abas-mostrar-todas")).not.toBeInTheDocument();
    expect(screen.getByTestId("abas-organizar")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ 5. o visual */
describe("visual caderno / fixa", () => {
  for (const visual of ["caderno", "fixa"] as const) {
    it(`${visual}: porta presa FORA da faixa que rola; ids e data-spotlight iguais; 'Ver todas' grava como hoje (com origem)`, () => {
      localStorage.setItem(CHAVE_FORCA_ABAS_VISUAL, visual);
      const store = criarStore(NOVA);
      render(<Com store={store}><Pagina /></Com>);
      const raiz = document.querySelector<HTMLElement>(`[data-abas-visual="${visual}"]`)!;
      expect(raiz).not.toBeNull();
      expect(naFileira()).toEqual(["tab-dashboard", "financeiro"]);
      const faixa = document.querySelector('[data-spotlight="financeiro"]')!.closest(".overflow-x-auto")!;
      const verTodas = screen.getByTestId("abas-mostrar-todas");
      expect(faixa.contains(verTodas)).toBe(false);
      expect(document.querySelector('[data-spotlight="financeiro"]')!.getAttribute("data-active")).toBe("true");
      fireEvent.click(verTodas);
      expect(store.dados["abas-ocultas:financas"]).toEqual([]);
      expect(eventos.find((e) => e[0] === "abas_mostrar_todas")?.[1]).toMatchObject({ modulo: "financas", ocultas: 6, origem: "fileira" });
      expect(naFileira()).toHaveLength(8);
    });
  }

  it("caderno: a aba aberta leva a faixa na cor do módulo; abas sem emoji continuam; nome nunca < 11 px", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_VISUAL, "caderno");
    render(<Com store={criarStore(NOVA)}><Pagina /></Com>);
    const ativa = document.querySelector<HTMLElement>('[data-spotlight="financeiro"]')!;
    expect(ativa.querySelector("[data-faixa-cor]")?.getAttribute("data-faixa-cor")).toBe("oklch(0.78 0.14 90)");
    expect(ativa.className).toContain("text-[11px]");
    const fonte = readFileSync(resolve(__dirname, "../components/ui/abas-ocultaveis.tsx"), "utf8") + readFileSync(resolve(__dirname, "../components/ui/sumario-abas.tsx"), "utf8");
    expect(fonte).not.toMatch(/text-\[(9|10)(\.\d)?px\]/);
  });

  it("conta ANTIGA com o visual ligado: a fileira de hoje", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_VISUAL, "caderno");
    render(<Com store={criarStore(ANTIGA)}><Pagina /></Com>);
    expect(document.querySelector("[data-abas-visual]")).toBeNull();
    expect(screen.getByTestId("abas-organizar")).toBeInTheDocument();
  });

  it("tutorial aberto (holofote) mostra todas as abas também no caderno", async () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_VISUAL, "caderno");
    const { segurarTodasAsAbas } = await import("@/lib/abas-ocultas");
    render(<Com store={criarStore(NOVA)}><Pagina /></Com>);
    let soltar = () => {};
    act(() => { soltar = segurarTodasAsAbas(); });
    expect(naFileira()).toHaveLength(8);
    act(() => soltar());
    expect(naFileira()).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ 6. a medição nova */
describe("medição nova", () => {
  it("aba_aberta: entrada, fileira, link (atalho), dica — e nada disso com a medição desligada", () => {
    const store = criarStore(NOVA);
    const { unmount } = render(<Com store={store}><Pagina /></Com>);
    fireEvent.click(document.querySelector('[data-spotlight="tab-dashboard"]')!);
    expect(nomes()).not.toContain("aba_aberta");
    unmount();

    localStorage.setItem(CHAVE_FORCA_ABAS_MEDICAO, "on");
    render(<Com store={criarStore(NOVA)}><Pagina /></Com>);
    fireEvent.click(document.querySelector('[data-spotlight="tab-dashboard"]')!);
    fireEvent.click(screen.getByText("atalho limites"));
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ABA, { detail: { modulo: "financas", aba: "financeiro" } })); });
    const abertas = eventos.filter((e) => e[0] === "aba_aberta").map((e) => [e[1].aba, e[1].origem, e[1].oculta]);
    expect(abertas).toEqual([["financeiro", "entrada", false], ["dashboard", "fileira", false], ["limites", "link", true], ["financeiro", "dica", false]]);
  });

  it("aba_aberta de um link direto pra aba guardada = origem link", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_MEDICAO, "on");
    render(<Com store={criarStore(NOVA)}><Pagina inicial="investimentos" /></Com>);
    expect(eventos.find((e) => e[0] === "aba_aberta")?.[1]).toMatchObject({ aba: "investimentos", origem: "link", oculta: true });
  });

  it("uso_modulo 1x por chave por dia neste aparelho (sobrevive a reabrir; dia novo conta de novo)", () => {
    expect(usoModuloPrimeiraVezHoje("finance-expenses", "2026-11-07")).toBe(true);
    expect(usoModuloPrimeiraVezHoje("finance-expenses", "2026-11-07")).toBe(false);
    expect(usoModuloPrimeiraVezHoje("finance-incomes", "2026-11-07")).toBe(true);
    expect(usoModuloPrimeiraVezHoje("finance-expenses", "2026-11-08")).toBe(true);
    localStorage.setItem("core-uso-modulo-dia", "lixo");
    expect(usoModuloPrimeiraVezHoje("finance-expenses", "2026-11-08")).toBe(true);
  });

  it("*-last-seen-* não vira first_transaction com a medição nova (e vira, como hoje, sem ela)", async () => {
    vi.resetModules();
    const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
    vi.doMock("@/hooks/use-auth", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-auth")>()), useAuth: () => auth }));
    vi.doMock("@/integrations/supabase/client", () => {
      const vazio = () => Promise.resolve({ data: [], error: null });
      const selecao: Record<string, unknown> = {};
      Object.assign(selecao, {
        eq: () => selecao, order: () => selecao, range: () => selecao, in: vazio, abortSignal: vazio,
        then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => vazio().then(ok, erro),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      });
      return {
        supabase: {
          from: () => ({ select: () => selecao, upsert: () => Promise.resolve({ error: null }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
          auth: { getSession: async () => ({ data: { session: { access_token: "t", user: auth.user } } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
          functions: { invoke: async () => ({ data: null, error: null }) },
          rpc: async () => ({ data: null, error: null }),
        },
      };
    });
    const { UserDataProvider, useUserData } = await import("@/hooks/use-user-data");
    let setar: (k: string, v: unknown) => void = () => {};
    const Grava = () => { const { set, loaded } = useUserData(); setar = set; return <p data-carregou={loaded ? "1" : "0"} />; };
    const abrir = async () => {
      render(<UserDataProvider><Grava /></UserDataProvider>);
      await waitFor(() => expect(document.querySelector('[data-carregou="1"]')).not.toBeNull());
    };
    await abrir();
    act(() => setar("finance-last-seen-month", "2026-11"));
    expect(ativacoes).toEqual(["first_transaction"]); // o comportamento de hoje (o falso positivo de 06/11)
    cleanup(); ativacoes.length = 0; eventos.length = 0;

    localStorage.setItem(CHAVE_FORCA_ABAS_MEDICAO, "on");
    await abrir();
    act(() => setar("finance-last-seen-month", "2026-12"));
    expect(ativacoes).toEqual([]);
    act(() => setar("finance-expenses", [{ id: "g1", valor: 10 }]));
    expect(ativacoes).toEqual(["first_transaction"]);
    expect(eventos.filter((e) => e[0] === "uso_modulo")).toHaveLength(1);
    act(() => setar("finance-expenses", [{ id: "g1", valor: 10 }, { id: "g2", valor: 5 }]));
    expect(eventos.filter((e) => e[0] === "uso_modulo")).toHaveLength(1);
    vi.doUnmock("@/hooks/use-auth");
    vi.doUnmock("@/integrations/supabase/client");
  });
});

/* ------------------------------------------------------------------ 7. frases e dica */
describe("frases do sumário e a 3ª dica", () => {
  it("frase: no máximo 6 palavras, começa em minúscula, todo id existe no módulo", () => {
    const PAGINA: Record<string, string> = { financas: "Index", rotina: "Rotina", saude: "Saude", treino: "Treino", dieta: "Dieta", beleza: "Beleza", casa: "Casa",
      biblioteca: "Biblioteca", desenvolvimento: "DesenvolvimentoPessoal", estudos: "Estudos", relacionamentos: "Relacionamentos", detox: "Detox",
      hiperfoco: "Hiperfoco", carreira: "Carreira", pet: "Pet", viagens: "Viagens" };
    expect(Object.keys(FRASE_DA_ABA).sort()).toEqual(Object.keys(PAGINA).sort());
    for (const [m, frases] of Object.entries(FRASE_DA_ABA)) {
      const fonte = readFileSync(resolve(__dirname, `../pages/${PAGINA[m]}.tsx`), "utf8");
      for (const [id, f] of Object.entries(frases)) {
        expect(fonte, `${m}/${id}`).toMatch(new RegExp(`id: *"${id}"|"${id}"`));
        expect(f.split(/\s+/).length, `${m}/${id}: ${f}`).toBeLessThanOrEqual(6);
        expect(f[0], `${m}/${id}`).toBe(f[0].toLowerCase());
        expect(f, m).not.toMatch(/[!]/);
      }
    }
    expect(FRASE_DA_ABA.financas.investimentos).toBe("carteira e aportes");
    expect(FRASE_DA_ABA.casa.rotina).toBe("rotina de limpeza da casa");
    expect(tituloDasGuardadas("financas")).toBe("PLANEJAR");
    expect(tituloDasGuardadas("casa")).toBe("GUARDADAS");
  });

  it("3ª dica do braço sumário segue as regras das dicas: 1 linha, sem exclamação, sem emoji", () => {
    for (const t of [DICA_SUMARIO.texto, DICA_SUMARIO.textoSemToque!]) {
      expect(t.length).toBeLessThanOrEqual(52);
      expect(t).not.toMatch(/[!⚙]/);
      expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false);
    }
  });
});
