/**
 * DIA 1 CHEIO + PLANO DE AMANHÃ (10/10, chave DIA1_CHEIO em lib/dia1-cheio). O que este arquivo trava:
 *   · a chave nasce DESLIGADA e, desligada, a missão em doses do app é a de hoje byte a byte: nenhum
 *     braço sorteado, nenhum `variante` nos eventos, o JSON da missão sem campo novo, a comemoração
 *     com "Combinado, me lembra às…" e sem "Bora a próxima?";
 *   · ligada: sorteio 50/50 determinístico por id do aparelho, gravado em core-dia1-braco; o braço vai
 *     em TODO evento da missão (`variante`); `?dia1-cheio=a|b` força;
 *   · braço A = a missão de hoje + `variante: "A"`;
 *   · braço B: dose 1 feita → "Bora a próxima? 20 s" + "Agora não"; `missao_dose_concluida`; "Agora não"
 *     → `missao_agora_nao`, notificação de +3 h (faixa da missão, não depois das 21:30) e a Home mostra
 *     a folha "Quando você abre o CORE amanhã?"; a folha grava o plano, emite `plano_amanha_definido
 *     {quando, gatilho}`, vira a hora do Lembrete do dia 2 e pede a permissão UMA vez;
 *   · 3 doses no dia 1 → `missao_completa {variante}` + CustomEvent pro tour; "O que você construiu" só
 *     a partir do dia 3; dias 2–3 = "aprofundar" no módulo já visto (faixa, festa curta, aprofundados);
 *   · o Lembrete do dia 2 do B é concreto: "Ontem você anotou 1 gasto — 20 s pra anotar o de hoje";
 *   · `missaoEmAndamento` (o ponto de encaixe do tour da Home).
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
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
const nota = vi.hoisted(() => ({ pedir: vi.fn(async (_m: string) => true) }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: (m: string) => nota.pedir(m) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: true }) }));
const notif = vi.hoisted(() => ({
  pedirDia2: vi.fn(async (_o: string) => "concedeu" as const),
  proximaDose: vi.fn(async (_d: unknown) => ({ ok: true as const, quando: new Date(2026, 9, 3, 18, 10) })),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
  agendarProximaDose: (d: unknown) => notif.proximaDose(d),
}));
// ConstruiuEm3Dias puxa a Home inteira (life hub, conquistas): aqui só importa SE ela aparece
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb, EVENTO_MISSAO_COMPLETA } from "@/components/missao-doses/MissaoDosesNaWeb";
import {
  CHAVE_ESTADO_MISSAO_DOSES, aprofundarPendente, ehBracoB, eventoDaMissao, iniciarMissao, lerMissao, missaoEmAndamento, precisaPlanoAmanha, varianteDia1,
} from "@/lib/missao-doses";
import {
  CHAVE_BRACO_DIA1, CHAVE_FORCA_DIA1_CHEIO, CHAVE_ID_LOCAL, DIA1_CHEIO, bracoDia1, dia1CheioLigado, fraseDoPlano, guardarForcaDia1Cheio, idDoAparelho, minutosDoPlano, modoDia1Cheio, quandoSugerido, sortearBraco,
} from "@/lib/dia1-cheio";
import { ESPERA_AVALIACAO_MS } from "@/components/missao-doses/MissaoDosesNaWeb";
import { conteudoDoLembrete, lerDia2, registrarAbertura, type Leitor } from "@/lib/lembrete-dia2";

/* ------------------------------------------------------------ o aparelho de mentira */

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
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><p>home de sempre</p></div>;
const FinancasFalsa = () => (
  <div><Rota /><header className="sticky">FINANÇAS</header><div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div><section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
);
const RotinaFalsa = () => <div><Rota /><header className="sticky">ROTINA</header><button type="button" data-spotlight="add-habit">+</button></div>;
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
const dados = () => ({ "core-user-name": "Ana", "rotina-habits": ["Água", "Andar"], "finance-expenses": [] as unknown[] });
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const esperarPostIt = () => { avancar(400); avancar(3000); return screen.getByTestId("demo-guia-postit"); };
/** toca no 1º chip e chega na festa */
const tocarChipAteAFesta = () => {
  const postIt = esperarPostIt();
  fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
  avancar(700); avancar(1000);
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
const missaoGravada = (extra: Record<string, unknown>, inicio = "2026-10-03") => {
  const m = iniciarMissao(["financas", "rotina", "saude"], inicio);
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, ...extra }));
};
const ligarB = () => guardarForcaDia1Cheio("?dia1-cheio=b");
const ligarA = () => guardarForcaDia1Cheio("?dia1-cheio=a");

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  notif.pedirDia2.mockClear(); notif.proximaDose.mockClear(); nota.pedir.mockClear();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-funnel-area", "dinheiro");
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ a chave e o sorteio */

