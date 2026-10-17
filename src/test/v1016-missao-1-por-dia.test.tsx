/**
 * 1.0.16 (16/10) — A PARTE DO TESTE GRÁTIS: o que este arquivo trava, sempre com CONTA VAZIA (sem seeds).
 *
 *   1. A ÁREA do funil sobrevive ao "liberando" (retomada.limparProgresso não leva mais
 *      `core-funil-w-area`) e a missão nasce nela; a conta da Porta do site traz a área em
 *      `user_metadata.porta.respostas.area`. "Treino e dieta" (corpo) = Treino → Saúde → Finanças.
 *   2. O ANEL da dose não some quando o módulo redesenha e troca o nó (`anel_saiu motivo=ancora_invisivel`):
 *      ele re-acha a âncora; sumiu de verdade → espera a tolerância e só então sai.
 *   3. A chave remota `missao_1_por_dia` (metadata de offering do RevenueCat, só iPhone): ausente/"off" →
 *      o de hoje (build de loja = todos no B); "ab" → 50/50 A × B; "on" → todos no A. RevenueCat que nunca
 *      respondeu → o de hoje. A última resposta fica no aparelho (`core-missao-1-por-dia`).
 *   4. Braço A = UMA dose por dia: dia 1 dose 1 + "amanhã · te lembro às…" (sem adiantar); a dose de
 *      amanhã não abre hoje nem entrando no módulo; num dia novo, o convite "Dia N da missão" na Home
 *      (1x por dia, sobrevive a fechar/reabrir e ao logout); o Lembrete do dia 2 aponta pra dose.
 *   5. Os eventos levam `variante`, `braco` ("um_por_dia" | "dia1_cheio") e `missao_1_por_dia`.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString(), user_metadata: {} as Record<string, unknown> }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: vi.fn(async () => true) }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, user_metadata: conta.user_metadata }, isSubscribed: true }),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"),
  agendarProximaDose: vi.fn(async () => ({ ok: true, quando: new Date() })),
}));
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } } }));

import { UserDataContext, useUserData } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { MissaoDosesNaWeb, areaDaMissao } from "@/components/missao-doses/MissaoDosesNaWeb";
import { Anel, TOLERANCIA_ANCORA_MS } from "@/components/demo-guiada/pecas";
import {
  CHAVE_ESTADO_MISSAO_DOSES, EVENTO_MISSAO_DOSES, conviteDoDiaDevido, doseDeHojeDevida, doseLiberadaHoje, ehUmPorDia, eventoDaMissao, iniciarMissao, lerMissao, missaoEmAndamento, modulosPadrao, precisaPlanoA,
} from "@/lib/missao-doses";
import { marcarTourFeito, varianteDoTour } from "@/lib/tour-home";
import {
  CHAVE_BRACO_DIA1, CHAVE_UM_POR_DIA_APARELHO, _zerarUmPorDiaRemoto, bracoDia1, idDoAparelho, lerUmPorDiaRemoto, modoDia1Cheio, modoUmPorDia, registrarUmPorDiaRemoto, sortearBraco,
} from "@/lib/dia1-cheio";
import { CHAVES_FUNIL_W, guardarChave, lerChave, limparProgresso } from "@/pages/funis/w/retomada";
import { conteudoDoLembrete } from "@/lib/lembrete-dia2";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

/* ------------------------------------------------------------ o aparelho de mentira (o mesmo do dia1-cheio.test) */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  return <UserDataContext.Provider value={{ ...store.valor() } as never}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><p>home de sempre</p></div>;
/** Finanças que REMONTA o botão de adicionar quando `__versao` muda (a hidratação da conta redesenhando o módulo). */
const FinancasFalsa = () => {
  const { get } = useUserData();
  const versao = get<number>("__versao", 0);
  return (
    <div><Rota /><header className="sticky">FINANÇAS</header>
      <div key={`linha-${versao}`}><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div>
      <section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
  );
};
const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
/** Rotina com o caminho REAL de criar hábito; a tabela REFAZ as linhas quando `__versao` muda. */
const RotinaFalsa = () => {
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const habitos = (get<string[]>("rotina-habits", []) ?? []);
  const grade = get<Record<string, boolean[]>>("rotina-habits-checked", {}) ?? {};
  const versao = get<number>("__versao", 0);
  const adicionar = () => { if (!nome.trim()) return; set("rotina-habits", [...habitos, nome.trim()]); setNome(""); setAberto(false); };
  const marcar = (dia: string, i: number) => { const linha = [...(grade[dia] ?? habitos.map(() => false))]; linha[i] = !linha[i]; set("rotina-habits-checked", { ...grade, [dia]: linha }); };
  return (
    <div>
      <Rota /><header className="sticky">ROTINA</header>
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={adicionar}>Adicionar</button></div>}
      <table><tbody>{DIAS_ROTINA.map((d) => (
        <tr key={`${d}-${versao}`}><td>{d}</td>{habitos.map((h, i) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} checked={!!grade[d]?.[i]} onChange={() => marcar(d, i)} /></td>)}</tr>
      ))}</tbody></table>
    </div>
  );
};
const SaudeFalsa = () => <div><Rota /><header className="sticky">SAÚDE</header><button type="button" data-spotlight="add-water">+</button></div>;
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeFalsa />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="/rotina" element={<RotinaFalsa />} />
          <Route path="/saude" element={<SaudeFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
const terminarOlhar = () => {
  avancar(700); avancar(1000); avancar(1500);
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
const offerings = (meta: Record<string, unknown> | null, outra?: Record<string, unknown>) => {
  const current = { identifier: "default", metadata: meta ?? {} };
  return { current, all: { default: current, ...(outra ? { anual_69: { identifier: "anual_69", metadata: outra } } : {}) } };
};
const ligarUmPorDia = (modo: "on" | "ab" | "off") => registrarUmPorDiaRemoto(offerings({ missao_1_por_dia: modo }));
/** Uma missão do braço A nascida em 03/10 (o dia 1), com as boas-vindas vistas. */
const missaoA = (feitos: Record<number, { dia: string; rotulo: string }>, extra: Record<string, unknown> = {}) =>
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, feitos, ...extra }));
const iphone = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const hojeDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  localStorage.clear();
  // 1.0.16: a dose de Finanças virou o "Vamos montar suas Finanças" — aqui, o caminho de quem PULOU (o 1º gasto pelo chip)
  localStorage.setItem("core-montar-financas", JSON.stringify({ r: "pulou" }));
  eventos.length = 0;
  _zerarUmPorDiaRemoto();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.user_metadata = {};
  iphone();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10 — dia 1 da missão
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ 1 + 4: a área */

