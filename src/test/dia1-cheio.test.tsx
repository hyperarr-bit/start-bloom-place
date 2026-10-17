/**
 * DIA 1 CHEIO + PLANO DE AMANHÃ (10/10, chave DIA1_CHEIO em lib/dia1-cheio). O que este arquivo trava:
 *   · a chave nasce DESLIGADA e, desligada, a missão em doses do app é a de hoje byte a byte: nenhum
 *     braço sorteado, nenhum `variante` nos eventos, o JSON da missão sem campo novo, a comemoração
 *     com "Combinado, me lembra às…" e sem "Bora a próxima?";
 *   · ligada: sorteio 50/50 determinístico por id do aparelho, gravado em core-dia1-braco; o braço vai
 *     em TODO evento da missão (`variante`); `?dia1-cheio=a|b` força;
 *   · braço A = (1.0.16) uma dose por dia — o fluxo completo mora em src/test/v1016-missao-1-por-dia.test.tsx;
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

import { UserDataContext, useUserData } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb, EVENTO_MISSAO_COMPLETA } from "@/components/missao-doses/MissaoDosesNaWeb";
import {
  CHAVE_ESTADO_MISSAO_DOSES, aprofundarPendente, ehBracoB, eventoDaMissao, iniciarMissao, lerMissao, missaoDoDiaEmCena, missaoEmAndamento, precisaPlanoAmanha, varianteDia1,
} from "@/lib/missao-doses";
import { EVENTO_TOUR_HOME_FIM } from "@/lib/tour-home";
import {
  CHAVE_BRACO_DIA1, CHAVE_FORCA_DIA1_CHEIO, CHAVE_ID_LOCAL, DIA1_CHEIO, bracoDia1, dia1CheioLigado, fraseDoPlano, guardarForcaDia1Cheio, idDoAparelho, minutosDoPlano, modoDia1Cheio, quandoSugerido, sortearBraco,
} from "@/lib/dia1-cheio";
import { ESPERA_AVALIACAO_MS } from "@/components/missao-doses/MissaoDosesNaWeb";
import { PASSAGEM_B_MS } from "@/components/missao-doses/PassoDoDia";
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
/** A Rotina de mentira com o caminho REAL de criar um hábito: "+ Hábito" abre o campo, "Adicionar" grava
 *  `rotina-habits` (como a página), e a tabela tem a linha de HOJE com um quadradinho por hábito que grava
 *  `rotina-habits-checked`. É o que a dose 2 ensina em 2 passos. */
const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const RotinaFalsa = () => {
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const habitos = (get<string[]>("rotina-habits", []) ?? []);
  const grade = get<Record<string, boolean[]>>("rotina-habits-checked", {}) ?? {};
  const adicionar = () => { if (!nome.trim()) return; set("rotina-habits", [...habitos, nome.trim()]); setNome(""); setAberto(false); };
  const marcar = (dia: string, i: number) => { const linha = [...(grade[dia] ?? habitos.map(() => false))]; linha[i] = !linha[i]; set("rotina-habits-checked", { ...grade, [dia]: linha }); };
  return (
    <div>
      <Rota /><header className="sticky">ROTINA</header>
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={adicionar}>Adicionar</button></div>}
      <table><tbody>{DIAS_ROTINA.map((d) => (
        <tr key={d}><td>{d}</td>{habitos.map((h, i) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} checked={!!grade[d]?.[i]} onChange={() => marcar(d, i)} /></td>)}</tr>
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
/** A CONTA NOVA DE VERDADE é VAZIA (10/10, dono): nenhum seed — cada dose tem que funcionar assim. */
const dados = (): Record<string, unknown> => ({});
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** em passos curtos: a missão abre o campo da Rotina por um click que o React só confirma entre os `act` */
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
/** toca no 1º chip e chega na festa */
const tocarChipAteAFesta = () => {
  const postIt = esperarPostIt();
  fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
  avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
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
  // 1.0.16: a dose de Finanças virou o "Vamos montar suas Finanças" — aqui, o caminho de quem PULOU (o 1º gasto pelo chip)
  localStorage.setItem("core-montar-financas", JSON.stringify({ r: "pulou" }));
  eventos.length = 0;
  notif.pedirDia2.mockClear(); notif.proximaDose.mockClear(); nota.pedir.mockClear();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-funnel-area", "dinheiro");
  // o cabeçalho fixo do módulo fica no TOPO (0–56); o resto, em 100–148 (o post-it "colado embaixo da faixa" decide por aí)
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return (this.matches?.("header.sticky, .demo-tour-nav")
      ? { top: 0, left: 0, width: 390, height: 56, bottom: 56, right: 390, x: 0, y: 0, toJSON: () => ({}) }
      : { top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) }) as DOMRect;
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); delete (window as { Capacitor?: unknown }).Capacitor; });

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