describe("a chave DIA1_CHEIO", () => {
  it("nasce DESLIGADA: nenhum braço, nenhum `variante`, nenhum id sorteado", () => {
    expect(DIA1_CHEIO).toBe("off");
    expect(dia1CheioLigado()).toBe(false);
    expect(bracoDia1()).toBeNull();
    expect(varianteDia1()).toBeNull();
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
    expect(localStorage.getItem(CHAVE_ID_LOCAL)).toBeNull();
    expect(eventoDaMissao({ dia: 1 })).toEqual({ dia: 1, prototipo: "app", plataforma: "ios", versao: expect.any(String) });
  });

  it("'ab': sorteio 50/50 determinístico pelo id do aparelho (uuid local se não há device_id), gravado uma vez; a/b forçam; 'on': TODO MUNDO no B, sem sorteio", () => {
    guardarForcaDia1Cheio("?dia1-cheio=ab");
    expect(modoDia1Cheio()).toBe("ab");
    expect(dia1CheioLigado()).toBe(true);
    const id = idDoAparelho();
    expect(localStorage.getItem(CHAVE_ID_LOCAL)).toBe(id);
    expect(idDoAparelho()).toBe(id);
    const b = bracoDia1();
    expect(b).toBe(sortearBraco(id));
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBe(b);
    expect(bracoDia1()).toBe(b); // não re-sorteia
    // o sorteio é equilibrado e estável
    let bs = 0;
    for (let i = 0; i < 2000; i++) if (sortearBraco(`aparelho-${i}-${i * 7919}`) === "B") bs += 1;
    expect(bs).toBeGreaterThan(850); expect(bs).toBeLessThan(1150);
    expect(sortearBraco("x")).toBe(sortearBraco("x"));
    // um device_id que já exista manda
    localStorage.clear();
    localStorage.setItem("device_id", "abc-123");
    expect(idDoAparelho()).toBe("abc-123");
    // forçar
    guardarForcaDia1Cheio("?dia1-cheio=b");
    expect(bracoDia1()).toBe("B");
    guardarForcaDia1Cheio("?dia1-cheio=A");
    expect(bracoDia1()).toBe("A");
    expect(localStorage.getItem(CHAVE_FORCA_DIA1_CHEIO)).toBe("ab"); // a/b ligam o 50/50 e forçam o braço
    // "on" (dono 10/10: dia 1 cheio pra todo mundo): B sem sorteio — o A gravado de um QA não vale, e nada é gravado
    guardarForcaDia1Cheio("?dia1-cheio=on");
    expect(modoDia1Cheio()).toBe("on");
    expect(dia1CheioLigado()).toBe(true);
    expect(bracoDia1()).toBe("B");
    expect(varianteDia1()).toBe("B");
    localStorage.removeItem(CHAVE_BRACO_DIA1);
    expect(bracoDia1()).toBe("B");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
    guardarForcaDia1Cheio("?dia1-cheio=off");
    expect(bracoDia1()).toBeNull();
    expect(varianteDia1()).toBeNull();
    guardarForcaDia1Cheio("?dia1-cheio=auto");
    expect(localStorage.getItem(CHAVE_FORCA_DIA1_CHEIO)).toBeNull();
  });

  it("o plano de amanhã: o chip sugerido é o mais perto da hora; as horas 8/12/20; a frase", () => {
    expect(quandoSugerido(new Date(2026, 9, 3, 9, 0))).toBe("manha");
    expect(quandoSugerido(new Date(2026, 9, 3, 13, 30))).toBe("almoco");
    expect(quandoSugerido(new Date(2026, 9, 3, 19, 10))).toBe("noite");
    expect(minutosDoPlano("manha")).toBe(8 * 60); expect(minutosDoPlano("almoco")).toBe(12 * 60); expect(minutosDoPlano("noite")).toBe(20 * 60);
    expect(fraseDoPlano({ quando: "noite", gatilho: "dormir", dia: "2026-10-03" })).toBe("Amanhã à noite, antes de dormir");
    expect(fraseDoPlano({ quando: "manha", dia: "2026-10-03" })).toBe("Amanhã de manhã");
  });
});