describe("1. a área escolhida no funil chega na missão", () => {
  it("o 'liberando' (limparProgresso) leva o progresso do funil mas DEIXA a área; a missão nasce em Rotina e o evento diz area=rotina", () => {
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    guardarChave(CHAVES_FUNIL_W.passo, "signup");
    guardarChave(CHAVES_FUNIL_W.respostas, { compromisso: "Sim, topo" });
    limparProgresso(); // a conta nasceu
    expect(lerChave(CHAVES_FUNIL_W.passo)).toBeNull();
    expect(lerChave(CHAVES_FUNIL_W.respostas)).toBeNull();
    expect(lerChave<string>(CHAVES_FUNIL_W.area)).toBe("rotina");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.modulos).toEqual(["rotina", "financas", "saude"]);
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area: "rotina", origem_area: "funil", modulos: ["rotina", "financas", "saude"] })]);
  });

  it("a área é chave do APARELHO: a vassoura da abertura/logout não leva", () => {
    expect(vassouraLeva(CHAVES_FUNIL_W.area)).toBe(false);
  });

  it("conta da Porta (site): sem área no aparelho, vale user_metadata.porta.respostas.area", () => {
    conta.user_metadata = { porta: { respostas: { area: "corpo" } } };
    expect(areaDaMissao(conta.user_metadata)).toBe("corpo");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.modulos).toEqual(["treino", "saude", "financas"]);
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area: "corpo", origem_area: "porta" })]);
  });

  it("a 1ª dose é SEMPRE a área escolhida; corpo puxa a Saúde (1 copo d'água) pra 2ª", () => {
    expect(modulosPadrao("dinheiro")[0]).toBe("financas");
    expect(modulosPadrao("rotina")[0]).toBe("rotina");
    expect(modulosPadrao("corpo")).toEqual(["treino", "saude", "financas"]);
    expect(modulosPadrao("saude")[0]).toBe("saude");
    expect(modulosPadrao("metas")[0]).toBe("desenvolvimento");
    expect(modulosPadrao(null)).toEqual(["financas", "rotina", "saude"]);
    expect(areaDaMissao({ porta: { respostas: { area: "lixo" } } })).toBeNull();
  });
});