describe("braço A (1.0.16: uma dose por dia) + `variante: 'A'`", () => {
  it("nasce com braco A, boas-vindas de 1 tela ('Seu plano de 3 dias'), festa pequena 'Dia 1 de 3 feito ✅' sem 'Bora a próxima?' nem adiantar, e todo evento leva variante A", () => {
    ligarA();
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.braco).toBe("A");
    expect(screen.queryByTestId("missao-doses-vamos-la")).toBeNull(); // uma tela só
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveTextContent("Seu plano de 3 dias");
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ variante: "A", prototipo: "app" })]);
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-continuar")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 1, modulo: "financas", variante: "A" })]);
    expect(eventos).toContainEqual(["missao_doses_dia_feito", expect.objectContaining({ dia: 1, modulo: "financas", variante: "A" })]);
  });
});

/* ------------------------------------------------------------ braço B */

describe("braço B: as 3 doses no dia 1 (+ arrumar a Home) — conta VAZIA", () => {
  const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

  it("boas-vindas B em DUAS telas curtas: 'Tá dentro! 🎉' → 'Vamos lá' → 'Hoje é só 3 toques.' com as 3 doses e 'Começar'; dose 1 → faixa 'Missão · dose 1 de 4' (sem o módulo) → festa que LEVA pra próxima sozinha ('Agora a Rotina — 20 s', 'Ir agora', 'Agora não')", () => {
    ligarB();
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.braco).toBe("B");
    // tela 1: a comemoração por ter entrado — curta, sem lista, sem barra, sem link
    const tela1 = screen.getByTestId("missao-doses-boas-vindas");
    expect(tela1).toHaveAttribute("data-tela", "1");
    expect(tela1).toHaveTextContent("Tá dentro! 🎉");
    expect(tela1).toHaveTextContent("Seus 3 dias grátis começaram agora. Dá pra usar tudo.");
    expect(screen.queryByTestId("missao-doses-linhas")).toBeNull();
    expect(screen.queryByTestId("missao-doses-explorar")).toBeNull();
    expect(tela1).not.toHaveTextContent("4 passos");
    expect(eventos).toContainEqual(["missao_doses_boas_vindas", expect.objectContaining({ acao: "view", tela: 1, variante: "B" })]);
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    expect(eventos).toContainEqual(["missao_doses_boas_vindas", expect.objectContaining({ acao: "vamos_la", tela: 1 })]);
    // tela 2: só o essencial das doses
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveAttribute("data-tela", "2");
    expect(boas).toHaveTextContent("Hoje é só 3 toques.");
    expect(screen.getByTestId("missao-doses-subtitulo")).toHaveTextContent("Um gasto, um hábito, um copo d'água. Uns 20 segundos cada.");
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent("💰 Finanças · toca em 1 gasto de hoje");
    expect(screen.getByTestId("missao-doses-linha-2")).toHaveTextContent("📅 Rotina · cria 1 hábito e marca");
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent("❤️ Saúde · marca 1 copo d'água");
    expect(screen.getByTestId("missao-doses-depois")).toHaveTextContent("Depois a gente arruma sua Home junto.");
    expect(screen.queryByTestId("missao-doses-linha-4")).toBeNull();
    expect(screen.queryByTestId("missao-doses-barra")).toBeNull();
    expect(boas).not.toHaveTextContent("AMANHÃ");
    expect(boas).not.toHaveTextContent("4 passos");
    expect(boas).not.toHaveTextContent("13 módulos");
    expect(boas).not.toHaveTextContent("1 toque por dia");
    expect(screen.getByTestId("missao-doses-trocar")).toHaveTextContent("Trocar os 3");
    expect(screen.getByTestId("missao-doses-comecar")).toHaveTextContent("Começar");
    const rodape = screen.getByTestId("missao-doses-rodape");
    // dono 10/10: o "Explorar por conta própria" fica ABAIXO do "Começar" (como a welcome)
    expect(rodape.querySelector("[data-testid='missao-doses-comecar']")!.compareDocumentPosition(rodape.querySelector("[data-testid='missao-doses-explorar']")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ variante: "B" })]);
    expect(eventos).toContainEqual(["missao_doses_boas_vindas", expect.objectContaining({ acao: "view", tela: 2 })]);
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(eventos).toContainEqual(["missao_doses_boas_vindas", expect.objectContaining({ acao: "comecar", tela: 2 })]);
    const faixa = screen.getByTestId("missao-doses-faixa");
    expect(faixa).toHaveTextContent("Missão · dose 1 de 4");
    expect(faixa).not.toHaveTextContent("Finanças");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeira dose feita!");
    expect(festa).toHaveTextContent("Café · R$ 12");
    // 17/10 (22% e 18% se perdiam entre um módulo e outro): a festa LEVA pra próxima sozinha — "Agora a Rotina — 20 s"
    // com a barra; "Ir agora" adianta, "Agora não" para
    expect(screen.getByTestId("missao-doses-proxima-dose")).toHaveTextContent("Dose 2 de 4 · 📅 Rotina");
    expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent("Agora a Rotina — 20 s");
    expect(screen.getByTestId("missao-doses-proxima-dose")).toHaveTextContent("Marca 1 hábito no quadradinho.");
    expect(screen.getByTestId("missao-doses-bora-proxima")).toHaveTextContent("Ir agora");
    expect(screen.getByTestId("missao-doses-agora-nao")).toHaveTextContent("Agora não");
    expect(screen.queryByTestId("missao-doses-combinado")).toBeNull();
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 1, modulo: "financas", variante: "B" })]);
    avancar(PASSAGEM_B_MS - 100);
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas"); // ainda dá pra ler a festa
    avancar(150);
    expect(eventos).toContainEqual(["missao_bora_proxima", expect.objectContaining({ indice: 1, via: "auto", variante: "B" })]);
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(screen.queryByTestId("plano-amanha")).toBeNull(); // ainda no meio das doses
    // a dose da Rotina apareceu: a transição fecha com o tempo da festa até ela
    avancar(300);
    const transicao = eventos.find(([n]) => n === "missao_doses_transicao")?.[1];
    expect(transicao).toMatchObject({ de: "financas", para: "rotina", via: "auto", indice: 2, variante: "B" });
    expect(transicao!.ms).toBeGreaterThanOrEqual(PASSAGEM_B_MS);
    expect(transicao!.ms).toBeLessThan(PASSAGEM_B_MS + 1000);
  });

  it("o chip 'Café · R$ 12' com TOQUE de verdade (pointerdown → click): lança o gasto na conta, abre o olhar e a festa — o post-it NÃO some no pointerdown (o bug do Simulador)", () => {
    ligarB();
    const store = montarStore(dados());
    missaoGravada({ braco: "B" });
    montar(store, "/financas");
    const postIt = esperarPostIt();
    const chip = within(postIt).getAllByTestId("demo-guia-chip")[0];
    expect(chip).toHaveTextContent("Café");
    fireEvent.pointerDown(chip);            // o que o WKWebView manda primeiro
    expect(screen.getByTestId("demo-guia-postit")).toBeInTheDocument(); // continua na tela
    fireEvent.click(chip);
    const gastos = store.dados["finance-expenses"] as Array<{ description: string; value: number }>;
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ description: "Café", value: 12 });
    avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
    expect(screen.getByTestId("missao-doses-olhar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("missao-doses-entendi"));
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-bora-proxima")).toBeInTheDocument();
    expect(eventos.map(([n]) => n)).not.toContain("missao_pular");
  });

  it("tocar FORA do post-it (no fundo) ou rolar a página NÃO fecha o post-it; nem o tempo (17/10: sem os 60 s); o app no 2º plano deixa o post-it SOLTO com os chips e o anel volta sozinho", () => {
    ligarB();
    missaoGravada({ braco: "B" });
    montar(montarStore(dados()), "/financas");
    esperarPostIt();
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(screen.getByText("MEU MÊS"));
    expect(screen.getByTestId("demo-guia-postit")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("scroll")); });
    avancar(500);
    expect(screen.getByTestId("demo-guia-postit")).toBeInTheDocument();
    expect(eventos.map(([n]) => n)).not.toContain("missao_pular");
    expect(screen.queryByTestId("missao-doses-onde")).toBeNull();
    avancar(60_000); // 17/10: o anel do passo não tem mais tempo — 36 pessoas perdiam o post-it aos 60 s
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    // foi pro 2º plano (ver o valor no banco): o anel sai, o post-it fica SOLTO com os chips
    const visivel = (v: "hidden" | "visible") => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); act(() => { document.dispatchEvent(new Event("visibilitychange")); }); };
    visivel("hidden");
    expect(eventos).toContainEqual(["missao_doses_anel_saiu", expect.objectContaining({ motivo: "segundo_plano", variante: "B" })]);
    expect(within(screen.getByTestId("missao-doses-postit-solto")).getAllByTestId("demo-guia-chip").length).toBeGreaterThanOrEqual(3);
    // voltou: o anel volta sozinho (sem depender do ⌖)
    visivel("visible");
    avancar(50);
    expect(eventos).toContainEqual(["missao_doses_anel_voltou", expect.objectContaining({ motivo: "segundo_plano", variante: "B" })]);
    expect(screen.getAllByTestId("missao-doses-anel").length).toBeGreaterThanOrEqual(1);
    expect(lerMissao()).not.toBeNull(); // nada disso apaga a missão
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("dose 2 na Rotina de uma conta VAZIA, em 2 passos: (A) o anel no campo real '+ Hábito', o chip só PREENCHE o campo, 'Adicionar' cria pelo caminho da Rotina; (B) o anel vai pro quadradinho de HOJE da linha nova → marcou → festa com o nome do hábito", () => {
    ligarB();
    const store = montarStore(dados());
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    // passo A: o campo "Nome do hábito..." abriu (a missão tocou no "+ Hábito") e o anel está na linha dele
    const campo = screen.getByPlaceholderText("Nome do hábito...") as HTMLInputElement;
    expect(postIt).toHaveTextContent("1 de 2 · criar");
    expect(postIt).toHaveTextContent("Qual hábito você quer começar hoje?");
    expect(postIt).toHaveTextContent("toca em Adicionar");
    const chips = within(postIt).getAllByTestId("demo-guia-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["💧Beber água ao acordar", "🧘Alongar 5 min", "🛏️Arrumar a cama"]);
    fireEvent.pointerDown(chips[0]);
    fireEvent.click(chips[0]);
    expect(campo.value).toBe("Beber água ao acordar"); // só preencheu
    expect(store.dados["rotina-habits"]).toBeUndefined(); // NADA gravado por fora
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    // a pessoa toca em Adicionar: o hábito nasce pelo código da Rotina
    fireEvent.click(screen.getByText("Adicionar"));
    expect(store.dados["rotina-habits"]).toEqual(["Beber água ao acordar"]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "criar_habito", acao: "feito", nome: "Beber água ao acordar" })]);
    // passo B: o anel foi pro quadradinho de hoje; o post-it pede pra marcar
    avancar(400); avancar(3000);
    const postItB = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postItB).toHaveTextContent("2 de 2 · marcar");
    expect(postItB).toHaveTextContent("Agora marca o quadradinho de hoje");
    expect(within(postItB).queryAllByTestId("demo-guia-chip")).toEqual([]);
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    expect((store.dados["rotina-habits-checked"] as Record<string, boolean[]>)[DIAS_ROTINA[(new Date().getDay() + 6) % 7]]).toEqual([true]);
    avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
    const entendi = screen.queryByTestId("missao-doses-entendi");
    if (entendi) fireEvent.click(entendi);
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveTextContent("Segunda dose feita!");
    expect(festa).toHaveTextContent("Beber água ao acordar já está na sua Rotina"); // o rótulo da festa = o nome do hábito
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 2, modulo: "rotina", variante: "B" })]);
  });

  it("dose da Rotina com hábito já existente (conta antiga/dia 2): direto no quadradinho, como sempre", () => {
    ligarB();
    const store = montarStore({ "rotina-habits": ["Ler"] });
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Agora · 1 toque");
    expect(postIt).toHaveTextContent("quadradinho");
    expect(within(postIt).queryAllByTestId("demo-guia-chip")).toEqual([]);
    expect(screen.queryByPlaceholderText("Nome do hábito...")).toBeNull();
  });

  it("'Agora não' no meio: missao_agora_nao, a notificação de +3 h é armada pra próxima dose, e a folha do plano de amanhã entra ALI (no módulo), sem jargão; 'Combinado' vira a hora do lembrete, pede a permissão UMA vez e leva pra Home", async () => {
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
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas"); // ainda no contexto da missão
    // a folha do plano de amanhã: pelo VALOR dos avisos, sem "dia 2"
    const folha = screen.getByTestId("plano-amanha");
    expect(folha).toHaveTextContent("O CORE te avisa do que importa");
    expect(folha).toHaveTextContent("Conta vencendo — antes do juros");
    expect(folha).toHaveTextContent("Sua próxima dose da missão — 20 s");
    expect(folha).toHaveTextContent("Que horas te lembro amanhã?");
    expect(folha).not.toHaveTextContent("dia 2");
    expect(screen.getByTestId("plano-amanha-quando-almoco")).toHaveAttribute("aria-checked", "true"); // 15:10 → o mais perto é o almoço
    expect(eventos).toContainEqual(["plano_amanha_folha", expect.objectContaining({ acao: "view", doses: 1, variante: "B" })]);
    expect(screen.getByTestId("plano-amanha-previa")).toHaveTextContent("Ontem você anotou 1 gasto — bora a próxima dose?");
    // o link "Sem lembrete" fica ACIMA do botão fixo
    expect(screen.getByTestId("plano-amanha-pular").compareDocumentPosition(screen.getByTestId("plano-amanha-combinado")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.getByText("home de sempre")).toBeInTheDocument();
  });

  it("'Sem lembrete' na folha: grava o pulo do dia, não pede permissão, e a folha não volta hoje", async () => {
    ligarB();
    missaoGravada({ braco: "B", agoraNao: { dia: "2026-10-03", indice: 1 }, feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("plano-amanha-pular"));
    expect(eventos).toContainEqual(["plano_amanha_pulou", expect.objectContaining({ doses: 1, variante: "B" })]);
    expect(lerMissao()?.planoAmanhaPulado).toBe("2026-10-03");
    await act(async () => { await Promise.resolve(); });
    expect(notif.pedirDia2).not.toHaveBeenCalled();
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(false);
  });

  it("3ª dose: 'Terceira dose feita!' + 'Falta 1: arrumar sua Home' → 'Arrumar minha Home' leva pra Home com a faixa 'Missão · 4 de 4'; SEM missao_completa ainda; o fim do tour (evento) fecha a missão: indice 4 modulo home + missao_completa + CustomEvent; SÓ ENTÃO a folha do plano", () => {
    vi.stubEnv("VITE_V14_QA", "1"); // o tour da Home existe nesta build
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Beber água ao acordar marcado" } } });
    const completou = vi.fn();
    window.addEventListener(EVENTO_MISSAO_COMPLETA, completou);
    const store = montarStore(dados());
    montar(store, "/saude");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 3 de 4");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Terceira dose feita!");
    expect(screen.getByTestId("missao-doses-falta-home")).toHaveTextContent("Falta 1: arrumar sua Home");
    expect(screen.getByTestId("missao-doses-fechar-dia")).toHaveTextContent("Arrumar minha Home");
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 3, modulo: "saude", variante: "B" })]);
    expect(eventos.map(([n]) => n)).not.toContain("missao_completa");
    expect(completou).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · 4 de 4");
    expect(screen.queryByTestId("plano-amanha")).toBeNull(); // o plano é a ÚLTIMA coisa: depois do tour
    expect(screen.queryByTestId("construiu")).toBeNull(); // dia 1: nada; o final é do dia 3
    // o tour da Home terminou (TourDaHome dispara o evento)
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_TOUR_HOME_FIM)); });
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 4, modulo: "home", variante: "B" })]);
    expect(eventos).toContainEqual(["missao_completa", expect.objectContaining({ variante: "B", modulos: ["financas", "rotina", "saude"], home: "tour" })]);
    expect(completou).toHaveBeenCalledTimes(1);
    expect(lerMissao()?.homeTour).toEqual({ dia: "2026-10-03", via: "tour" });
    expect(lerMissao()?.completaEm).toBe("2026-10-03");
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    // a folha do plano espera a festa "Casa arrumada" ser vista (ela é a comemoração do fim da missão)
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    act(() => { store.valor().set("conquistas-vistas", { adesivos: ["casa-arrumada"], marcos: [] }); });
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument();
    window.removeEventListener(EVENTO_MISSAO_COMPLETA, completou);
  });

  it("sem o tour nesta build (chave off): o 4º passo é dado como feito em silêncio (home: sem_tour) e o plano vem na Home", () => {
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" }, 3: { dia: "2026-10-03", rotulo: "c" } } });
    montar(montarStore(dados()), "/home");
    expect(lerMissao()?.homeTour).toEqual({ dia: "2026-10-03", via: "sem_tour" });
    expect(eventos).toContainEqual(["missao_completa", expect.objectContaining({ variante: "B", home: "sem_tour" })]);
    expect(eventos.filter(([n, d]) => n === "missao_dose_concluida" && d.indice === 4)).toEqual([]);
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument();
  });

  it("dia 2 = 'aprofundar': no módulo já visto, a faixa 'Aprofundar · dia 2', 1 registro → festa curta → Fechar; o módulo não pede de novo hoje", () => {
    ligarB();
    missaoGravada({ braco: "B", completaEm: "2026-10-02", homeTour: { dia: "2026-10-02", via: "tour" }, planoAmanha: { quando: "noite", dia: "2026-10-02" }, feitos: { 1: { dia: "2026-10-02", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-02", rotulo: "Água marcado" }, 3: { dia: "2026-10-02", rotulo: "1 copo" } } }, "2026-10-02");
    expect(aprofundarPendente(lerMissao()!, "/financas")).toEqual({ n: 1, modulo: "financas" });
    expect(aprofundarPendente(lerMissao()!, "/home")).toBeNull();
    montar(montarStore(dados()), "/financas");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Aprofundar · dia 2");
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
    missaoGravada({ braco: "B", completaEm: "2026-10-01", homeTour: { dia: "2026-10-01", via: "tour" }, planoAmanha: { quando: "noite", dia: "2026-10-01" }, feitos: { 1: { dia: "2026-10-01", rotulo: "a" }, 2: { dia: "2026-10-01", rotulo: "b" }, 3: { dia: "2026-10-01", rotulo: "c" } } }, "2026-10-01");
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    montar(montarStore(dados()), "/home");
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...lerMissao(), fimVisto: true }));
    expect(missaoEmAndamento(lerMissao())).toBe(false);
  });

  it("missaoEmAndamento (encaixe do tour) e missaoDoDiaEmCena (os adesivos esperam): boas-vindas, dose do dia 1, o tour como 4º passo e a folha do plano", () => {
    ligarB();
    missaoGravada({ braco: "B", boasVindas: false });
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    expect(missaoDoDiaEmCena(lerMissao())).toBe(true);
    missaoGravada({ braco: "B" });
    expect(missaoEmAndamento(lerMissao())).toBe(true); // dose 1 do dia 1 por fazer
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "x" } }, agoraNao: { dia: "2026-10-03", indice: 1 } });
    expect(missaoEmAndamento(lerMissao())).toBe(true); // "Agora não": a folha do plano está devendo
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(true);
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "x" } }, agoraNao: { dia: "2026-10-03", indice: 1 }, planoAmanha: { quando: "noite", dia: "2026-10-03" } });
    expect(missaoEmAndamento(lerMissao())).toBe(false); // plano feito depois do "Agora não": a Home é da pessoa
    expect(missaoDoDiaEmCena(lerMissao())).toBe(false); // os adesivos podem aparecer
    const tres = { 1: { dia: "2026-10-03", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" }, 3: { dia: "2026-10-03", rotulo: "c" } };
    missaoGravada({ braco: "B", feitos: tres });
    expect(missaoEmAndamento(lerMissao())).toBe(false); // 3 doses feitas: o tour É o 4º passo — pode entrar
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(false); // o plano só depois do tour
    expect(missaoDoDiaEmCena(lerMissao())).toBe(true); // mas os adesivos ainda esperam
    missaoGravada({ braco: "B", feitos: tres, homeTour: { dia: "2026-10-03", via: "tour" } });
    expect(precisaPlanoAmanha(lerMissao()!)).toBe(true); // tour feito: a folha do plano
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    missaoGravada({ braco: "B", explorou: true });
    expect(missaoDoDiaEmCena(lerMissao())).toBe(false); // pulou a missão: nada segura os adesivos
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
    expect(c.body).toBe("Café · R$ 12 já está nas suas Finanças. Toca em 1 gasto de hoje de novo e a missão continua.");
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
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-bora-proxima")).toBeInTheDocument();
  });

  it("o fim do tour (4º passo): pedirAvaliacaoPorMissao('missao_completa') 1,5 s depois; o plano combinado pede 'plano_amanha_definido' 1,5 s depois", () => {
    vi.stubEnv("VITE_V14_QA", "1");
    ligarB();
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Água marcado" } } });
    montar(montarStore(dados()), "/saude");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Terceira dose feita!");
    avancar(ESPERA_AVALIACAO_MS * 2);
    expect(nota.pedir).not.toHaveBeenCalled(); // a 3ª dose ainda não é a missão completa
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_TOUR_HOME_FIM)); });
    avancar(ESPERA_AVALIACAO_MS - 1);
    expect(nota.pedir).not.toHaveBeenCalled();
    avancar(1);
    expect(nota.pedir).toHaveBeenCalledTimes(1);
    expect(nota.pedir).toHaveBeenCalledWith("missao_completa");
    avancar(8000); // sem os Momentos montados aqui, a folha espera a festa "Casa arrumada" até 8 s
    // a missão fechou → a folha do plano → "Combinado" → 1,5 s → plano_amanha_definido
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
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    tocarChipAteAFesta();
    avancar(ESPERA_AVALIACAO_MS * 2);
    expect(nota.pedir).not.toHaveBeenCalled();
  });
});