/* ------------------------------------------------------------ DESLIGADA = hoje */

describe("DESLIGADA: a missão do app é a de hoje, byte a byte", () => {
  it("nasce sem braço, o JSON não ganha campo novo, os eventos não têm `variante`, e a festa combina a hora (sem 'Bora a próxima?')", () => {
    const store = montarStore(dados());
    montar(store, "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const gravado = JSON.parse(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)!);
    expect(Object.keys(gravado).sort()).toEqual(["boasVindas", "feitos", "inicio", "modulos", "v"]);
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeiro registro feito!");
    expect(screen.getByTestId("missao-doses-combinado")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(screen.queryByTestId("missao-doses-agora-nao")).toBeNull();
    expect(eventos.every(([, d]) => !("variante" in d))).toBe(true);
    expect(eventos.map(([n]) => n)).not.toContain("missao_dose_concluida");
    expect(eventos.map(([n]) => n)).not.toContain("missao_completa");
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
  });

  it("um braço B que ficou gravado de um QA antigo NÃO vale com a chave desligada", () => {
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    expect(ehBracoB(lerMissao())).toBe(false);
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(false);
    montar(montarStore(dados()), "/home");
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
  });
});

/* ------------------------------------------------------------ braço A */

describe("braço A: a missão de hoje + `variante: 'A'`", () => {
  it("nasce com braco A, a festa é a de hoje, e todo evento leva variante A (inclusive missao_dose_concluida)", () => {
    ligarA();
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.braco).toBe("A");
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ variante: "A", prototipo: "app" })]);
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeiro registro feito!");
    expect(screen.getByTestId("missao-doses-combinado")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 1, modulo: "financas", variante: "A" })]);
    expect(eventos).toContainEqual(["missao_doses_dia_feito", expect.objectContaining({ dia: 1, modulo: "financas", variante: "A" })]);
  });
});

/* ------------------------------------------------------------ braço B */