/* ------------------------------------------------------------ 2: o anel */

describe("2. o anel da dose não some quando o módulo redesenha", () => {
  it("Finanças REMONTA o botão de adicionar (hidratação) com o anel aceso: o anel re-acha, segue aceso, nenhum anel_saiu", () => {
    const store = montarStore({});
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true }));
    montar(store, "/financas");
    esperarPostIt();
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    const antes = document.querySelector('[data-spotlight="add-expense"]');
    act(() => { store.valor().set("__versao", 1); });
    expect(document.querySelector('[data-spotlight="add-expense"]')).not.toBe(antes); // o nó trocou mesmo
    expect(antes!.isConnected).toBe(false);
    avancar(300); avancar(300); avancar(TOLERANCIA_ANCORA_MS + 500);
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.queryByTestId("missao-doses-onde")).toBeNull();
  });

  it("Rotina de conta vazia: criou o hábito → anel no quadradinho de HOJE; a tabela REFAZ as linhas → o anel segue (antes: ancora_invisivel)", () => {
    const store = montarStore({});
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03"), boasVindas: true }));
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).toHaveTextContent("2 de 2 · marcar");
    eventos.length = 0;
    act(() => { store.valor().set("__versao", 1); }); // a tabela se refaz (nós novos)
    avancar(300); avancar(TOLERANCIA_ANCORA_MS + 500);
    expect(screen.getAllByTestId("missao-doses-anel").length).toBeGreaterThan(0);
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.queryByTestId("missao-doses-onde")).toBeNull();
    // e o toque no quadradinho de hoje fecha a dose
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    expect(terminarOlhar()).toHaveTextContent("Primeiro registro feito!");
  });

  it("o Anel sozinho: âncora trocada → segue no nó novo; âncora sumida de vez → sai com ancora_invisivel só depois da tolerância; sem `reachar`, sai na hora (o de sempre)", () => {
    const caixa = document.createElement("div");
    document.body.appendChild(caixa);
    const botao = () => { const b = document.createElement("button"); b.setAttribute("data-alvo", "1"); caixa.appendChild(b); return b; };
    const b1 = botao();
    const saidas: string[] = [];
    const reachar = () => document.querySelector('[data-alvo="1"]');
    render(<Anel alvo={b1} fixo interativo duracao={null} reachar={reachar} aoSair={(m) => saidas.push(m)} testid="anel-x" balao={<p>post-it</p>} />);
    avancar(900);
    expect(screen.getByTestId("anel-x")).toBeInTheDocument();
    b1.remove(); botao(); // o módulo remontou o botão
    avancar(1000);
    expect(saidas).toEqual([]);
    caixa.innerHTML = ""; // sumiu de verdade
    avancar(TOLERANCIA_ANCORA_MS - 500);
    expect(saidas).toEqual([]);
    expect(screen.getByText("post-it")).toBeInTheDocument(); // o post-it não pisca enquanto espera
    avancar(1000);
    expect(saidas).toEqual(["ancora_invisivel"]);
    cleanup();
    const b3 = botao();
    const saidas2: string[] = [];
    render(<Anel alvo={b3} fixo interativo duracao={null} aoSair={(m) => saidas2.push(m)} balao={<p>p</p>} />);
    avancar(900);
    b3.remove();
    avancar(300);
    expect(saidas2).toEqual(["ancora_invisivel"]);
    caixa.remove();
  });
});

/* ------------------------------------------------------------ 3: a chave remota */