describe("braço B: as 3 doses no dia 1", () => {
  it("dose 1 feita → 'Bora a próxima? 20 s' (Rotina) + 'Agora não'; missao_dose_concluida com variante B; 'Bora' leva ao próximo módulo", () => {
    ligarB();
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.braco).toBe("B");
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ variante: "B" })]);
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 1 de 3 · Finanças");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-proxima-dose")).toHaveTextContent("Próxima dose · 📅 Rotina");
    expect(screen.getByTestId("missao-doses-bora-proxima")).toHaveTextContent("Bora a próxima? 20 s");
    expect(screen.getByTestId("missao-doses-agora-nao")).toHaveTextContent("Agora não");
    expect(screen.queryByTestId("missao-doses-combinado")).toBeNull();
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 1, modulo: "financas", variante: "B" })]);
    fireEvent.click(screen.getByTestId("missao-doses-bora-proxima"));
    expect(eventos).toContainEqual(["missao_bora_proxima", expect.objectContaining({ indice: 1, variante: "B" })]);
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(screen.queryByTestId("plano-amanha")).toBeNull(); // ainda no meio das doses
  });

  it("'Agora não' no meio: missao_agora_nao, a notificação de +3 h é armada pra próxima dose, e a Home mostra a folha do plano de amanhã", async () => {
    ligarB();
    registrarAbertura(new Date(2026, 9, 3, 15, 10), conta.created_at);
    const store = montarStore(dados());
    missaoGravada({ braco: "B" });
    montar(store, "/financas");
    tocarChipAteAFesta();
    fireEvent.click(screen.getByTestId("missao-doses-agora-nao"));
    expect(eventos).toContainEqual(["missao_agora_nao", expect.objectContaining({ indice: 1, variante: "B" })]);
    expect(lerMissao()?.agoraNao).toEqual({ dia: "2026-10-03", indice: 1 });
    expect(notif.proximaDose).toHaveBeenCalledWith(expect.objectContaining({ indice: 2, nome: "Rotina", rota: "/rotina" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(eventos).toContainEqual(["missao_proxima_dose_armada", expect.objectContaining({ ok: true, indice: 2 })]);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    // a folha do plano de amanhã
    const folha = screen.getByTestId("plano-amanha");
    expect(folha).toHaveTextContent("Quando você abre o CORE amanhã?");
    expect(screen.getByTestId("plano-amanha-quando-almoco")).toHaveAttribute("aria-checked", "true"); // 15:10 → o mais perto é o almoço
    expect(eventos).toContainEqual(["plano_amanha_folha", expect.objectContaining({ acao: "view", doses: 1, variante: "B" })]);
    // a prévia é concreta: parou no meio → a próxima dose, com o que ela fez
    expect(screen.getByTestId("plano-amanha-previa")).toHaveTextContent("Ontem você anotou 1 gasto — bora a próxima dose?");
    // noite + antes de dormir → Combinado
    fireEvent.click(screen.getByTestId("plano-amanha-quando-noite"));
    fireEvent.click(screen.getByTestId("plano-amanha-gatilho-dormir"));
    expect(screen.getByTestId("plano-amanha-previa")).toHaveTextContent("Amanhã à noite, antes de dormir · 20:00");
    expect(screen.getByTestId("plano-amanha-combinado")).toHaveTextContent("Combinado, amanhã à noite, antes de dormir");
    fireEvent.click(screen.getByTestId("plano-amanha-combinado"));
    expect(eventos).toContainEqual(["plano_amanha_definido", expect.objectContaining({ quando: "noite", gatilho: "dormir", variante: "B", doses: 1 })]);
    expect(lerMissao()?.planoAmanha).toEqual({ quando: "noite", gatilho: "dormir", dia: "2026-10-03" });
    expect(lerDia2()?.horaEscolhida).toBe(20 * 60);
    await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
    expect(notif.pedirDia2).toHaveBeenCalledWith("missao");
    expect(notif.pedirDia2).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    expect(screen.getByText("home de sempre")).toBeInTheDocument();
  });

  it("'Sem lembrete' na folha: grava o pulo do dia, não pede permissão, e a folha não volta hoje", async () => {
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("plano-amanha-pular"));
    expect(eventos).toContainEqual(["plano_amanha_pulou", expect.objectContaining({ doses: 1, variante: "B" })]);
    expect(lerMissao()?.planoAmanhaPulado).toBe("2026-10-03");
    await act(async () => { await Promise.resolve(); });
    expect(notif.pedirDia2).not.toHaveBeenCalled();
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(false);
  });

  it("3ª dose no dia 1: 'Missão cumprida!' + 'Fechar por hoje', missao_completa {variante} + CustomEvent pro tour; 'O que você construiu' NÃO aparece no dia 1 (só no dia 3)", () => {
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Água marcado" } }, planoAmanha: { quando: "noite", dia: "2026-10-03" } });
    const completou = vi.fn();
    window.addEventListener(EVENTO_MISSAO_COMPLETA, completou);
    montar(montarStore(dados()), "/saude");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 3 de 3 · Saúde");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Missão cumprida!");
    expect(screen.getByTestId("missao-doses-fechar-dia")).toHaveTextContent("Fechar por hoje");
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 3, modulo: "saude", variante: "B" })]);
    expect(eventos).toContainEqual(["missao_completa", expect.objectContaining({ variante: "B", modulos: ["financas", "rotina", "saude"] })]);
    expect(completou).toHaveBeenCalledTimes(1);
    expect(lerMissao()?.completaEm).toBe("2026-10-03");
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("construiu")).toBeNull(); // dia 1: nada; o final é do dia 3
    expect(screen.queryByTestId("plano-amanha")).toBeNull(); // o plano já estava combinado
    window.removeEventListener(EVENTO_MISSAO_COMPLETA, completou);
  });

  it("dia 2 = 'aprofundar': no módulo já visto, a faixa 'Aprofundar · dia 2 · Finanças', 1 registro → festa curta → Fechar; o módulo não pede de novo hoje", () => {
    ligarB();
    missaoGravada({ braco: "B", completaEm: "2026-10-02", planoAmanha: { quando: "noite", dia: "2026-10-02" }, feitos: { 1: { dia: "2026-10-02", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-02", rotulo: "Água marcado" }, 3: { dia: "2026-10-02", rotulo: "1 copo" } } }, "2026-10-02");
    expect(aprofundarPendente(lerMissao()!, "/financas")).toEqual({ n: 1, modulo: "financas" });
    expect(aprofundarPendente(lerMissao()!, "/home")).toBeNull();
    montar(montarStore(dados()), "/financas");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Aprofundar · dia 2 · Finanças");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveAttribute("data-modo", "aprofundar");
    expect(festa).toHaveTextContent("Dia 2 aprofundado!");
    expect(eventos).toContainEqual(["missao_aprofundar_feito", expect.objectContaining({ dia: 2, modulo: "financas", variante: "B" })]);
    expect(lerMissao()?.aprofundados).toEqual({ "2026-10-03": ["financas"] });
    expect(eventos.map(([n]) => n)).not.toContain("missao_dose_concluida");
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(aprofundarPendente(lerMissao()!, "/financas")).toBeNull();
    expect(aprofundarPendente(lerMissao()!, "/rotina")).toEqual({ n: 2, modulo: "rotina" });
    expect(screen.queryByTestId("construiu")).toBeNull(); // dia 2 ainda não
  });

  it("dia 3: 'O que você construiu' aparece na Home (e missaoEmAndamento acompanha o tour)", () => {
    ligarB();
    missaoGravada({ braco: "B", completaEm: "2026-10-01", planoAmanha: { quando: "noite", dia: "2026-10-01" }, feitos: { 1: { dia: "2026-10-01", rotulo: "a" }, 2: { dia: "2026-10-01", rotulo: "b" }, 3: { dia: "2026-10-01", rotulo: "c" } } }, "2026-10-01");
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    montar(montarStore(dados()), "/home");
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...lerMissao(), fimVisto: true }));
    expect(missaoEmAndamento(lerMissao())).toBe(false);
  });

  it("missaoEmAndamento (encaixe do tour): boas-vindas, dose do dia 1 e a folha do plano contam; A sem a chave: o de hoje", () => {
    ligarB();
    missaoGravada({ braco: "B", boasVindas: false });
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    missaoGravada({ braco: "B" });
    expect(missaoEmAndamento(lerMissao())).toBe(true); // dose 1 do dia 1 por fazer
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "x" } } });
    expect(missaoEmAndamento(lerMissao())).toBe(true); // a folha do plano está devendo
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "x" } }, planoAmanha: { quando: "noite", dia: "2026-10-03" }, pulados: { 2: "2026-10-03" } });
    expect(missaoEmAndamento(lerMissao())).toBe(false); // plano feito, dose 2 pulada hoje: a Home é da pessoa (e do tour)
    expect(missaoEmAndamento(null)).toBe(false);
  });
});

/* ------------------------------------------------------------ o Lembrete do dia 2 do B */

describe("o Lembrete do dia 2 no braço B é concreto", () => {
  const get: Leitor = <T,>(_k: string, f: T): T => f;
  const amanha = new Date(2026, 9, 4, 20, 0);
  it("missão completa no dia 1 → dia 2: 'Ontem você anotou 1 gasto — 20 s pra anotar o de hoje', com o que ela fez; dia 3 → o 2º módulo", () => {
    ligarB();
    missaoGravada({ braco: "B", completaEm: "2026-10-03", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Água marcado" }, 3: { dia: "2026-10-03", rotulo: "1 copo" } } });
    const c = conteudoDoLembrete(get, { missao: lerMissao(), amanha, hoje: "2026-10-03" });
    expect(c.title).toBe("Ontem você anotou 1 gasto — 20 s pra anotar o de hoje");
    expect(c.body).toBe("Café · R$ 12 já está nas suas Finanças. Toca em 1 gasto de hoje de novo e o dia 2 da missão fica feito.");
    expect(c.modulo).toBe("missao"); expect(c.rota).toBe("/financas"); expect(c.temNumero).toBe(true);
    const c3 = conteudoDoLembrete(get, { missao: lerMissao(), amanha: new Date(2026, 9, 5, 20, 0), hoje: "2026-10-04" });
    expect(c3.title).toBe("Esses dias você anotou 1 hábito — 20 s pra anotar mais um de hoje");
    expect(c3.rota).toBe("/rotina");
    // dia 4 em diante: volta ao módulo mais usado / da área (o de hoje)
    const c4 = conteudoDoLembrete(get, { missao: lerMissao(), amanha: new Date(2026, 9, 6, 20, 0), hoje: "2026-10-05" });
    expect(c4.modulo).toBe("financas");
  });

  it("parou no meio ('Agora não'): a próxima dose, com o que já fez; sem a chave, o texto da missão de hoje", () => {
    ligarB();
    missaoGravada({ braco: "B", agoraNao: { dia: "2026-10-03", indice: 1 }, feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    const c = conteudoDoLembrete(get, { missao: lerMissao(), amanha, hoje: "2026-10-03" });
    expect(c.title).toBe("Ontem você anotou 1 gasto — bora a próxima dose?");
    expect(c.body).toBe("Marca 1 hábito no quadradinho — 20 segundos e a dose 2 de 3 fica feita (1 de 3 já foi).");
    guardarForcaDia1Cheio("?dia1-cheio=off");
    const hoje = conteudoDoLembrete(get, { missao: lerMissao(), amanha, hoje: "2026-10-03" });
    expect(hoje.title).toBe("🔥 Dia 2 da missão: 📅 Rotina");
  });
});

/* ------------------------------------------------------------ 1.0.14: "on" pra todo mundo + a avaliação na missão */

describe("1.0.14 — modo 'on' (todo mundo no B) e a avaliação ligada na missão", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("a build de QA (VITE_V14_QA=1) vale 'on': a missão nasce no braço B pra todo mundo, com variante B nos eventos, sem sorteio gravado", () => {
    vi.stubEnv("VITE_V14_QA", "1");
    expect(modoDia1Cheio()).toBe("on");
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.braco).toBe("B");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ variante: "B" })]);
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-bora-proxima")).toBeInTheDocument();
  });

  it("3ª dose: pedirAvaliacaoPorMissao('missao_completa') 1,5 s depois da comemoração; o plano combinado pede 'plano_amanha_definido' 1,5 s depois", () => {
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Água marcado" } } });
    montar(montarStore(dados()), "/saude");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Missão cumprida!");
    expect(nota.pedir).not.toHaveBeenCalled();
    avancar(ESPERA_AVALIACAO_MS - 1);
    expect(nota.pedir).not.toHaveBeenCalled();
    avancar(1);
    expect(nota.pedir).toHaveBeenCalledTimes(1);
    expect(nota.pedir).toHaveBeenCalledWith("missao_completa");
    // fecha o dia → a Home mostra o plano de amanhã → "Combinado" → 1,5 s → plano_amanha_definido
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("plano-amanha-combinado"));
    expect(eventos.map(([n]) => n)).toContain("plano_amanha_definido");
    expect(nota.pedir).toHaveBeenCalledTimes(1);
    avancar(ESPERA_AVALIACAO_MS);
    expect(nota.pedir).toHaveBeenCalledTimes(2);
    expect(nota.pedir).toHaveBeenLastCalledWith("plano_amanha_definido");
  });

  it("dose 1 de 3 (missão incompleta): não pede nota", () => {
    ligarB();
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    tocarChipAteAFesta();
    avancar(ESPERA_AVALIACAO_MS * 2);
    expect(nota.pedir).not.toHaveBeenCalled();
  });
});