describe("3. a metadata `missao_1_por_dia` do RevenueCat", () => {
  it("leitura pura: ausente = off; qualquer offering vale; a `current` vence; valor estranho é ignorado", () => {
    expect(lerUmPorDiaRemoto(offerings(null))).toBe("off");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "AB" }))).toBe("ab");
    expect(lerUmPorDiaRemoto(offerings(null, { missao_1_por_dia: "on" }))).toBe("on");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "off" }, { missao_1_por_dia: "on" }))).toBe("off");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "talvez" }))).toBe("off");
    expect(lerUmPorDiaRemoto(null)).toBe("off");
  });

  it("RevenueCat NUNCA respondeu + build de loja (VITE_V14_LOJA=1) → o de hoje: todos no B, sem sorteio", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    expect(modoUmPorDia()).toBe("off");
    expect(modoDia1Cheio()).toBe("on");
    expect(bracoDia1()).toBe("B");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
  });

  it("respondeu sem a chave (ou 'off') → o de hoje; e grava a resposta no aparelho", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    registrarUmPorDiaRemoto(offerings(null));
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("off");
    expect(bracoDia1()).toBe("B");
    registrarUmPorDiaRemoto(undefined); // falha de rede: não apaga a resposta anterior
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("off");
  });

  it("'ab' → sorteio 50/50 pelo id do aparelho (gravado em core-dia1-braco); 'on' → todos no A", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    expect(modoDia1Cheio()).toBe("ab");
    const b = bracoDia1();
    expect(b).toBe(sortearBraco(idDoAparelho()));
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBe(b);
    localStorage.clear(); _zerarUmPorDiaRemoto();
    ligarUmPorDia("on");
    expect(bracoDia1()).toBe("A");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
  });

  it("a última resposta vale na abertura seguinte antes do getOfferings (a missão nasce às vezes antes dele)", () => {
    ligarUmPorDia("on");
    _zerarUmPorDiaRemoto(); // reabriu o app: memória vazia
    expect(modoUmPorDia()).toBe("on");
    expect(bracoDia1()).toBe("A");
  });

  it("só iPhone: no Android (e na web) a metadata não liga nada", () => {
    ligarUmPorDia("on");
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    expect(modoUmPorDia()).toBe("off");
    delete (window as { Capacitor?: unknown }).Capacitor;
    expect(modoUmPorDia()).toBe("off");
  });

  it("o braço é da MISSÃO: a metadata desligar no meio não muda quem já começou no A", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.braco).toBe("A");
    ligarUmPorDia("off");
    expect(ehUmPorDia(lerMissao())).toBe(true);
  });
});

/* ------------------------------------------------------------ 4: o braço A, dia a dia */

describe("4. braço A — uma dose por dia, conta VAZIA, do dia 1 ao dia 3", () => {
  it("dia 1 (conta VAZIA, área dinheiro): boas-vindas de 1 tela → Montar Finanças é a dose → festa PEQUENA 'Dia 1 de 3 feito ✅' + adesivo 'Dia 1' + amanhã trancado → Home → (tour curto) → 'Plano de amanhã' 8/12/20 → a Rotina não abre a dose 2 hoje", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas"); // a dose de Finanças de verdade
    const store = montarStore({});
    montar(store, "/home");
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveTextContent("Tá dentro! 🎉");
    expect(boas).toHaveTextContent("Seu plano de 3 dias");
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent("Hoje · 💰 Finanças · monte em 30 s");
    expect(screen.getByTestId("missao-doses-linha-2")).toHaveTextContent("Amanhã · 📅 Rotina · 1 hábito, 20 s");
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent("Dia 3 · ❤️ Saúde · 1 copo d'água, 10 s");
    expect(screen.getByTestId("missao-doses-comecar")).toHaveTextContent("Começar (30 s)");
    expect(screen.getByTestId("missao-doses-trocar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    // a dose = "Vamos montar suas Finanças" (renda → contas → o número dela)
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: /Aluguel/ }));
    fireEvent.click(mf().getByRole("button", { name: "Ver quanto posso gastar" }));
    avancar(2500);
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull(); // nada da missão por cima do Montar
    fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    expect(Array.isArray(store.dados["finance-incomes"])).toBe(true);
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveAttribute("data-braco", "A");
    expect(festa).not.toHaveAttribute("data-tela-cheia");
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(/Pode gastar R\$ [\d.]+ por dia já está nas suas Finanças/);
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveTextContent("Adesivo · Dia 1");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: 📅 Rotina · 20 s");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("adesivo do dia 2 🔒");
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "montar_financas", acao: "feito", variante: "A", dia_cal: 1 })]);
    expect(eventos).toContainEqual(["adesivo_desbloqueado", expect.objectContaining({ id: "missao_dia_1", origem: "missao_dia_1" })]);
    expect(eventos).toContainEqual(["montar_financas_view", expect.objectContaining({ origem: "missao" })]);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    const m = lerMissao()!;
    expect(m.adesivos).toEqual(["missao_dia_1"]);
    expect(doseLiberadaHoje(m)).toBe(false);
    expect(missaoEmAndamento(m)).toBe(false); // a Home é dela: o tour curto pode entrar
    expect(varianteDoTour(m)).toBe("curto");
    expect(precisaPlanoA(m)).toBe(true);
    // o tour curto ainda não aconteceu: a folha do plano ESPERA ele
    avancar(3000);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    marcarTourFeito(); // ... o tour curto acabou
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); });
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a-titulo")).toHaveTextContent("Amanhã a gente monta sua Rotina em 20 s. Que horas te lembro?");
    fireEvent.click(screen.getByTestId("plano-a-hora-20h"));
    fireEvent.click(screen.getByTestId("plano-a-combinado"));
    expect(lerMissao()?.lembrete).toBe("20h");
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    // fechar → reabrir no mesmo dia: nada volta (boas-vindas, Montar, festa, plano)
    cleanup();
    montar(store, "/home");
    avancar(4000);
    for (const t of ["missao-doses-boas-vindas", "plano-amanha-a", "missao-doses-convite", "missao-doses-festa"]) expect(screen.queryByTestId(t), t).toBeNull();
    // ela entra sozinha na Rotina no MESMO dia: uso livre, nada de dose 2
    cleanup();
    montar(store, "/rotina");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull();
  });

  it("23:59 → 00:01: a dose 2 não abre no dia 1 e abre no dia 2 (relógio falso)", () => {
    ligarUmPorDia("on");
    const store = montarStore({});
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59));
    montar(store, "/rotina");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 4, 0, 1));
    montar(store, "/rotina");
    esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3");
  });

  it("pulou o dia 2: no dia 3 vem 'Dia 2 de 3' (a ordem, não o calendário); a missão para no 7º dia", () => {
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } });
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    montar(montarStore({}), "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2 de 3 · 📅 Rotina · 20 s");
    cleanup();
    const m = lerMissao()!;
    expect(conviteDoDiaDevido(m, "2026-10-09")).toBe(true); // dia 7
    expect(conviteDoDiaDevido(m, "2026-10-10")).toBe(false); // dia 8: acabou
    expect(doseDeHojeDevida(m, "2026-10-10")).toBe(false);
  });

  it("dia 2: convite 1x ('Dia 2 de 3 · Rotina · 20 s' + o de ontem) → 'Bora' → 3 hábitos prontos → festa 'Dia 2 de 3' + 'Sequência: 2 dias 🔥' + adesivo + 3 dias trancado + hora; dica do score; dia 3: convite 'Faltam 10 s' → 'Agora não' não volta (reabrir, logout) → a linha 'Dose de hoje' fica → Saúde (meta + copo) → a ÚNICA festa em tela cheia '3 dias seguidos' → 'O que você construiu'", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const store = montarStore({});
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { lembrete: "12h" });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/home");
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // espera a Home assentar
    avancar(1500);
    const convite = screen.getByTestId("missao-doses-convite");
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2 de 3 · 📅 Rotina · 20 s");
    expect(convite).toHaveTextContent("Ontem você montou suas Finanças: R$ 61 por dia.");
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "visto", dia: 2, modulo: "rotina", braco: "um_por_dia", dia_cal: 2 })]);
    fireEvent.click(screen.getByTestId("missao-doses-convite-ir"));
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "foi" });
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "bora", dia: 2 })]);
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    const postIt = esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    const festa = terminarOlhar();
    expect(festa).toHaveTextContent("Dia 2 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-sequencia")).toHaveTextContent("Sequência: 2 dias 🔥");
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveTextContent("Adesivo · Dia 2");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: ❤️ Saúde · 10 s");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("o adesivo 3 dias seguidos é seu 🔒");
    expect(screen.getByTestId("missao-doses-hora-12h")).toHaveAttribute("aria-checked", "true"); // a combinada; dá pra trocar
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(eventos).toContainEqual(["sequencia_marco", expect.objectContaining({ dias: 2 })]);
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-dia", "2"); // 1 balão no score
    fireEvent.click(screen.getByTestId("missao-dica-entendi"));
    expect(lerMissao()?.dicas?.[2]).toBe("2026-10-04");
    cleanup();
    // a Saúde não abre hoje
    montar(store, "/saude");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    cleanup();

    // dia 3: o convite fala da sequência → "Agora não"
    vi.setSystemTime(new Date(2026, 9, 5, 19, 0));
    eventos.length = 0;
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 3 de 3 · ❤️ Saúde · 10 s");
    expect(screen.getByTestId("missao-doses-convite")).toHaveTextContent("Faltam 10 s pros seus 3 dias seguidos.");
    fireEvent.click(screen.getByTestId("missao-doses-convite-depois"));
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "depois", dia: 3 })]);
    cleanup();
    montar(store, "/home"); avancar(3000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // fechar → reabrir
    cleanup();
    purgeLocalUserCache(); // sair da conta e entrar de novo
    montar(store, "/home"); avancar(3000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    cleanup();
    // a dose de hoje continua no módulo dela (e na linha das Pendências — testada no bloco 6)
    montar(store, "/saude");
    const postIt3 = esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 3 de 3");
    const chips3 = within(postIt3).getAllByTestId("demo-guia-chip");
    expect(chips3.map((c) => c.textContent)).toEqual(["💧Meta de 6 copos", "💧Meta de 8 copos", "💧Meta de 10 copos"]);
    fireEvent.click(chips3[1]);
    expect(store.dados["core-saude-water-goal"]).toBe(8);
    const festa3 = terminarOlhar();
    expect(festa3).toHaveAttribute("data-tela-cheia");
    expect(festa3).toHaveTextContent("3 dias seguidos!");
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "missao_3_seguidos");
    expect(festa3).not.toHaveTextContent(/R\$ ?97|assin|plano anual|oferta/i);
    expect(eventos).toContainEqual(["adesivo_desbloqueado", expect.objectContaining({ id: "missao_3_seguidos", origem: "missao_dia_3" })]);
    fireEvent.click(screen.getByTestId("missao-doses-ver-fim"));
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
  });

  it("o convite espera outra folha/festa sair da tela (nunca duas folhas juntas)", () => {
    ligarUmPorDia("on");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({
      ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true,
      feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } },
    }));
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    const outra = document.createElement("div");
    outra.setAttribute("role", "alertdialog");
    document.body.appendChild(outra);
    montar(montarStore({}), "/home");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    outra.remove();
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite")).toBeInTheDocument();
  });

  it("quem escolheu 'Explorar por conta própria' não recebe convite; o braço B (o de hoje) nunca recebe", () => {
    ligarUmPorDia("on");
    const base = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "x" } } };
    expect(conviteDoDiaDevido(base, "2026-10-04")).toBe(true);
    expect(missaoEmAndamento(base, "2026-10-04")).toBe(true); // o tour espera o convite
    expect(conviteDoDiaDevido({ ...base, explorou: true }, "2026-10-04")).toBe(false);
    expect(conviteDoDiaDevido({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(false);
    expect(missaoEmAndamento({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(false);
    expect(conviteDoDiaDevido({ ...base, braco: "B" }, "2026-10-04")).toBe(false);
    expect(doseLiberadaHoje({ ...base, braco: "B" }, "2026-10-03")).toBe(true); // B: as 3 no dia 1, como hoje
  });

  it("braço B com a metadata 'ab': a festa continua 'Bora a próxima?' (o de hoje) e os eventos dizem braco=dia1_cheio", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.braco).toBe("B");
    expect(eventoDaMissao({})).toEqual(expect.objectContaining({ variante: "B", braco: "dia1_cheio", missao_1_por_dia: "ab" }));
  });
});

/* ------------------------------------------------------------ 5: telas de uma vez só */

describe("5. as chaves novas sobrevivem às vassouras", () => {
  it("core-missao-1-por-dia, core-dia1-braco e a missão (com os convites) ficam depois do logout", () => {
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "A");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], hojeDe(new Date()), undefined, "A"), convites: { "2026-10-04": "depois" } }));
    purgeLocalUserCache();
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("ab");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBe("A");
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "depois" });
    for (const k of [CHAVE_UM_POR_DIA_APARELHO, CHAVE_BRACO_DIA1, CHAVE_ESTADO_MISSAO_DOSES, CHAVES_FUNIL_W.area]) expect(vassouraLeva(k), k).toBe(false);
  });
});
